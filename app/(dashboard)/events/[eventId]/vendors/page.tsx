import { createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { VendorDispatchForm } from "@/components/events/VendorDispatchForm";
import { format } from "date-fns";

const INV_STATUS_COLORS: Record<string, string> = {
  pending:  "bg-slate-100 text-slate-600",
  sent:     "bg-blue-50 text-blue-700",
  opened:   "bg-yellow-50 text-yellow-700",
  declined: "bg-red-50 text-red-600",
  submitted: "bg-green-50 text-green-700",
};

export default async function VendorsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const supabase = createServiceClient();

  const { data: event } = await supabase
    .from("rfx_events")
    .select("id, status, title")
    .eq("id", eventId)
    .single();

  if (!event) notFound();

  type InvRow = {
    id: string;
    status: string;
    sent_at: string | null;
    portal_url: string | null;
    vendors: { company_name: string; primary_email: string; contact_name: string | null } | null;
  };

  const { data: rawInvitations } = await supabase
    .from("vendor_invitations")
    .select("id, status, sent_at, portal_url, vendors(company_name, primary_email, contact_name)")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  const invitations = rawInvitations as InvRow[] | null;

  const canDispatch = event.status === "draft" || event.status === "approved" || event.status === "published";

  return (
    <div className="space-y-8">
      {/* Existing invitations */}
      {invitations && invitations.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">
            Invited Vendors ({invitations.length})
          </h2>
          <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-medium uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-2 text-left">Company</th>
                  <th className="px-5 py-2 text-left">Email</th>
                  <th className="px-5 py-2 text-left">Contact</th>
                  <th className="px-5 py-2 text-left">Status</th>
                  <th className="px-5 py-2 text-left">Sent</th>
                  <th className="px-5 py-2 text-left">Portal</th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-900">
                      {inv.vendors?.company_name ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-slate-500">{inv.vendors?.primary_email ?? "—"}</td>
                    <td className="px-5 py-3 text-slate-500">{inv.vendors?.contact_name ?? "—"}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          INV_STATUS_COLORS[inv.status] ?? "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-400">
                      {inv.sent_at ? format(new Date(inv.sent_at), "dd MMM, HH:mm") : "—"}
                    </td>
                    <td className="px-5 py-3">
                      {inv.portal_url ? (
                        <a
                          href={inv.portal_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Open portal ↗
                        </a>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dispatch form */}
      {canDispatch ? (
        <div>
          <h2 className="mb-1 text-lg font-semibold text-slate-900">
            {invitations && invitations.length > 0 ? "Invite More Vendors" : "Dispatch RFx to Vendors"}
          </h2>
          <p className="mb-4 text-sm text-slate-400">
            Each vendor receives a unique invitation link and reply-email address. They can submit via the portal or by replying to the email.
          </p>
          <VendorDispatchForm eventId={eventId} />
        </div>
      ) : (
        <div className="rounded-xl bg-slate-50 ring-1 ring-slate-200 p-6 text-center">
          <p className="text-slate-500 text-sm">
            Event is <strong>{event.status}</strong> — no further dispatches can be made.
          </p>
        </div>
      )}
    </div>
  );
}
