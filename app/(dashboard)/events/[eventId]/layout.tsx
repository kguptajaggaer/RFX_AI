import { createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { EventTabs } from "@/components/events/EventTabs";

const STATUS_COLORS: Record<string, string> = {
  draft:      "bg-slate-100 text-slate-600",
  in_review:  "bg-yellow-100 text-yellow-700",
  approved:   "bg-blue-100 text-blue-700",
  published:  "bg-green-100 text-green-700",
  closed:     "bg-orange-100 text-orange-700",
  awarded:    "bg-purple-100 text-purple-700",
  cancelled:  "bg-red-100 text-red-600",
};

export default async function EventLayout({
  params,
  children,
}: {
  params: Promise<{ eventId: string }>;
  children: React.ReactNode;
}) {
  const { eventId } = await params;
  const supabase = createServiceClient();

  const { data: event } = await supabase
    .from("rfx_events")
    .select("id, title, event_type, status, submission_deadline")
    .eq("id", eventId)
    .single();

  if (!event) notFound();

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-4 text-sm text-slate-400">
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
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                STATUS_COLORS[event.status] ?? "bg-slate-100 text-slate-600"
              }`}
            >
              {event.status.replace(/_/g, " ")}
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">{event.title}</h1>
          {event.submission_deadline && (
            <p className="mt-1 text-sm text-slate-400">
              Deadline:{" "}
              {new Date(event.submission_deadline).toLocaleString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>

        <div className="flex gap-2">
          {(event.status === "draft" || event.status === "approved") && (
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

      {/* Tab navigation */}
      <EventTabs eventId={eventId} />

      {/* Page content */}
      {children}
    </div>
  );
}
