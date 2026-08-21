"use client";

import type { RFxDraft } from "@/types/index";
import { format, parseISO } from "date-fns";

interface Props {
  draft: Partial<RFxDraft>;
}

function safeDate(str?: string | null) {
  try {
    return str ? format(parseISO(str), "dd MMM yyyy") : null;
  } catch {
    return str ?? null;
  }
}

export default function DraftPreview({ draft }: Props) {
  return (
    <div className="space-y-6 text-sm text-slate-700">
      {/* Header */}
      <div>
        <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
          {draft.event_type ?? "RFx"}
        </span>
        <h2 className="mt-2 text-lg font-bold text-slate-900">{draft.title ?? "Untitled Event"}</h2>
      </div>

      {/* Description */}
      {draft.description && (
        <section>
          <h3 className="font-semibold text-slate-500 text-xs uppercase tracking-wide mb-1">Description</h3>
          <p className="text-slate-700">{draft.description}</p>
        </section>
      )}

      {/* Background */}
      {draft.background && (
        <section>
          <h3 className="font-semibold text-slate-500 text-xs uppercase tracking-wide mb-1">Background</h3>
          <p className="text-slate-600">{draft.background}</p>
        </section>
      )}

      {/* Dates */}
      <section className="grid grid-cols-2 gap-3">
        {[
          { label: "Submission Deadline", val: safeDate(draft.submission_deadline) },
          { label: "Q&A Deadline", val: safeDate(draft.questions_deadline) },
          { label: "Award Date", val: safeDate(draft.award_date) },
          { label: "Late Submissions", val: draft.late_response_rule },
        ].map(
          (item) =>
            item.val && (
              <div key={item.label} className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-400">{item.label}</p>
                <p className="mt-0.5 font-medium capitalize">{item.val}</p>
              </div>
            )
        )}
      </section>

      {/* Evaluation criteria */}
      {draft.evaluation_criteria && draft.evaluation_criteria.length > 0 && (
        <section>
          <h3 className="font-semibold text-slate-500 text-xs uppercase tracking-wide mb-2">
            Evaluation Criteria
          </h3>
          <div className="space-y-1.5">
            {draft.evaluation_criteria.map((c, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span>{c.criterion}</span>
                <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                  {c.weight}%
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Schema fields */}
      {draft.schema_fields && draft.schema_fields.length > 0 && (
        <section>
          <h3 className="font-semibold text-slate-500 text-xs uppercase tracking-wide mb-2">
            Vendor Response Fields ({draft.schema_fields.length})
          </h3>
          {/* Group by section */}
          {Object.entries(
            draft.schema_fields.reduce<Record<string, typeof draft.schema_fields>>((acc, f) => {
              const s = f.section ?? "General";
              if (!acc[s]) acc[s] = [];
              acc[s].push(f);
              return acc;
            }, {})
          ).map(([section, fields]) => (
            <div key={section} className="mb-3">
              <p className="mb-1 text-xs font-semibold text-slate-400 uppercase">{section}</p>
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                {fields.map((f, i) => (
                  <div
                    key={f.field_key}
                    className={`flex items-center justify-between px-3 py-2 ${
                      i < fields.length - 1 ? "border-b border-slate-100" : ""
                    }`}
                  >
                    <div>
                      <span className="font-medium text-slate-800">{f.label}</span>
                      <span className="ml-2 text-xs text-slate-400">{f.data_type}</span>
                      {f.is_price_field && (
                        <span className="ml-1 text-xs text-amber-600">💰</span>
                      )}
                    </div>
                    <span
                      className={`text-xs ${
                        f.required ? "text-red-500" : "text-slate-300"
                      }`}
                    >
                      {f.required ? "Required" : "Optional"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Completeness issues */}
      {draft.completeness_issues && draft.completeness_issues.length > 0 && (
        <section>
          <h3 className="font-semibold text-slate-500 text-xs uppercase tracking-wide mb-2">
            Completeness Issues
          </h3>
          <div className="space-y-2">
            {draft.completeness_issues.map((issue, i) => (
              <div
                key={i}
                className={`rounded-lg px-3 py-2 text-xs ${
                  issue.severity === "blocking"
                    ? "bg-red-50 text-red-700"
                    : "bg-yellow-50 text-yellow-700"
                }`}
              >
                <span className="font-semibold">{issue.field}:</span> {issue.issue}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
