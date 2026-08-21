import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit/logger";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 403 });

  const serviceClient = createServiceClient();

  // Check event status
  const { data: event } = await serviceClient
    .from("rfx_events")
    .select("id, status, tenant_id")
    .eq("id", eventId)
    .single();

  if (!event || event.tenant_id !== profile.tenant_id) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  if (event.status !== "closed") {
    return NextResponse.json(
      { error: `Event must be 'closed' before awarding. Current: ${event.status}` },
      { status: 422 }
    );
  }

  // Pre-flight: find any unconfirmed low-confidence price fields
  const { data: priceFields } = await serviceClient
    .from("rfx_schema_fields")
    .select("field_key, label")
    .eq("event_id", eventId)
    .eq("is_price_field", true);

  type SubmissionWithVendor = { id: string; vendor_id: string; vendors: { company_name: string } | null };
  const { data: submissions } = await serviceClient
    .from("offer_submissions")
    .select("id, vendor_id, vendors(company_name)")
    .eq("event_id", eventId)
    .neq("status", "disqualified") as { data: SubmissionWithVendor[] | null; error: unknown };

  const blockingFields: Array<{
    submissionId: string;
    vendorName: string;
    fieldKey: string;
    fieldLabel: string;
  }> = [];

  for (const submission of submissions ?? []) {
    for (const priceField of priceFields ?? []) {
      // Check if confirmed value exists
      const { data: confirmed } = await serviceClient
        .from("confirmed_values")
        .select("id")
        .eq("submission_id", submission.id)
        .eq("field_key", priceField.field_key)
        .maybeSingle();

      if (confirmed) continue; // Already confirmed — OK

      // Check if extraction has a low-confidence value
      const { data: extracted } = await serviceClient
        .from("extracted_values")
        .select("confidence_label")
        .eq("submission_id", submission.id)
        .eq("field_key", priceField.field_key)
        .maybeSingle();

      if (
        !extracted ||
        extracted.confidence_label === "low" ||
        extracted.confidence_label === "not_found" ||
        extracted.confidence_label === "conflicted"
      ) {
        const vendor = submission.vendors;
        blockingFields.push({
          submissionId: submission.id,
          vendorName: vendor?.company_name ?? "Unknown vendor",
          fieldKey: priceField.field_key,
          fieldLabel: priceField.label,
        });
      }
    }
  }

  if (blockingFields.length > 0) {
    return NextResponse.json(
      {
        error: "award_blocked",
        message: "Unconfirmed low-confidence price fields must be resolved before awarding.",
        unconfirmedLowConfidenceFields: blockingFields,
      },
      { status: 422 }
    );
  }

  // All clear — award the event
  await serviceClient
    .from("rfx_events")
    .update({ status: "awarded", awarded_at: new Date().toISOString(), approved_by: user.id })
    .eq("id", eventId);

  await logAudit({
    tenant_id: profile.tenant_id,
    event_id: eventId,
    actor_id: user.id,
    actor_type: "buyer",
    action: "rfx.awarded",
    entity_type: "rfx_event",
    entity_id: eventId,
  });

  return NextResponse.json({ data: { status: "awarded" } });
}
