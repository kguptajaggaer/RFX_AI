import { createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const supabase = createServiceClient();

  const { data: event } = await supabase
    .from("rfx_events")
    .select("*")
    .eq("id", eventId)
    .single();

  if (!event) notFound();

  type SubmissionRow = {
    id: string;
    status: string;
    extraction_status: string;
    is_late: boolean;
    submitted_at: string;
    vendors?: { company_name: string } | null;
  };

  const [{ data: fields }, rawSubs, rawInvs] = await Promise.all([
    supabase
      .from("rfx_schema_fields")
      .select("id")
      .eq("event_id", eventId),
    supabase
      .from("offer_submissions")
      .select("id, status, extraction_status, is_late, submitted_at, vendors(company_name)")
      .eq("event_id", eventId),
    supabase
      .from("vendor_invitations")
      .select("id")
      .eq("event_id", eventId),
  ]);

  const submissions = rawSubs.data as SubmissionRow[] | null;
  const invitations = rawInvs.data;

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Stats row */}
      <div className="col-span-3 grid grid-cols-4 gap-4">
        {[
          { label: "Schema Fields",  value: fields?.length ?? 0 },
          { label: "Vendors Invited", value: invitations?.length ?? 0 },
          { label: "Offers Received", value: submissions?.length ?? 0 },
          {
            label: "Extracted",
            value:
              submissions?.filter((s) => s.extraction_status === "completed")
                .length ?? 0,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
          >
            <p className="text-xs text-slate-400">{stat.label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Description */}
      {event.description && (
        <div className="col-span-2 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Description
          </h3>
          <p className="text-sm text-slate-700">{event.description}</p>
        </div>
      )}

      {/* Background */}
      {event.background && !event.description && (
        <div className="col-span-2 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Background
          </h3>
          <p className="text-sm text-slate-700">{event.background}</p>
        </div>
      )}

      {/* Key Dates */}
      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Key Dates
        </h3>
        <div className="space-y-2 text-sm">
          {[
            { label: "Submission Deadline", val: event.submission_deadline },
            { label: "Q&A Deadline",        val: event.questions_deadline },
            { label: "Award Date",          val: event.award_date },
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
          {!event.submission_deadline && !event.questions_deadline && !event.award_date && (
            <p className="text-slate-400 text-xs">No dates set</p>
          )}
        </div>
      </div>

      {/* Evaluation Criteria */}
      {Array.isArray(event.evaluation_criteria) && event.evaluation_criteria.length > 0 && (
        <div className="col-span-3 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Evaluation Criteria
          </h3>
          <div className="space-y-2">
            {(event.evaluation_criteria as Array<{ criterion: string; weight: number; description?: string }>).map((c) => (
              <div key={c.criterion} className="flex items-start justify-between text-sm">
                <div>
                  <span className="font-medium text-slate-900">{c.criterion}</span>
                  {c.description && (
                    <p className="text-slate-400 text-xs mt-0.5">{c.description}</p>
                  )}
                </div>
                <span className="ml-4 shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                  {c.weight}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent submissions */}
      {submissions && submissions.length > 0 && (
        <div className="col-span-3 rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-200 px-5 py-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Recent Submissions</h3>
            <Link href={`/events/${eventId}/submissions`} className="text-xs text-blue-600 hover:underline">
              View all →
            </Link>
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
                const vendor = sub.vendors;
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

      {/* Empty state */}
      {(!submissions || submissions.length === 0) && (!invitations || invitations.length === 0) && (
        <div className="col-span-3 rounded-xl bg-white p-10 shadow-sm ring-1 ring-slate-200 text-center">
          <p className="text-4xl mb-3">📋</p>
          <h3 className="font-semibold text-slate-900">No activity yet</h3>
          <p className="mt-1 text-sm text-slate-400">
            Dispatch this RFx to vendors to start receiving offers.
          </p>
          <Link
            href={`/events/${eventId}/vendors`}
            className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Dispatch to Vendors →
          </Link>
        </div>
      )}
    </div>
  );
}
