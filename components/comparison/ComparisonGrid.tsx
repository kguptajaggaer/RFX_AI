"use client";

import { useState } from "react";
import type { RFxSchemaField, ConfirmedValue, ExtractedValue } from "@/types/index";
import { CONFIDENCE_COLORS, CONFIDENCE_LABELS } from "@/lib/extraction/confidence";
import type { ConfidenceLabel } from "@/lib/extraction/confidence";
import { useRouter } from "next/navigation";

interface SubmissionRow {
  id: string;
  vendor_id: string;
  status: string;
  vendors?: { id: string; company_name: string } | null;
}

interface Props {
  eventId: string;
  eventStatus: string;
  fields: RFxSchemaField[];
  submissions: SubmissionRow[];
  confirmed: Pick<ConfirmedValue, "submission_id" | "field_key" | "confirmed_value" | "is_corrected" | "extracted_value_id">[];
  extracted: Pick<ExtractedValue, "id" | "submission_id" | "field_key" | "confidence_label" | "source_ref">[];
  awardBlockedFields: string[];
}

export default function ComparisonGrid({
  eventId,
  eventStatus,
  fields,
  submissions,
  confirmed,
  extracted,
  awardBlockedFields,
}: Props) {
  const router = useRouter();
  const [awarding, setAwarding] = useState(false);
  const [awardError, setAwardError] = useState<string | null>(null);

  // Build lookup maps
  const confirmedMap: Record<string, Record<string, typeof confirmed[0]>> = {};
  for (const cv of confirmed) {
    if (!confirmedMap[cv.submission_id]) confirmedMap[cv.submission_id] = {};
    confirmedMap[cv.submission_id][cv.field_key] = cv;
  }

  const extractedMap: Record<string, Record<string, typeof extracted[0]>> = {};
  for (const ev of extracted) {
    if (!extractedMap[ev.submission_id]) extractedMap[ev.submission_id] = {};
    extractedMap[ev.submission_id][ev.field_key] = ev;
  }

  // Group fields by section
  const sections = fields.reduce<Record<string, RFxSchemaField[]>>((acc, f) => {
    const s = f.section ?? "General";
    if (!acc[s]) acc[s] = [];
    acc[s].push(f);
    return acc;
  }, {});

  async function handleAward() {
    setAwarding(true);
    setAwardError(null);

    const res = await fetch(`/api/events/${eventId}/award`, { method: "POST" });
    const json = await res.json();

    if (res.ok) {
      router.refresh();
    } else {
      setAwardError(json.message ?? "Award failed");
    }
    setAwarding(false);
  }

  function formatValue(value: unknown): string {
    if (value === null || value === undefined) return "—";
    if (typeof value === "object" && value !== null) {
      const v = value as Record<string, unknown>;
      if (v.value !== undefined && v.currency) return `${v.currency} ${v.value}`;
      if (v.value !== undefined) return String(v.value);
      return JSON.stringify(value);
    }
    return String(value);
  }

  return (
    <div>
      {/* Award button */}
      {eventStatus === "closed" && (
        <div className="mb-4">
          {awardBlockedFields.length > 0 ? (
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200">
              <strong>Award blocked.</strong> Resolve unconfirmed low-confidence price fields before awarding:
              <ul className="mt-2 list-disc list-inside">
                {awardBlockedFields.map((f) => (
                  <li key={f}>{fields.find((ff) => ff.field_key === f)?.label ?? f}</li>
                ))}
              </ul>
            </div>
          ) : (
            <button
              onClick={handleAward}
              disabled={awarding}
              className="rounded-lg bg-purple-600 px-5 py-2.5 font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {awarding ? "Processing…" : "Proceed to Award →"}
            </button>
          )}
          {awardError && (
            <p className="mt-2 text-sm text-red-600">{awardError}</p>
          )}
        </div>
      )}

      {eventStatus === "awarded" && (
        <div className="mb-4 rounded-lg bg-purple-50 p-4 text-sm font-semibold text-purple-700 ring-1 ring-purple-200">
          🏆 This event has been awarded.
        </div>
      )}

      {/* Grid */}
      <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400 min-w-48">
                Field
              </th>
              {submissions.map((sub) => {
                const vendor = (sub as { vendors?: { company_name: string } | null }).vendors;
                return (
                  <th
                    key={sub.id}
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-700 min-w-40"
                  >
                    {vendor?.company_name ?? "—"}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {Object.entries(sections).map(([section, sectionFields]) => (
              <>
                <tr key={`section-${section}`} className="bg-slate-50">
                  <td
                    colSpan={submissions.length + 1}
                    className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400"
                  >
                    {section}
                  </td>
                </tr>
                {sectionFields.map((field) => {
                  const isBlocking = awardBlockedFields.includes(field.field_key);
                  return (
                    <tr
                      key={field.field_key}
                      className={`border-b border-slate-50 ${isBlocking ? "bg-red-50" : "hover:bg-slate-50"}`}
                    >
                      {/* Field label */}
                      <td className="sticky left-0 bg-inherit px-4 py-3">
                        <div className="font-medium text-slate-800">{field.label}</div>
                        <div className="text-xs text-slate-400">
                          {field.data_type}
                          {field.is_price_field && " · 💰 price"}
                          {field.required && " · required"}
                        </div>
                      </td>

                      {/* Vendor cells */}
                      {submissions.map((sub) => {
                        const cv = confirmedMap[sub.id]?.[field.field_key];
                        const ev = extractedMap[sub.id]?.[field.field_key];

                        if (cv) {
                          return (
                            <td key={sub.id} className="px-4 py-3">
                              <div className="font-medium text-slate-900">
                                {formatValue(cv.confirmed_value)}
                              </div>
                              <div className="mt-0.5 flex items-center gap-1.5">
                                {cv.is_corrected && (
                                  <span className="text-xs text-amber-600">✏️ corrected</span>
                                )}
                                {ev && (
                                  <span
                                    className={`rounded-full border px-1.5 py-0.5 text-xs ${CONFIDENCE_COLORS[ev.confidence_label as ConfidenceLabel] ?? ""}`}
                                    title={CONFIDENCE_LABELS[ev.confidence_label as ConfidenceLabel]}
                                  >
                                    {ev.confidence_label}
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        }

                        if (ev) {
                          return (
                            <td key={sub.id} className="px-4 py-3">
                              <span className="text-slate-400 italic text-xs">Unconfirmed</span>
                              <div className="mt-0.5">
                                <span
                                  className={`rounded-full border px-1.5 py-0.5 text-xs ${CONFIDENCE_COLORS[ev.confidence_label as ConfidenceLabel] ?? ""}`}
                                >
                                  {ev.confidence_label}
                                </span>
                              </div>
                            </td>
                          );
                        }

                        return (
                          <td key={sub.id} className="px-4 py-3 text-slate-300 text-xs">
                            —
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
