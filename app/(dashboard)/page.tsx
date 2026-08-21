import { createClient } from "@/lib/supabase/server";
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

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: events } = await supabase
    .from("rfx_events")
    .select("id, title, event_type, status, submission_deadline, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: counts } = await supabase
    .from("rfx_events")
    .select("status")
    .then(({ data }) => ({
      data: {
        active: data?.filter((e) => ["published", "approved"].includes(e.status)).length ?? 0,
        draft: data?.filter((e) => e.status === "draft").length ?? 0,
        total: data?.length ?? 0,
      },
    }));

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">Manage your sourcing events</p>
        </div>
        <Link
          href="/events/new"
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          + New RFx
        </Link>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        {[
          { label: "Total Events", value: counts?.total ?? 0 },
          { label: "Active", value: counts?.active ?? 0 },
          { label: "Drafts", value: counts?.draft ?? 0 },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">{stat.label}</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Events table */}
      <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="font-semibold text-slate-900">Recent Events</h2>
        </div>

        {events && events.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                <th className="px-6 py-3">Title</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Deadline</th>
                <th className="px-6 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr
                  key={event.id}
                  className="border-b border-slate-50 hover:bg-slate-50"
                >
                  <td className="px-6 py-4">
                    <Link
                      href={`/events/${event.id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {event.title}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-slate-500">{event.event_type}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[event.status] ?? "bg-gray-100 text-gray-600"}`}
                    >
                      {event.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {event.submission_deadline
                      ? format(new Date(event.submission_deadline), "dd MMM yyyy")
                      : "—"}
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {format(new Date(event.created_at), "dd MMM yyyy")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="px-6 py-16 text-center">
            <p className="text-slate-400">No events yet.</p>
            <Link
              href="/events/new"
              className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Create your first RFx
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
