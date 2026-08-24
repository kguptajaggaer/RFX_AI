import { createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";

const DATA_TYPE_COLORS: Record<string, string> = {
  text:         "bg-slate-100 text-slate-600",
  textarea:     "bg-slate-100 text-slate-600",
  number:       "bg-blue-50 text-blue-700",
  currency:     "bg-green-50 text-green-700",
  date:         "bg-yellow-50 text-yellow-700",
  boolean:      "bg-purple-50 text-purple-700",
  select:       "bg-orange-50 text-orange-700",
  multi_select: "bg-orange-50 text-orange-700",
};

export default async function SchemaPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const supabase = createServiceClient();

  const { data: event } = await supabase
    .from("rfx_events")
    .select("id, status")
    .eq("id", eventId)
    .single();

  if (!event) notFound();

  const { data: fields } = await supabase
    .from("rfx_schema_fields")
    .select("*")
    .eq("event_id", eventId)
    .order("display_order");

  const sections = Array.from(new Set((fields ?? []).map((f) => f.section ?? "General")));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Schema Fields</h2>
          <p className="text-sm text-slate-400">
            {fields?.length ?? 0} field{(fields?.length ?? 0) !== 1 ? "s" : ""} defining what vendors must provide
          </p>
        </div>
        <Link
          href={`/events/new?refine=${eventId}`}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          + Refine with AI
        </Link>
      </div>

      {!fields || fields.length === 0 ? (
        <div className="rounded-xl bg-white p-10 shadow-sm ring-1 ring-slate-200 text-center">
          <p className="text-4xl mb-3">🗂️</p>
          <h3 className="font-semibold text-slate-900">No schema fields yet</h3>
          <p className="mt-1 text-sm text-slate-400">
            Schema fields were not generated. Go back and refine the RFx with the AI co-pilot.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {sections.map((section) => {
            const sectionFields = (fields ?? []).filter(
              (f) => (f.section ?? "General") === section
            );
            return (
              <div key={section} className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200 px-5 py-3">
                  <h3 className="text-sm font-semibold text-slate-700">{section}</h3>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-medium uppercase tracking-wide text-slate-400">
                      <th className="px-5 py-2 text-left w-8">#</th>
                      <th className="px-5 py-2 text-left">Label</th>
                      <th className="px-5 py-2 text-left">Key</th>
                      <th className="px-5 py-2 text-left">Type</th>
                      <th className="px-5 py-2 text-left">Required</th>
                      <th className="px-5 py-2 text-left">Price Field</th>
                      <th className="px-5 py-2 text-left">Help Text</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sectionFields.map((field, idx) => (
                      <tr key={field.id} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="px-5 py-3 text-slate-400 text-xs">{idx + 1}</td>
                        <td className="px-5 py-3 font-medium text-slate-900">{field.label}</td>
                        <td className="px-5 py-3 font-mono text-xs text-slate-500">{field.field_key}</td>
                        <td className="px-5 py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              DATA_TYPE_COLORS[field.data_type] ?? "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {field.data_type}
                            {field.currency_code ? ` (${field.currency_code})` : ""}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          {field.required ? (
                            <span className="text-red-500 font-bold">✓</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          {field.is_price_field ? (
                            <span className="text-green-600 font-bold">$</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-slate-400 text-xs max-w-xs truncate">
                          {field.help_text ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
