import { createServiceClient } from "@/lib/supabase/server";

/** Exported so the confirm API route can call it without importing the full pipeline. */
export async function rebuildGridCachePublic(eventId: string, tenantId: string): Promise<void> {
  const supabase = createServiceClient();

  const [{ data: fields }, { data: submissions }, { data: confirmed }] = await Promise.all([
    supabase
      .from("rfx_schema_fields")
      .select("*")
      .eq("event_id", eventId)
      .order("display_order"),
    supabase
      .from("offer_submissions")
      .select("id, vendor_id, status, vendors(id, company_name), vendor_invitations(status)")
      .eq("event_id", eventId)
      .neq("status", "disqualified"),
    supabase.from("confirmed_values").select("*").eq("event_id", eventId),
  ]);

  if (!fields || !submissions) return;

  const confirmedMap: Record<string, Record<string, unknown>> = {};
  for (const cv of confirmed ?? []) {
    if (!confirmedMap[cv.submission_id]) confirmedMap[cv.submission_id] = {};
    confirmedMap[cv.submission_id][cv.field_key] = cv.confirmed_value;
  }

  const priceFields = fields.filter((f) => f.is_price_field);
  const blockingFields: string[] = [];

  const { data: lowConf } = await supabase
    .from("extracted_values")
    .select("submission_id, field_key, confidence_label")
    .eq("event_id", eventId)
    .in("confidence_label", ["low", "not_found", "conflicted"]);

  for (const ex of lowConf ?? []) {
    const isPriceField = priceFields.some((f) => f.field_key === ex.field_key);
    if (!isPriceField) continue;
    const isConfirmed = !!confirmedMap[ex.submission_id]?.[ex.field_key];
    if (!isConfirmed) blockingFields.push(ex.field_key);
  }

  await supabase.from("comparison_grid_cache").upsert({
    event_id: eventId,
    tenant_id: tenantId,
    grid_data: { fields, submissions, confirmedMap } as import("@/types/database").Json,
    has_unconfirmed_low_conf: blockingFields.length > 0,
    award_blocked_field_keys: [...new Set(blockingFields)],
    last_rebuilt_at: new Date().toISOString(),
  });
}
