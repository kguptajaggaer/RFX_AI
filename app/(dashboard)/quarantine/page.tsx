import { createServiceClient } from "@/lib/supabase/server";
import QuarantineTable from "./QuarantineTable";

export default async function QuarantinePage() {
  const supabase = createServiceClient();

  const { data: allRows } = await supabase
    .from("email_quarantine")
    .select(
      "id, from_email, subject, body_preview, attachment_count, quarantine_reason, status, created_at, reviewed_at, reviewed_by"
    )
    .order("created_at", { ascending: false });

  const rows = allRows ?? [];
  const pending  = rows.filter((r) => r.status === "quarantined").length;
  const released = rows.filter((r) => r.status.startsWith("released")).length;
  const rejected = rows.filter((r) => r.status === "rejected").length;

  return (
    <div>
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Email Quarantine</h1>
        <p className="mt-1 text-sm text-slate-500">
          Inbound emails that couldn&apos;t be matched to an invitation. Review and release or reject each one.
        </p>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        {[
          { label: "Pending Review", value: pending,  accent: "text-yellow-600" },
          { label: "Released",       value: released, accent: "text-green-600"  },
          { label: "Rejected",       value: rejected, accent: "text-red-600"    },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
          >
            <p className="text-sm text-slate-500">{stat.label}</p>
            <p className={`mt-1 text-3xl font-bold ${stat.accent}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Info banner */}
      <div className="mb-6 flex items-start gap-3 rounded-xl bg-yellow-50 px-5 py-4 ring-1 ring-yellow-200">
        <span className="mt-0.5 text-lg">ℹ️</span>
        <div className="text-sm text-yellow-800">
          <strong>Release</strong> — marks the email as manually reviewed and creates an audit record.
          Go to the relevant event&apos;s Submissions tab to manually add the vendor&apos;s offer.{" "}
          <strong>Reject</strong> — permanently dismisses the email (no submission created).
        </div>
      </div>

      {/* Table */}
      <QuarantineTable rows={rows} />
    </div>
  );
}
