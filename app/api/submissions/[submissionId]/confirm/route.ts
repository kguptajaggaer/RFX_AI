import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit/logger";
import { rebuildGridCachePublic } from "@/lib/extraction/gridCache";

interface ConfirmationInput {
  fieldKey: string;
  extractedValueId: string | null;
  confirmedValue: unknown;
  isCorrection: boolean;
  correctionNote?: string;
  originalExtractedVal?: unknown;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  const { submissionId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 403 });

  const { confirmations }: { confirmations: ConfirmationInput[] } = await request.json();

  const serviceClient = createServiceClient();

  // Validate submission belongs to this tenant
  const { data: submission } = await serviceClient
    .from("offer_submissions")
    .select("id, event_id, tenant_id")
    .eq("id", submissionId)
    .single();

  if (!submission || submission.tenant_id !== profile.tenant_id) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  const confirmed = [];

  for (const c of confirmations) {
    // Get old value for audit log
    const { data: existing } = await serviceClient
      .from("confirmed_values")
      .select("confirmed_value")
      .eq("submission_id", submissionId)
      .eq("field_key", c.fieldKey)
      .maybeSingle();

    const { data: row, error } = await serviceClient
      .from("confirmed_values")
      .upsert(
        {
          extracted_value_id: c.extractedValueId,
          submission_id: submissionId,
          tenant_id: profile.tenant_id,
          event_id: submission.event_id,
          field_key: c.fieldKey,
          confirmed_value: c.confirmedValue as import("@/types/database").Json,
          is_corrected: c.isCorrection,
          original_extracted_val: (c.originalExtractedVal ?? null) as import("@/types/database").Json,
          correction_note: c.correctionNote ?? null,
          confirmed_by: user.id,
          confirmed_at: new Date().toISOString(),
        },
        { onConflict: "submission_id,field_key" }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    confirmed.push(row);

    await logAudit({
      tenant_id: profile.tenant_id,
      event_id: submission.event_id,
      submission_id: submissionId,
      actor_id: user.id,
      actor_type: "buyer",
      action: c.isCorrection ? "value.corrected" : "value.confirmed",
      entity_type: "confirmed_value",
      entity_id: row?.id,
      old_value: existing?.confirmed_value ?? null,
      new_value: c.confirmedValue,
      metadata: c.correctionNote ? { note: c.correctionNote } : undefined,
    });
  }

  // Update submission status to under_review if all fields confirmed
  await serviceClient
    .from("offer_submissions")
    .update({ status: "under_review" })
    .eq("id", submissionId)
    .eq("status", "extracted");

  // Rebuild grid cache
  await rebuildGridCachePublic(submission.event_id, profile.tenant_id);

  // Check award-block status
  const { data: cache } = await serviceClient
    .from("comparison_grid_cache")
    .select("award_blocked_field_keys, has_unconfirmed_low_conf")
    .eq("event_id", submission.event_id)
    .single();

  return NextResponse.json({
    data: {
      confirmed,
      awardBlocked: (cache?.award_blocked_field_keys?.length ?? 0) > 0,
      blockingFieldKeys: cache?.award_blocked_field_keys ?? [],
    },
  });
}
