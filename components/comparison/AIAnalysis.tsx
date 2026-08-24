"use client";

import { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SchemaField {
  field_key: string;
  label: string;
  data_type: string;
  is_price_field: boolean;
  required: boolean;
  section: string | null;
}

type ExtractedEntry = { value: unknown; confidence: string; raw: string | null };

interface VendorRank {
  rank: number;
  companyName: string;
  submissionId: string;
  score: number;
  badge: string;
  rationale: string;
  strengths: string[];
  risks: string[];
  keyMetrics: Record<string, string>;
}

interface AnalysisResult {
  summary: string;
  top3: VendorRank[];
  recommendation: string;
}

interface Props {
  eventId: string;
  fields: SchemaField[];
  extractedBySubmission: Record<string, Record<string, ExtractedEntry>>;
  submissionNames: Record<string, string>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const RANK_STYLES = [
  {
    ring: "ring-yellow-400",
    bg: "bg-yellow-50",
    badgeCls: "bg-yellow-500 text-white",
    headerBg: "bg-yellow-500",
    medal: "🥇",
    label: "1st Place",
  },
  {
    ring: "ring-slate-300",
    bg: "bg-slate-50",
    badgeCls: "bg-slate-500 text-white",
    headerBg: "bg-slate-500",
    medal: "🥈",
    label: "2nd Place",
  },
  {
    ring: "ring-orange-300",
    bg: "bg-orange-50",
    badgeCls: "bg-orange-500 text-white",
    headerBg: "bg-orange-500",
    medal: "🥉",
    label: "3rd Place",
  },
];

const CONF_DOT: Record<string, string> = {
  high:      "bg-green-500",
  medium:    "bg-yellow-400",
  low:       "bg-red-400",
  not_found: "bg-slate-200",
  confirmed: "bg-blue-500",
};

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (o.value !== undefined && o.currency) return `${o.currency} ${o.value}`;
    if (o.value !== undefined) return String(o.value);
    return JSON.stringify(v);
  }
  return String(v);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AIAnalysis({
  eventId,
  fields,
  extractedBySubmission,
  submissionNames,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  async function runAnalysis() {
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/events/${eventId}/analyze`, { method: "POST" });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Analysis failed");
    } else {
      setAnalysis(data.data as AnalysisResult);
    }
    setLoading(false);
  }

  return (
    <div className="space-y-6">

      {/* ── Trigger / Re-run bar ── */}
      <div className="flex items-center gap-4">
        <button
          onClick={runAnalysis}
          disabled={loading}
          className={`inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed ${
            analysis
              ? "bg-purple-500 hover:bg-purple-600"
              : "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          }`}
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Analysing submissions…
            </>
          ) : analysis ? (
            "↺ Re-run AI Analysis"
          ) : (
            "🚀 Run AI Analysis"
          )}
        </button>
        {!analysis && !loading && (
          <p className="text-sm text-slate-400">
            AI evaluates all extracted vendor data and ranks the top 3 with reasoning.
          </p>
        )}
        {analysis && !loading && (
          <p className="text-xs text-slate-400">Results are not saved — re-run any time to refresh.</p>
        )}
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="rounded-lg bg-red-50 ring-1 ring-red-200 p-4 text-sm text-red-700">
          <p className="font-semibold">❌ {error}</p>
          {error.toLowerCase().includes("extract") && (
            <p className="mt-1 text-xs">
              Go to the <strong>Submissions</strong> tab, click <strong>⚡ Extract &amp; Analyze</strong> on each vendor, then re-run.
            </p>
          )}
        </div>
      )}

      {analysis && (
        <div className="space-y-8">

          {/* ── Executive Summary ── */}
          <div className="rounded-xl bg-white ring-1 ring-slate-200 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
              Executive Summary
            </p>
            <p className="text-sm text-slate-700 leading-relaxed">{analysis.summary}</p>
          </div>

          {/* ── Top 3 Rank Cards ── */}
          <div>
            <h3 className="text-sm font-semibold text-slate-600 mb-3 uppercase tracking-wide">
              Top {analysis.top3.length} Vendors
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {analysis.top3.map((vendor) => {
                const s = RANK_STYLES[(vendor.rank - 1) % 3];
                return (
                  <div
                    key={vendor.submissionId}
                    className={`rounded-xl bg-white ring-2 ${s.ring} flex flex-col overflow-hidden`}
                  >
                    {/* Coloured header */}
                    <div className={`${s.headerBg} px-4 py-3 flex items-center gap-2`}>
                      <span className="text-xl">{s.medal}</span>
                      <div className="min-w-0">
                        <div className="font-bold text-white truncate">{vendor.companyName}</div>
                        <div className="text-xs text-white/80">{s.label}</div>
                      </div>
                      <div className="ml-auto text-right">
                        <div className="text-2xl font-extrabold text-white">{vendor.score}</div>
                        <div className="text-xs text-white/70">/ 100</div>
                      </div>
                    </div>

                    {/* Body */}
                    <div className="flex-1 p-4 space-y-3">
                      {/* Score bar */}
                      <div className="h-1.5 rounded-full bg-slate-100">
                        <div
                          className="h-1.5 rounded-full bg-blue-500 transition-all duration-700"
                          style={{ width: `${vendor.score}%` }}
                        />
                      </div>

                      {/* Badge */}
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.badgeCls}`}>
                        {vendor.badge}
                      </span>

                      {/* Key metrics */}
                      {vendor.keyMetrics && Object.keys(vendor.keyMetrics).length > 0 && (
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs bg-slate-50 rounded-lg p-2">
                          {Object.entries(vendor.keyMetrics).slice(0, 4).map(([k, v]) => (
                            <div key={k}>
                              <span className="text-slate-400 capitalize">{k}: </span>
                              <span className="font-semibold text-slate-700">{v}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Rationale */}
                      <p className="text-xs text-slate-600 leading-relaxed">{vendor.rationale}</p>

                      {/* Strengths */}
                      {vendor.strengths?.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold text-green-700 mb-1">✓ Why this vendor</div>
                          <ul className="space-y-0.5">
                            {vendor.strengths.map((s, i) => (
                              <li key={i} className="flex gap-1.5 text-xs text-slate-600">
                                <span className="text-green-500 shrink-0 mt-0.5">•</span>
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Risks */}
                      {vendor.risks?.length > 0 && (
                        <div className="mt-auto">
                          <div className="text-xs font-semibold text-orange-600 mb-1">⚠ Watch out for</div>
                          <ul className="space-y-0.5">
                            {vendor.risks.map((r, i) => (
                              <li key={i} className="flex gap-1.5 text-xs text-slate-500">
                                <span className="text-orange-400 shrink-0 mt-0.5">•</span>
                                {r}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Side-by-side comparison table for Top 3 ── */}
          <Top3ComparisonTable
            top3={analysis.top3}
            fields={fields}
            extractedBySubmission={extractedBySubmission}
          />

          {/* ── Recommendation ── */}
          <div className="rounded-xl bg-purple-50 ring-1 ring-purple-200 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-purple-600 mb-2">
              🏆 Recommendation
            </p>
            <p className="text-sm text-slate-800 leading-relaxed">{analysis.recommendation}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Top-3 Comparison Table ───────────────────────────────────────────────────

function Top3ComparisonTable({
  top3,
  fields,
  extractedBySubmission,
}: {
  top3: VendorRank[];
  fields: SchemaField[];
  extractedBySubmission: Record<string, Record<string, ExtractedEntry>>;
}) {
  const MEDALS = ["🥇", "🥈", "🥉"];

  // Only show fields that have at least one value across the top 3
  const activeFields = fields.filter((f) =>
    top3.some((v) => {
      const e = extractedBySubmission[v.submissionId]?.[f.field_key];
      return e?.value !== null && e?.value !== undefined;
    })
  );

  if (activeFields.length === 0) {
    return (
      <div className="rounded-xl bg-amber-50 ring-1 ring-amber-200 p-5 text-sm text-amber-800">
        ⚡ No extracted field data found for these vendors. Run <strong>Extract &amp; Analyze</strong> on their submissions first, then re-run the AI analysis.
      </div>
    );
  }

  // Group fields by section
  const sections: Record<string, SchemaField[]> = {};
  for (const f of activeFields) {
    const sec = f.section ?? "General";
    if (!sections[sec]) sections[sec] = [];
    sections[sec].push(f);
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-600 mb-3 uppercase tracking-wide">
        Side-by-Side Comparison — Top {top3.length}
      </h3>
      <div className="rounded-xl ring-1 ring-slate-200 overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 w-48">
                Field
              </th>
              {top3.map((v, i) => (
                <th key={v.submissionId} className="px-4 py-3 text-left text-xs font-semibold text-slate-700">
                  <span className="mr-1">{MEDALS[i]}</span>
                  {v.companyName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(sections).map(([section, sectionFields]) => (
              <>
                {/* Section header */}
                <tr key={`sec-${section}`} className="border-t border-slate-100 bg-slate-50/70">
                  <td
                    colSpan={top3.length + 1}
                    className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400"
                  >
                    {section}
                  </td>
                </tr>

                {sectionFields.map((field) => {
                  // Find the best value across top3 for this field (for highlighting)
                  const values = top3.map((v) => extractedBySubmission[v.submissionId]?.[field.field_key]);
                  const bestIdx = getBestIdx(field, values);

                  return (
                    <tr key={field.field_key} className="border-t border-slate-50 hover:bg-blue-50/30">
                      <td className="px-4 py-3 text-xs font-medium text-slate-700 align-top">
                        <div>{field.label}</div>
                        {field.is_price_field && (
                          <div className="text-green-600 text-[10px]">💰 price</div>
                        )}
                      </td>
                      {top3.map((v, colIdx) => {
                        const entry = extractedBySubmission[v.submissionId]?.[field.field_key];
                        const isBest = colIdx === bestIdx;
                        return (
                          <td
                            key={v.submissionId}
                            className={`px-4 py-3 align-top ${isBest ? "bg-green-50" : ""}`}
                          >
                            {entry?.value !== null && entry?.value !== undefined ? (
                              <div>
                                <div className={`font-semibold text-sm ${isBest ? "text-green-800" : "text-slate-800"}`}>
                                  {isBest && <span className="mr-1 text-green-600">★</span>}
                                  {formatValue(entry.value)}
                                </div>
                                {entry.raw && entry.raw !== formatValue(entry.value) && (
                                  <div className="text-[10px] text-slate-400 mt-0.5 italic line-clamp-1">
                                    &ldquo;{entry.raw}&rdquo;
                                  </div>
                                )}
                                <span className={`inline-flex items-center gap-1 mt-1 text-[10px] font-medium ${
                                  entry.confidence === "confirmed" ? "text-blue-600" :
                                  entry.confidence === "high"      ? "text-green-600" :
                                  entry.confidence === "medium"    ? "text-yellow-600" :
                                  "text-slate-400"
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${CONF_DOT[entry.confidence] ?? "bg-slate-300"}`} />
                                  {entry.confidence}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-300 text-xs italic">—</span>
                            )}
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
      <p className="mt-2 text-xs text-slate-400">
        ★ Green highlight = best value for that field · Confidence: <span className="text-blue-600">confirmed</span>, <span className="text-green-600">high</span>, <span className="text-yellow-600">medium</span>
      </p>
    </div>
  );
}

/** Returns the index of the "best" entry for a field across the top-3 vendors.
 *  For price fields: lowest numeric value wins.
 *  For other fields: highest confidence wins (confirmed > high > medium > low).
 */
function getBestIdx(
  field: SchemaField,
  values: (ExtractedEntry | undefined)[]
): number {
  const valid = values
    .map((v, i) => ({ v, i }))
    .filter(({ v }) => v?.value !== null && v?.value !== undefined);

  if (valid.length === 0) return -1;

  if (field.is_price_field) {
    // Lower numeric is better
    let best = -1;
    let bestNum = Infinity;
    for (const { v, i } of valid) {
      const num =
        typeof v!.value === "number"
          ? v!.value
          : typeof v!.value === "object"
          ? ((v!.value as Record<string, unknown>).value as number) ?? Infinity
          : parseFloat(String(v!.value)) || Infinity;
      if (num < bestNum) { bestNum = num; best = i; }
    }
    return best;
  }

  // For non-price: higher confidence is better
  const ORDER: Record<string, number> = { confirmed: 4, high: 3, medium: 2, low: 1, not_found: 0 };
  let best = -1;
  let bestScore = -1;
  for (const { v, i } of valid) {
    const score = ORDER[v!.confidence] ?? 0;
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return best;
}
