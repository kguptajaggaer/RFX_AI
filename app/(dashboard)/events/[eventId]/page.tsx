import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  in_review: "bg-yellow-100 text-yellow-700",
  approved: "bg-blue-100 text-blue-700",
  published: "bg-green-100 text-green-700",
  closed: "bg-orange-100 text-orange-700",
  awarded: "bg-purple-100 text-purple-700",
  cancelled: "bg-red-100 text-red-600",
};

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("rfx_events")
    .select("*")
    .eq("id", eventId)
    .single();

  if (!event) notFound();

  type SubmissionRow = { id: string; status: string; extraction_status: string; is_late: boolean; submitted_at: string; vendors?: { company_name: string } | null };
  type InvitationRow = { id: string; status: string; vendors?: { company_name: string; primary_email: string } | null };

  const [{ data: fields }, rawSubs, rawInvs] = await Promise.all([
    supabase
      .from("rfx_schema_fields")
      .select("*")
      .eq("event_id", eventId)
      .order("display_order"),
    supabase
      .from("offer_submissions")
      .select("id, status, extraction_status, is_late, submitted_at, vendors(company_name)")
      .eq("event_id", eventId),
    supabase
      .from("vendor_invitations")
      .select("id, status, vendors(company_name, primary_email)")
      .eq("event_id", eventId),
  ]);
  const submissions = rawSubs.data as SubmissionRow[] | null;
  const invitations = rawInvs.data as InvitationRow[] | null;

  const tabs = [
    { label: "Overview", href: `/events/${eventId}` },
    { label: "Schema Fields", href: `/events/${eventId}/schema` },
    { label: "Vendors", href: `/events/${eventId}/vendors` },
    { label: "Submissions", href: `/events/${eventId}/submissions` },
    { label: "Comparison", href: `/events/${eventId}/comparison` },
    { label: "Audit", href: `/events/${eventId}/audit` },
  ];

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-4 text-sm text-slate-400">
        <Link href="/" className="hover:text-slate-600">Dashboard</Link>
        {" / "}
        <Link href="/events" className="hover:text-slate-600">Events</Link>
        {" / "}
        <span className="text-slate-700">{event.title}</span>
      </div>

      {/* Event header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
              {event.event_type}
            </span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[event.status] ?? ""}`}>
              {event.status.replace("_", " ")}
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">{event.title}</h1>
          {event.submission_deadline && (
            <p className="mt-1 text-sm text-slate-400">
              Deadline: {format(new Date(event.submission_deadline), "dd MMM yyyy, HH:mm")}
            </p>
          )}
        </div>

        {/* Action buttons by status */}
        <div className="flex gap-2">
          {event.status === "draft" && (
            <Link
              href={`/events/${eventId}/vendors`}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Dispatch →
            </Link>
          )}
          {event.status === "closed" && (
            <Link
              href={`/events/${eventId}/comparison`}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700"
            >
              Compare &amp; Award →
            </Link>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 border-b border-slate-200">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-900 border-b-2 border-transparent hover:border-slate-300"
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Overview content */}
      <div className="grid grid-cols-3 gap-6">
        {/* Stats */}
        <div className="col-span-3 grid grid-cols-4 gap-4">
          {[
            { label: "Schema Fields", value: fields?.length ?? 0 },
            { label: "Vendors Invited", value: invitations?.length ?? 0 },
            { label: "Offers Received", value: submissions?.length ?? 0 },
            {
              label: "Extracted",
              value: submissions?.filter((s) => s.extraction_status === "completed").length ?? 0,
            },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <p className="text-xs text-slate-400">{stat.label}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Description */}
        {event.description && (
          <div className="col-span-2 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Description</h3>
            <p className="text-sm text-slate-700">{event.description}</p>
          </div>
        )}

        {/* Key dates */}
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Key Dates</h3>
          <div className="space-y-2 text-sm">
            {[
              { label: "Submission Deadline", val: event.submission_deadline },
              { label: "Q&A Deadline", val: event.questions_deadline },
              { label: "Award Date", val: event.award_date },
            ].map(
              (d) =>
                d.val && (
                  <div key={d.label} className="flex justify-between">
                    <span className="text-slate-400">{d.label}</span>
                    <span className="font-medium text-slate-900">
                      {format(new Date(d.val), "dd MMM yyyy")}
                    </span>
                  </div>
                )
            )}
          </div>
        </div>

        {/* Recent submissions */}
        {submissions && submissions.length > 0 && (
          <div className="col-span-3 rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="border-b border-slate-200 px-5 py-3">
              <h3 className="text-sm font-semibold text-slate-900">Recent Submissions</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-medium uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-2 text-left">Vendor</th>
                  <th className="px-5 py-2 text-left">Status</th>
                  <th className="px-5 py-2 text-left">Extraction</th>
                  <th className="px-5 py-2 text-left">Received</th>
                </tr>
              </thead>
              <tbody>
                {submissions.slice(0, 5).map((sub) => {
                  const vendor = (sub as { vendors?: { company_name: string } | null }).vendors;
                  return (
                    <tr key={sub.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <Link
                          href={`/events/${eventId}/submissions/${sub.id}`}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {vendor?.company_name ?? "—"}
                        </Link>
                        {sub.is_late && (
                          <span className="ml-2 text-xs text-orange-500">LATE</span>
                        )}
                      </td>
                      <td className="px-5 py-3 capitalize text-slate-500">{sub.status}</td>
                      <td className="px-5 py-3 capitalize text-slate-500">
                        {sub.extraction_status}
                      </td>
                      <td className="px-5 py-3 text-slate-400">
                        {format(new Date(sub.submitted_at), "dd MMM, HH:mm")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
