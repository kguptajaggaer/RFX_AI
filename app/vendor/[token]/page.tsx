import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { format } from "date-fns";
import VendorSubmitForm from "./VendorSubmitForm";

export default async function VendorPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createServiceClient();

  type InvitationPortal = {
    id: string; status: string; viewed_at: string | null; personal_message: string | null;
    rfx_events: { id: string; title: string; event_type: string; description: string | null; background: string | null; submission_deadline: string | null; questions_deadline: string | null } | null;
    vendors: { company_name: string } | null;
  };

  // Look up invitation — mark as viewed
  const { data: invitation } = await supabase
    .from("vendor_invitations")
    .select(
      "id, status, viewed_at, personal_message, rfx_events(id, title, event_type, description, background, submission_deadline, questions_deadline), vendors(company_name)"
    )
    .eq("invite_token", token)
    .single() as { data: InvitationPortal | null; error: unknown };

  if (!invitation) notFound();

  const event = invitation.rfx_events;
  const vendor = invitation.vendors;

  if (!event) notFound();

  // Mark as viewed (only first time)
  if (!invitation.viewed_at) {
    await supabase
      .from("vendor_invitations")
      .update({ viewed_at: new Date().toISOString(), status: "viewed" })
      .eq("id", invitation.id);
  }

  const isClosed =
    invitation.status === "submitted" || invitation.status === "declined";
  const isPastDeadline =
    event.submission_deadline && new Date() > new Date(event.submission_deadline);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <span className="text-sm font-bold text-white">R</span>
          </div>
          <span className="text-sm font-semibold text-slate-900">RFX AI Platform</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10 space-y-8">
        {/* Event card */}
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-start justify-between">
            <div>
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                {event.event_type}
              </span>
              <h1 className="mt-2 text-xl font-bold text-slate-900">{event.title}</h1>
              {vendor && (
                <p className="mt-1 text-sm text-slate-500">
                  Addressed to <strong>{vendor.company_name}</strong>
                </p>
              )}
            </div>
          </div>

          {invitation.personal_message && (
            <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
              {invitation.personal_message}
            </div>
          )}

          {event.description && (
            <p className="mt-4 text-sm text-slate-600">{event.description}</p>
          )}

          {event.background && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-blue-600">
                Background &amp; context
              </summary>
              <p className="mt-2 text-sm text-slate-600">{event.background}</p>
            </details>
          )}

          {/* Key dates */}
          <div className="mt-6 grid grid-cols-2 gap-3">
            {event.submission_deadline && (
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-400">Submission Deadline</p>
                <p className="mt-0.5 font-semibold text-slate-900">
                  {format(new Date(event.submission_deadline), "dd MMM yyyy, HH:mm")}
                </p>
              </div>
            )}
            {event.questions_deadline && (
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-400">Q&A Deadline</p>
                <p className="mt-0.5 font-semibold text-slate-900">
                  {format(new Date(event.questions_deadline), "dd MMM yyyy, HH:mm")}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Submission form / status */}
        {isClosed ? (
          <div className="rounded-xl bg-green-50 p-6 text-center ring-1 ring-green-200">
            <p className="text-4xl mb-2">✅</p>
            <h2 className="text-lg font-semibold text-green-800">Offer Submitted</h2>
            <p className="mt-1 text-sm text-green-600">
              Your offer has been received. The buyer will be in touch.
            </p>
          </div>
        ) : isPastDeadline ? (
          <div className="rounded-xl bg-orange-50 p-6 text-center ring-1 ring-orange-200">
            <p className="text-4xl mb-2">⏰</p>
            <h2 className="text-lg font-semibold text-orange-800">Submission Period Closed</h2>
            <p className="mt-1 text-sm text-orange-600">
              The submission deadline has passed. Contact the buyer if you believe this is in error.
            </p>
          </div>
        ) : (
          <VendorSubmitForm token={token} invitationId={invitation.id} />
        )}
      </main>
    </div>
  );
}
