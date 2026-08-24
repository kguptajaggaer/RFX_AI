import { createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SubmissionsList } from "@/components/events/SubmissionsList";

export default async function SubmissionsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const supabase = createServiceClient();

  const { data: event } = await supabase
    .from("rfx_events")
    .select("id, status")
    .eq("id", eventId)
    .single();

  if (!event) notFound();

  type SubRow = {
    id: string;
    status: string;
    extraction_status: string;
    is_late: boolean;
    submitted_at: string;
    submission_channel: string | null;
    email_body_text: string | null;
    vendors: { company_name: string; primary_email: string } | null;
    offer_attachments: { id: string; original_filename: string; mime_type: string; file_size_bytes: number }[];
  };

  const [{ data: rawSubs }, { data: fields }] = await Promise.all([
    supabase
      .from("offer_submissions")
      .select(
        "id, status, extraction_status, is_late, submitted_at, submission_channel, email_body_text, vendors(company_name, primary_email), offer_attachments(id, original_filename, mime_type, file_size_bytes)"
      )
      .eq("event_id", eventId)
      .order("submitted_at", { ascending: false }),
    supabase
      .from("rfx_schema_fields")
      .select("field_key, label, data_type, is_price_field, required, section")
      .eq("event_id", eventId)
      .order("display_order"),
  ]);

  const submissions = rawSubs as SubRow[] | null;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Submissions</h2>
          <p className="text-sm text-slate-400">
            {submissions?.length ?? 0} offer{(submissions?.length ?? 0) !== 1 ? "s" : ""} received
            {fields && fields.length > 0 && ` · ${fields.length} schema fields to extract`}
          </p>
        </div>
        {submissions && submissions.length > 0 && (
          <Link
            href={`/events/${eventId}/comparison`}
            className="rounded-lg border border-purple-200 px-4 py-2 text-sm font-semibold text-purple-700 hover:bg-purple-50"
          >
            Compare Vendors →
          </Link>
        )}
      </div>

      {!submissions || submissions.length === 0 ? (
        <div className="rounded-xl bg-white p-10 shadow-sm ring-1 ring-slate-200 text-center">
          <p className="text-4xl mb-3">📥</p>
          <h3 className="font-semibold text-slate-900">No submissions yet</h3>
          <p className="mt-1 text-sm text-slate-400">
            Submissions appear here once vendors respond. You can also dispatch to vendors first.
          </p>
          <Link
            href={`/events/${eventId}/vendors`}
            className="mt-4 inline-block text-sm text-blue-600 hover:underline"
          >
            Go to Vendors to Dispatch →
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-4 rounded-xl bg-blue-50 ring-1 ring-blue-200 p-4 text-sm text-blue-800">
            <strong>How to extract:</strong> Click <strong>⚡ Extract &amp; Analyze</strong> on any row.
            You can paste the vendor&apos;s text <em>or</em> upload a document (PDF, Word, Excel) — the AI maps it to your RFQ fields automatically.
            Once confident, click <strong>Confirm values</strong> to add them to the Comparison grid.
          </div>
          <SubmissionsList
            eventId={eventId}
            submissions={submissions}
            fields={fields ?? []}
          />
        </>
      )}
    </div>
  );
}
