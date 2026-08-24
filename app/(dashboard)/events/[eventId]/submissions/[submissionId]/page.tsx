import { createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";

const CONFIDENCE_COLORS: Record<string, string> = {
  high:       "bg-green-50 text-green-700",
  medium:     "bg-yellow-50 text-yellow-700",
  low:        "bg-red-50 text-red-600",
  not_found:  "bg-slate-100 text-slate-500",
  ambiguous:  "bg-orange-50 text-orange-600",
  conflicted: "bg-red-100 text-red-700",
};

export default async function SubmissionDetailPage({
  params,
}: {
  params: Promise<{ eventId: string; submissionId: string }>;
}) {
  const { eventId, submissionId } = await params;
  const supabase = createServiceClient();

  type SubDetail = {
    id: string;
    status: string;
    extraction_status: string;
    is_late: boolean;
    submitted_at: string;
    submission_channel: string | null;
    email_subject: string | null;
    vendors: { company_name: string; primary_email: string } | null;
  };

  const { data: rawSub } = await supabase
    .from("offer_submissions")
    .select(
      "id, status, extraction_status, is_late, submitted_at, submission_channel, email_subject, vendors(company_name, primary_email)"
    )
    .eq("id", submissionId)
    .eq("event_id", eventId)
    .single();

  if (!rawSub) notFound();
  const sub = rawSub as SubDetail;

  const [{ data: fields }, { data: extracted }, { data: confirmed }, { data: attachments }] =
    await Promise.all([
      supabase
        .from("rfx_schema_fields")
        .select("field_key, label, data_type, is_price_field, display_order")
        .eq("event_id", eventId)
        .order("display_order"),
      supabase
        .from("extracted_values")
        .select(
          "field_key, raw_text, normalized_value, confidence_score, confidence_label, is_flagged, flag_reason"
        )
        .eq("submission_id", submissionId),
      supabase
        .from("confirmed_values")
        .select("field_key, confirmed_value, is_corrected")
        .eq("submission_id", submissionId),
      supabase
        .from("offer_attachments")
        .select("id, original_filename, mime_type, file_size_bytes, created_at")
        .eq("submission_id", submissionId),
    ]);

  const extractedMap = Object.fromEntries(
    (extracted ?? []).map((e) => [e.field_key, e])
  );
  const confirmedMap = Object.fromEntries(
    (confirmed ?? []).map((c) => [c.field_key, c])
  );

  return (
    <div className="space-y-6">
      <Link
        href={`/events/${eventId}/submissions`}
        className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-700"
      >
        ← All submissions
      </Link>

      {/* Header card */}
      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {sub.vendors?.company_name ?? "Unknown Vendor"}
            </h2>
            <p className="text-sm text-slate-400">{sub.vendors?.primary_email ?? ""}</p>
            {sub.email_subject && (
              <p className="mt-1 text-xs text-slate-400 italic">
                Subject: &ldquo;{sub.email_subject}&rdquo;
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 capitalize">
              {sub.status.replace(/_/g, " ")}
            </span>
            {sub.is_late && (
              <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-600">
                LATE
              </span>
            )}
          </div>
        </div>
        <div className="mt-3 flex gap-6 text-xs text-slate-400">
          <span>Received: {format(new Date(sub.submitted_at), "dd MMM yyyy, HH:mm")}</span>
          <span>Channel: {sub.submission_channel ?? "—"}</span>
          <span>
            Extraction:{" "}
            <strong className="text-slate-600 capitalize">
              {sub.extraction_status.replace(/_/g, " ")}
            </strong>
          </span>
        </div>
      </div>

      {/* Extracted values */}
      {fields && fields.length > 0 && (
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Extracted Values</h3>
            {sub.extraction_status === "pending" && (
              <span className="text-xs text-slate-400">
                Not extracted yet — go to Submissions tab and click ⚡ Extract
              </span>
            )}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-medium uppercase tracking-wide text-slate-400">
                <th className="px-5 py-2 text-left">Field</th>
                <th className="px-5 py-2 text-left">Extracted Value</th>
                <th className="px-5 py-2 text-left">Confidence</th>
                <th className="px-5 py-2 text-left">Confirmed</th>
                <th className="px-5 py-2 text-left">Flags</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field) => {
                const ext = extractedMap[field.field_key];
                const conf = confirmedMap[field.field_key];
                return (
                  <tr key={field.field_key} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-900">{field.label}</div>
                      {field.is_price_field && (
                        <span className="text-xs text-green-600">💰 price</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-700">
                      {ext
                        ? String(ext.normalized_value ?? ext.raw_text ?? "—")
                        : <span className="text-slate-300">Not extracted</span>}
                    </td>
                    <td className="px-5 py-3">
                      {ext ? (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CONFIDENCE_COLORS[ext.confidence_label] ?? "bg-slate-100 text-slate-600"}`}>
                          {ext.confidence_label}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-5 py-3">
                      {conf ? (
                        <span className="text-green-600 text-xs font-medium">
                          ✓ {String(conf.confirmed_value ?? "")}
                          {conf.is_corrected && " (corrected)"}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {ext?.is_flagged ? (
                        <span className="text-xs text-orange-600">⚠ {ext.flag_reason ?? "Flagged"}</span>
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Attachments */}
      {attachments && attachments.length > 0 && (
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-200 px-5 py-3">
            <h3 className="text-sm font-semibold text-slate-700">Attachments ({attachments.length})</h3>
          </div>
          <div className="divide-y divide-slate-50">
            {attachments.map((att) => (
              <div key={att.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{att.original_filename}</p>
                  <p className="text-xs text-slate-400">
                    {att.mime_type}
                    {att.file_size_bytes
                      ? ` · ${(att.file_size_bytes / 1024).toFixed(1)} KB`
                      : ""}
                  </p>
                </div>
                <p className="text-xs text-slate-400">
                  {format(new Date(att.created_at), "dd MMM, HH:mm")}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
