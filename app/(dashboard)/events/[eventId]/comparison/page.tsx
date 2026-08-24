import { createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ComparisonGrid from "@/components/comparison/ComparisonGrid";
import { AIAnalysis } from "@/components/comparison/AIAnalysis";

export default async function ComparisonPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const supabase = createServiceClient();

  const { data: event } = await supabase
    .from("rfx_events")
    .select("id, title, status, submission_deadline")
    .eq("id", eventId)
    .single();

  if (!event) notFound();

  // No sealed-bid gate — analysis can run at any time
  const { data: cache } = await supabase
    .from("comparison_grid_cache")
    .select("*")
    .eq("event_id", eventId)
    .maybeSingle();

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
        .select("id, submission_id, field_key, normalized_value, raw_text, confidence_label, source_ref")
        .eq("event_id", eventId),
    ]);

  const hasData = submissions && submissions.length > 0;

  // Build per-submission field-value lookup (confirmed takes precedence over extracted)
  type ExtractedEntry = { value: unknown; confidence: string; raw: string | null };
  const extractedBySubmission: Record<string, Record<string, ExtractedEntry>> = {};
  for (const e of extracted ?? []) {
    if (!extractedBySubmission[e.submission_id]) extractedBySubmission[e.submission_id] = {};
    extractedBySubmission[e.submission_id][e.field_key] = {
      value: e.normalized_value,
      confidence: e.confidence_label,
      raw: e.raw_text ?? null,
    };
  }
  for (const c of confirmed ?? []) {
    if (!extractedBySubmission[c.submission_id]) extractedBySubmission[c.submission_id] = {};
    extractedBySubmission[c.submission_id][c.field_key] = {
      value: c.confirmed_value,
      confidence: "confirmed",
      raw: null,
    };
  }

  // Map submission_id → company name
  type SubRow = { id: string; vendor_id: string; status: string; vendors: { id: string; company_name: string } | null };
  const submissionNames: Record<string, string> = {};
  for (const s of (submissions as SubRow[] | null) ?? []) {
    submissionNames[s.id] = s.vendors?.company_name ?? "Unknown";
  }

  return (
    <div className="space-y-8">
      {/* AI Analysis — always accessible, re-runnable */}
      <div>
        <h2 className="mb-1 text-lg font-semibold text-slate-900">AI Vendor Ranking</h2>
        <p className="mb-4 text-sm text-slate-400">
          Runs anytime. Re-run after extracting more responses to update the ranking.
        </p>
        {!hasData ? (
          <div className="rounded-xl bg-slate-50 ring-1 ring-slate-200 p-6 text-center">
            <p className="text-slate-400 text-sm">
              No submissions yet — invite vendors and extract responses first.
            </p>
          </div>
        ) : (
          <AIAnalysis
            eventId={eventId}
            fields={fields ?? []}
            extractedBySubmission={extractedBySubmission}
            submissionNames={submissionNames}
          />
        )}
      </div>

      <div className="border-t border-slate-200" />

      {/* Full grid — all vendors */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">All Vendors — Field-by-Field</h2>
            <p className="text-sm text-slate-400">{(submissions ?? []).length} vendors · {(fields ?? []).length} fields</p>
          </div>
          {cache?.award_blocked_field_keys && cache.award_blocked_field_keys.length > 0 && (
            <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 ring-1 ring-red-200">
              ⚠️ {cache.award_blocked_field_keys.length} field(s) blocking award
            </div>
          )}
        </div>

        {!hasData ? (
          <div className="rounded-xl bg-white p-10 shadow-sm ring-1 ring-slate-200 text-center">
            <p className="text-4xl mb-3">📊</p>
            <h3 className="font-semibold text-slate-900">No submissions to compare</h3>
            <p className="mt-1 text-sm text-slate-400">Invite vendors and collect offers to see the grid.</p>
          </div>
        ) : (
          <ComparisonGrid
            eventId={eventId}
            eventStatus={event.status}
            fields={fields ?? []}
            submissions={submissions ?? []}
            confirmed={confirmed ?? []}
            extracted={extracted ?? []}
            awardBlockedFields={cache?.award_blocked_field_keys ?? []}
          />
        )}
      </div>
    </div>
  );
}
