"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";

type QuarantineRow = {
  id: string;
  from_email: string;
  subject: string | null;
  body_preview: string | null;
  attachment_count: number;
  quarantine_reason: string;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

const REASON_LABELS: Record<string, { label: string; color: string }> = {
  sender_mismatch:  { label: "Sender Mismatch",   color: "bg-orange-100 text-orange-700" },
  token_not_found:  { label: "Token Not Found",    color: "bg-red-100 text-red-700" },
  token_expired:    { label: "Token Expired",      color: "bg-red-100 text-red-700" },
  duplicate:        { label: "Duplicate",           color: "bg-yellow-100 text-yellow-700" },
  event_closed:     { label: "Event Closed",        color: "bg-slate-100 text-slate-600" },
  late_submission:  { label: "Late Submission",     color: "bg-orange-100 text-orange-700" },
  spam_detected:    { label: "Spam Detected",       color: "bg-red-100 text-red-700" },
};

const STATUS_COLORS: Record<string, string> = {
  quarantined:            "bg-yellow-100 text-yellow-700",
  released_as_submission: "bg-green-100 text-green-700",
  released_as_manual:     "bg-blue-100 text-blue-700",
  rejected:               "bg-red-100 text-red-600",
};

export default function QuarantineTable({ rows }: { rows: QuarantineRow[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function act(id: string, action: "release" | "reject") {
    setLoading(id + action);
    await fetch(`/api/quarantine/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setLoading(null);
    router.refresh();
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200 px-6 py-20 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
          <span className="text-3xl">✅</span>
        </div>
        <h3 className="text-base font-semibold text-slate-900">Queue is clear</h3>
        <p className="mt-1 text-sm text-slate-400">
          No emails awaiting review. Quarantined inbound emails will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
            <th className="px-6 py-3">From</th>
            <th className="px-6 py-3">Subject</th>
            <th className="px-6 py-3">Reason</th>
            <th className="px-6 py-3">Status</th>
            <th className="px-6 py-3">Files</th>
            <th className="px-6 py-3">Received</th>
            <th className="px-6 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isPending = row.status === "quarantined";
            const reason = REASON_LABELS[row.quarantine_reason] ?? { label: row.quarantine_reason, color: "bg-slate-100 text-slate-600" };
            return (
              <>
                <tr
                  key={row.id}
                  className="border-b border-slate-50 last:border-0 hover:bg-slate-50 cursor-pointer"
                  onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                >
                  <td className="px-6 py-4 font-mono text-xs text-slate-700">{row.from_email}</td>
                  <td className="px-6 py-4 text-slate-700 max-w-xs truncate">
                    {row.subject ?? <span className="text-slate-400 italic">No subject</span>}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${reason.color}`}>
                      {reason.label}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[row.status] ?? "bg-slate-100 text-slate-600"}`}>
                      {row.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {row.attachment_count > 0 ? `📎 ${row.attachment_count}` : "—"}
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {format(new Date(row.created_at), "dd MMM yyyy, HH:mm")}
                  </td>
                  <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                    {isPending ? (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => act(row.id, "release")}
                          disabled={!!loading}
                          className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          {loading === row.id + "release" ? "…" : "Release"}
                        </button>
                        <button
                          onClick={() => act(row.id, "reject")}
                          disabled={!!loading}
                          className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 ring-1 ring-red-200 hover:bg-red-100 disabled:opacity-50"
                        >
                          {loading === row.id + "reject" ? "…" : "Reject"}
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">
                        {row.reviewed_at ? format(new Date(row.reviewed_at), "dd MMM HH:mm") : "Reviewed"}
                      </span>
                    )}
                  </td>
                </tr>
                {expanded === row.id && row.body_preview && (
                  <tr key={row.id + "-exp"} className="bg-slate-50">
                    <td colSpan={7} className="px-6 py-3">
                      <p className="text-xs font-medium text-slate-500 mb-1">Email preview:</p>
                      <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono bg-white rounded-lg p-3 ring-1 ring-slate-200 max-h-40 overflow-y-auto">
                        {row.body_preview}
                      </pre>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
