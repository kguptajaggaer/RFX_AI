import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ComparisonGrid from "@/components/comparison/ComparisonGrid";

export default async function ComparisonPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("rfx_events")
    .select("id, title, status, submission_deadline")
    .eq("id", eventId)
    .single();

  if (!event) notFound();

  const isSealed =
    event.submission_deadline && new Date() < new Date(event.submission_deadline);

  if (isSealed && event.status !== "awarded") {
    const deadline = new Date(event.submission_deadline!);
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <p className="text-6xl mb-4">🔒</p>
        <h2 className="text-xl font-bold text-slate-900">Sealed Bid Period</h2>
        <p className="mt-2 text-sm text-slate-500">
          Offers are hidden until the submission deadline on{" "}
          <strong>
            {deadline.toLocaleDateString("en-US", {
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </strong>
          .
        </p>
      </div>
    );
  }

  // Load cached grid data
  const { data: cache } = await supabase
    .from("comparison_grid_cache")
    .select("*")
    .eq("event_id", eventId)
    .maybeSingle();

  // Load raw data if no cache
  const [{ data: fields }, { data: submissions }, { data: confirmed }, { data: extracted }] =
    await Promise.all([
      supabase
        .from("rfx_schema_fields")
        .select("*")
        .eq("event_id", eventId)
        .order("display_order"),
      supabase
        .from("offer_submissions")
        .select("id, vendor_id, status, vendors(id, company_name)")
        .eq("event_id", eventId)
        .neq("status", "disqualified"),
      supabase
        .from("confirmed_values")
        .select("submission_id, field_key, confirmed_value, is_corrected, extracted_value_id")
        .eq("event_id", eventId),
      supabase
        .from("extracted_values")
        .select("id, submission_id, field_key, confidence_label, source_ref")
        .eq("event_id", eventId),
    ]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Comparison Grid</h1>
          <p className="text-sm text-slate-400">{event.title}</p>
        </div>

        {cache?.award_blocked_field_keys && cache.award_blocked_field_keys.length > 0 && (
          <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 ring-1 ring-red-200">
            ⚠️ {cache.award_blocked_field_keys.length} field(s) blocking award
          </div>
        )}
      </div>

      <ComparisonGrid
        eventId={eventId}
        eventStatus={event.status}
        fields={fields ?? []}
        submissions={submissions ?? []}
        confirmed={confirmed ?? []}
        extracted={extracted ?? []}
        awardBlockedFields={cache?.award_blocked_field_keys ?? []}
      />
    </div>
  );
}
