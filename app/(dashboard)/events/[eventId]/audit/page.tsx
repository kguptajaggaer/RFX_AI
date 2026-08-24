import { createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { format } from "date-fns";

const ACTION_LABELS: Record<string, string> = {
  "rfx.created":   "RFx Created",
  "rfx.published": "RFx Published",
  "rfx.awarded":   "RFx Awarded",
  "rfx.cancelled": "RFx Cancelled",
  "vendor.invited":    "Vendor Invited",
  "vendor.submitted":  "Offer Submitted",
  "offer.extracted":   "Offer Extracted",
  "offer.confirmed":   "Value Confirmed",
  "offer.disqualified":"Offer Disqualified",
};

const ACTION_COLORS: Record<string, string> = {
  "rfx.created":   "bg-blue-100 text-blue-700",
  "rfx.published": "bg-green-100 text-green-700",
  "rfx.awarded":   "bg-purple-100 text-purple-700",
  "rfx.cancelled": "bg-red-100 text-red-600",
  "vendor.invited":   "bg-yellow-100 text-yellow-700",
  "vendor.submitted": "bg-blue-50 text-blue-600",
};

export default async function AuditPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const supabase = createServiceClient();

  const { data: event } = await supabase
    .from("rfx_events")
    .select("id")
    .eq("id", eventId)
    .single();

  if (!event) notFound();

  const { data: logs } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">Audit Log</h2>
        <p className="text-sm text-slate-400">
          {logs?.length ?? 0} entries — all activity related to this event
        </p>
      </div>

      {!logs || logs.length === 0 ? (
        <div className="rounded-xl bg-white p-10 shadow-sm ring-1 ring-slate-200 text-center">
          <p className="text-4xl mb-3">📋</p>
          <h3 className="font-semibold text-slate-900">No audit entries yet</h3>
          <p className="mt-1 text-sm text-slate-400">
            Actions taken on this event will be recorded here.
          </p>
        </div>
      ) : (
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-medium uppercase tracking-wide text-slate-400">
                <th className="px-5 py-2 text-left">Time</th>
                <th className="px-5 py-2 text-left">Action</th>
                <th className="px-5 py-2 text-left">Actor</th>
                <th className="px-5 py-2 text-left">Entity</th>
                <th className="px-5 py-2 text-left">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-5 py-3 text-xs text-slate-400 whitespace-nowrap">
                    {format(new Date(log.created_at), "dd MMM yyyy, HH:mm:ss")}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        ACTION_COLORS[log.action] ?? "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {ACTION_LABELS[log.action] ?? log.action}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-500 font-mono">
                    {log.actor_type ?? "system"}
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-400">
                    <span className="capitalize">{log.entity_type?.replace(/_/g, " ") ?? "—"}</span>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-400 max-w-xs truncate">
                    {log.new_value
                      ? JSON.stringify(log.new_value).substring(0, 80)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
