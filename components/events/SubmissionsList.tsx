"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SchemaField {
  field_key: string;
  label: string;
  data_type: string;
  is_price_field: boolean;
  required: boolean;
  section: string | null;
}

interface Attachment {
  id: string;
  original_filename: string;
  mime_type: string;
  file_size_bytes: number;
}

interface Submission {
  id: string;
  status: string;
  extraction_status: string;
  is_late: boolean;
  submitted_at: string;
  submission_channel: string | null;
  email_body_text: string | null;
  vendors: { company_name: string; primary_email: string } | null;
  offer_attachments: Attachment[];
}

interface ExtractedField {
  field_key: string;
  raw_text: string | null;
  normalized_value: unknown;
  confidence_label: string;
  is_flagged: boolean;
  flag_reason: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CONF_STYLES: Record<string, string> = {
  high:       "bg-green-50 text-green-700 ring-1 ring-green-200",
  medium:     "bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200",
  low:        "bg-red-50 text-red-700 ring-1 ring-red-200",
  not_found:  "bg-slate-100 text-slate-400",
  ambiguous:  "bg-orange-50 text-orange-600 ring-1 ring-orange-200",
  conflicted: "bg-purple-50 text-purple-700 ring-1 ring-purple-200",
};

const CONF_ICON: Record<string, string> = {
  high:       "🟢",
  medium:     "🟡",
  low:        "🔴",
  not_found:  "⬜",
  ambiguous:  "🟠",
  conflicted: "🟣",
};

const STATUS_COLORS: Record<string, string> = {
  received:     "bg-blue-50 text-blue-700",
  extracting:   "bg-yellow-50 text-yellow-700",
  extracted:    "bg-teal-50 text-teal-700",
  under_review: "bg-orange-50 text-orange-700",
  confirmed:    "bg-green-50 text-green-700",
  disqualified: "bg-red-50 text-red-600",
  late:         "bg-orange-100 text-orange-700",
  quarantined:  "bg-slate-100 text-slate-500",
};

const EXT_STATUS_COLORS: Record<string, string> = {
  pending:         "text-slate-400",
  queued:          "text-blue-400",
  in_progress:     "text-yellow-600",
  completed:       "text-green-600",
  failed:          "text-red-500",
  manual_required: "text-orange-500",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    if (obj.value !== undefined && obj.currency) return `${obj.currency} ${obj.value}`;
    if (obj.value !== undefined) return String(obj.value);
    if (Array.isArray(v)) return (v as unknown[]).join(", ");
    return JSON.stringify(v);
  }
  return String(v);
}

function fileIcon(mime: string): string {
  if (mime.includes("pdf")) return "📄";
  if (mime.includes("word")) return "📝";
  if (mime.includes("spreadsheet") || mime.includes("excel") || mime.includes("csv")) return "📊";
  if (mime.startsWith("image/")) return "🖼️";
  return "📎";
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Splits `text` by `highlight` and wraps matches in <mark>. */
function HighlightedText({
  text,
  highlight,
  scrollRef,
}: {
  text: string;
  highlight: string | null;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
}) {
  // Scroll to first match when highlight changes
  useEffect(() => {
    if (highlight && scrollRef?.current) {
      const mark = scrollRef.current.querySelector("mark");
      if (mark) mark.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlight, scrollRef]);

  if (!highlight) return <>{text}</>;

  const parts = text.split(new RegExp(`(${escapeRegex(highlight)})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === highlight.toLowerCase() ? (
          <mark key={i} className="bg-yellow-300 rounded-sm px-0.5 text-slate-900">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

// ─── SourceViewer ──────────────────────────────────────────────────────────────

interface SourceViewerProps {
  text: string | null;
  attachments: Attachment[];
  pendingFiles: File[];
  highlight: string | null;
  onHighlightClear: () => void;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onFileInput: (files: FileList) => void;
  onRemoveFile: (i: number) => void;
}

function SourceViewer({
  text,
  attachments,
  pendingFiles,
  highlight,
  onHighlightClear,
  onDrop,
  onDragOver,
  onFileInput,
  onRemoveFile,
}: SourceViewerProps) {
  const [search, setSearch] = useState("");
  const [activeSearch, setActiveSearch] = useState<string | null>(null);
  const docRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const effectiveHighlight = highlight ?? activeSearch;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex-shrink-0">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
          Source Document
        </p>

        {/* Upload zone */}
        <div
          onDragOver={onDragOver}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-center text-xs text-slate-400 cursor-pointer hover:border-blue-400 hover:text-blue-500 transition-colors"
        >
          📎 Drop or click to add document
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".pdf,.docx,.xlsx,.xls,.csv,.png,.jpg,.jpeg"
            className="hidden"
            onChange={(e) => { if (e.target.files) onFileInput(e.target.files); }}
          />
        </div>

        {/* Existing attachments */}
        {attachments.length > 0 && (
          <div className="mt-2 space-y-1">
            {attachments.map((a) => (
              <div key={a.id} className="flex items-center gap-1.5 text-xs text-slate-500">
                <span>{fileIcon(a.mime_type)}</span>
                <span className="truncate">{a.original_filename}</span>
                <span className="ml-auto flex-shrink-0 text-slate-300">{formatBytes(a.file_size_bytes)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Pending (not yet uploaded) files */}
        {pendingFiles.length > 0 && (
          <div className="mt-2 space-y-1">
            {pendingFiles.map((f, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 rounded px-2 py-1">
                <span>{fileIcon(f.type)}</span>
                <span className="flex-1 truncate">{f.name}</span>
                <span className="text-slate-400">{formatBytes(f.size)}</span>
                <button onClick={() => onRemoveFile(i)} className="text-red-400 hover:text-red-600 ml-1">×</button>
              </div>
            ))}
          </div>
        )}

        {/* Search in text */}
        {text && (
          <div className="mt-2 flex gap-1">
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); if (!e.target.value) setActiveSearch(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") setActiveSearch(search || null); }}
              placeholder="Search in document…"
              className="flex-1 rounded-lg border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <button
              onClick={() => setActiveSearch(search || null)}
              className="rounded-lg bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200"
            >
              🔍
            </button>
            {(activeSearch || highlight) && (
              <button
                onClick={() => { setActiveSearch(null); setSearch(""); onHighlightClear(); }}
                className="rounded-lg bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200"
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>

      {/* Document body */}
      <div ref={docRef} className="flex-1 overflow-y-auto p-4">
        {text ? (
          <pre className="whitespace-pre-wrap font-mono text-xs text-slate-700 leading-relaxed">
            <HighlightedText text={text} highlight={effectiveHighlight} scrollRef={docRef} />
          </pre>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 text-sm">
            <p className="text-3xl mb-2">📄</p>
            {attachments.length > 0 ? (
              <p>Document uploaded. Text will appear here after extraction.</p>
            ) : (
              <p>No source text yet — paste text in the right panel or upload a document above.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── FieldEditor ──────────────────────────────────────────────────────────────

interface FieldEditorProps {
  field: SchemaField;
  currentValue: unknown;
  onSave: (value: unknown) => Promise<void>;
  onCancel: () => void;
}

function FieldEditor({ field, currentValue, onSave, onCancel }: FieldEditorProps) {
  const initStr = formatValue(currentValue);
  const [text, setText] = useState(initStr);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    // Coerce to correct type
    let parsed: unknown = text;
    if (field.data_type === "number") {
      parsed = parseFloat(text) || null;
    } else if (field.data_type === "boolean") {
      parsed = text.toLowerCase() === "true" || text.toLowerCase() === "yes";
    } else if (field.data_type === "currency") {
      // Expect "EUR 285" or "285" — try to parse
      const parts = text.trim().split(/\s+/);
      if (parts.length >= 2 && isNaN(Number(parts[0]))) {
        parsed = { currency: parts[0].toUpperCase(), value: parseFloat(parts[1]) };
      } else {
        parsed = { value: parseFloat(parts[0]) || 0, currency: "USD" };
      }
    }
    await onSave(parsed);
    setSaving(false);
  }

  const isMultiline = field.data_type === "text" || text.length > 60;

  return (
    <div className="space-y-1.5">
      {isMultiline ? (
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-blue-300 px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
          placeholder={`Enter ${field.label}…`}
        />
      ) : (
        <input
          autoFocus
          type={field.data_type === "number" ? "number" : "text"}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full rounded-lg border border-blue-300 px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder={
            field.data_type === "currency"
              ? "e.g. EUR 285"
              : field.data_type === "boolean"
              ? "true or false"
              : `Enter ${field.label}…`
          }
        />
      )}
      <div className="flex gap-1.5">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-green-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "✓ Save"}
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200"
        >
          Cancel
        </button>
      </div>
      {field.data_type === "currency" && (
        <p className="text-[10px] text-slate-400">Format: currency code + amount, e.g. &ldquo;EUR 285&rdquo;</p>
      )}
    </div>
  );
}

// ─── ExtractionPanel ──────────────────────────────────────────────────────────

interface ExtractionPanelProps {
  submission: Submission;
  fields: SchemaField[];
  eventId: string;
  onClose: () => void;
}

function ExtractionPanel({ submission, fields, eventId, onClose }: ExtractionPanelProps) {
  // Source / upload state
  const [vendorText, setVendorText] = useState(submission.email_body_text ?? "");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [dragging, setDragging]         = useState(false);

  // Extraction state
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [results, setResults]   = useState<ExtractedField[] | null>(null);

  // Confirm-all state
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed]   = useState(false);

  // Per-field overrides: field_key → saved value
  const [overrides, setOverrides] = useState<Record<string, { value: unknown; saved: boolean }>>({});
  // Which field is currently being edited
  const [editingKey, setEditingKey] = useState<string | null>(null);

  // Highlighted text for "find in doc"
  const [highlightSnippet, setHighlightSnippet] = useState<string | null>(null);

  // Left pane visibility toggle
  const [showSource, setShowSource] = useState(true);

  const existingAttachments = submission.offer_attachments ?? [];
  const hasExistingContent = !!submission.email_body_text || existingAttachments.length > 0;

  // Source text to display (existing or typed)
  const displayText = vendorText || submission.email_body_text || null;

  function addFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter((f) =>
      f.name.match(/\.(pdf|docx|xlsx|xls|csv|png|jpe?g)$/i)
    );
    setPendingFiles((prev) => [...prev, ...arr]);
  }

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }, []);

  // ── Extract ──
  async function handleExtract() {
    setLoading(true);
    setError(null);
    setWarnings([]);
    setResults(null);
    setOverrides({});
    setEditingKey(null);

    let res: Response;
    if (pendingFiles.length > 0) {
      const fd = new FormData();
      if (vendorText.trim()) fd.append("emailBody", vendorText.trim());
      pendingFiles.forEach((f) => fd.append("file", f));
      res = await fetch(`/api/submissions/${submission.id}/extract`, {
        method: "POST",
        body: fd,
      });
    } else {
      res = await fetch(`/api/submissions/${submission.id}/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorText: vendorText || undefined }),
      });
    }

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Extraction failed");
    } else {
      setResults(data.data.extracted);
      setWarnings(data.data.warnings ?? []);
      setPendingFiles([]);
    }
    setLoading(false);
  }

  // ── Save single field override ──
  async function handleSaveOverride(fieldKey: string, value: unknown) {
    const res = await fetch(`/api/submissions/${submission.id}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirmations: [
          {
            fieldKey,
            extractedValueId: null,
            confirmedValue: value,
            isCorrection: true,
          },
        ],
      }),
    });
    if (res.ok) {
      setOverrides((prev) => ({ ...prev, [fieldKey]: { value, saved: true } }));
      setEditingKey(null);
    } else {
      const d = await res.json();
      setError(d.error ?? "Failed to save");
    }
  }

  // ── Confirm all high/medium ──
  async function handleConfirmAll() {
    if (!results) return;
    setConfirming(true);

    const highConf = results.filter(
      (r) =>
        (r.confidence_label === "high" || r.confidence_label === "medium") &&
        r.normalized_value !== null
    );

    const res = await fetch(`/api/submissions/${submission.id}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirmations: highConf.map((r) => ({
          fieldKey: r.field_key,
          extractedValueId: null,
          confirmedValue: r.normalized_value,
          isCorrection: false,
        })),
      }),
    });

    if (res.ok) {
      setConfirmed(true);
    } else {
      const d = await res.json();
      setError(d.error ?? "Confirm failed");
    }
    setConfirming(false);
  }

  const highCount = results?.filter((r) => r.confidence_label === "high").length ?? 0;
  const medCount  = results?.filter((r) => r.confidence_label === "medium").length ?? 0;
  const foundCount = results?.filter((r) => r.normalized_value !== null).length ?? 0;

  // Group fields by section
  const sections = fields.reduce<Record<string, SchemaField[]>>((acc, f) => {
    const sec = f.section ?? "General";
    if (!acc[sec]) acc[sec] = [];
    acc[sec].push(f);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-stretch">
      <div className="relative m-3 flex-1 bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">

        {/* ── Header ── */}
        <div className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-4">
          <div className="min-w-0">
            <h2 className="font-bold text-slate-900 truncate">
              {submission.vendors?.company_name ?? "Unknown Vendor"}
            </h2>
            <p className="text-xs text-slate-400 truncate">{submission.vendors?.primary_email}</p>
          </div>

          {/* Source toggle */}
          <button
            onClick={() => setShowSource((v) => !v)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
              showSource
                ? "bg-blue-50 text-blue-700 border-blue-200"
                : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
            }`}
          >
            {showSource ? "◀ Hide Doc" : "▶ Show Doc"}
          </button>

          <div className="ml-auto flex items-center gap-3">
            {results && !confirmed && (
              <button
                onClick={handleConfirmAll}
                disabled={confirming || (highCount + medCount) === 0}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-40"
              >
                {confirming ? "Confirming…" : `✓ Confirm ${highCount + medCount} high/medium`}
              </button>
            )}
            {confirmed && (
              <span className="rounded-lg bg-green-50 px-4 py-2 text-sm font-semibold text-green-700 ring-1 ring-green-200">
                ✅ Confirmed
              </span>
            )}
            <Link
              href={`/events/${eventId}/submissions/${submission.id}`}
              className="text-xs text-blue-600 hover:underline whitespace-nowrap"
            >
              Full Detail →
            </Link>
            <button
              onClick={onClose}
              className="text-2xl text-slate-400 hover:text-slate-700 leading-none w-8 h-8 flex items-center justify-center"
            >
              ×
            </button>
          </div>
        </div>

        {/* ── Body: two panes ── */}
        <div className="flex-1 overflow-hidden flex min-h-0">

          {/* ── LEFT PANE: Source Viewer ── */}
          {showSource && (
            <div
              className={`flex flex-col border-r border-slate-200 ${dragging ? "bg-blue-50 ring-2 ring-blue-400 ring-inset" : ""}`}
              style={{ width: "38%", minWidth: 280 }}
            >
              <SourceViewer
                text={displayText}
                attachments={existingAttachments}
                pendingFiles={pendingFiles}
                highlight={highlightSnippet}
                onHighlightClear={() => setHighlightSnippet(null)}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onFileInput={addFiles}
                onRemoveFile={(i) => setPendingFiles((p) => p.filter((_, j) => j !== i))}
              />
            </div>
          )}

          {/* ── RIGHT PANE: Controls + Extraction Results ── */}
          <div className="flex-1 overflow-y-auto flex flex-col min-w-0">

            {/* Paste text + extract button */}
            <div className="flex-shrink-0 p-4 border-b border-slate-100 space-y-3 bg-slate-50">
              {!showSource && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Paste offer text
                  </label>
                  <textarea
                    value={vendorText}
                    onChange={(e) => setVendorText(e.target.value)}
                    rows={5}
                    placeholder="Paste vendor's offer text here…"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
              )}
              {showSource && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Paste or edit offer text (shown in left panel)
                  </label>
                  <textarea
                    value={vendorText}
                    onChange={(e) => setVendorText(e.target.value)}
                    rows={3}
                    placeholder="Paste vendor's offer text here…"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={handleExtract}
                  disabled={loading || (!vendorText.trim() && pendingFiles.length === 0 && !hasExistingContent)}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                      </svg>
                      Extracting…
                    </>
                  ) : pendingFiles.length > 0 ? (
                    `⚡ Upload & Extract (${pendingFiles.length} file${pendingFiles.length > 1 ? "s" : ""})`
                  ) : (
                    "⚡ Run AI Extraction"
                  )}
                </button>
                {results && (
                  <span className="text-xs text-slate-500">
                    {foundCount}/{fields.length} fields extracted · {highCount} high · {medCount} medium
                  </span>
                )}
              </div>

              {/* Errors / warnings */}
              {error && (
                <div className="rounded-lg bg-red-50 ring-1 ring-red-200 p-3 text-xs text-red-700">
                  <p className="font-semibold mb-0.5">❌ {error}</p>
                  {(error.includes("selectable") || error.includes("image extraction")) && (
                    <p>→ Paste the document text in the text area above and re-run.</p>
                  )}
                </div>
              )}
              {warnings.length > 0 && (
                <div className="rounded-lg bg-amber-50 ring-1 ring-amber-200 p-3 text-xs text-amber-800">
                  <p className="font-semibold mb-0.5">⚠️ Some files could not be parsed</p>
                  {warnings.map((w, i) => <p key={i}>{w}</p>)}
                </div>
              )}
            </div>

            {/* ── Extraction Results Table ── */}
            {results && (
              <div className="flex-1 overflow-y-auto">
                {/* Legend */}
                <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 text-[10px] text-blue-700 flex gap-4 flex-wrap">
                  <span>🟢 high confidence</span>
                  <span>🟡 medium</span>
                  <span>🔴 low</span>
                  <span>⬜ not found</span>
                  <span className="ml-auto">✏ Edit any field · 🔍 Find in source doc</span>
                </div>

                {Object.entries(sections).map(([section, sectionFields]) => (
                  <div key={section}>
                    {/* Section header */}
                    <div className="px-4 py-2 bg-slate-50 border-y border-slate-100 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {section}
                    </div>

                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-[10px] font-semibold uppercase tracking-wide text-slate-400 bg-white">
                          <th className="px-4 py-2 text-left w-36">Field</th>
                          <th className="px-4 py-2 text-left">Extracted Value</th>
                          <th className="px-4 py-2 text-left w-20">Confidence</th>
                          <th className="px-4 py-2 text-left">Why AI answered this</th>
                          <th className="px-4 py-2 w-16">Edit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sectionFields.map((field) => {
                          const r = results.find((x) => x.field_key === field.field_key);
                          const override = overrides[field.field_key];
                          const displayVal = override?.value ?? r?.normalized_value ?? null;
                          const displayConf = override?.saved ? "confirmed" : (r?.confidence_label ?? "not_found");
                          const isEditing = editingKey === field.field_key;
                          const hasValue = displayVal !== null && displayVal !== undefined;
                          const hasOverride = !!override?.saved;

                          return (
                            <tr
                              key={field.field_key}
                              className={`border-b border-slate-50 align-top ${
                                r?.is_flagged && !hasOverride ? "bg-red-50" : ""
                              } ${hasOverride ? "bg-blue-50" : ""}`}
                            >
                              {/* Field label */}
                              <td className="px-4 py-3">
                                <div className="font-semibold text-slate-800 leading-snug">{field.label}</div>
                                <div className="flex flex-wrap gap-1 mt-0.5">
                                  {field.is_price_field && <span className="text-green-600">💰</span>}
                                  {field.required && !hasValue && (
                                    <span className="text-red-500 text-[10px]">required</span>
                                  )}
                                </div>
                              </td>

                              {/* Value / editor */}
                              <td className="px-4 py-3">
                                {isEditing ? (
                                  <FieldEditor
                                    field={field}
                                    currentValue={displayVal}
                                    onSave={(v) => handleSaveOverride(field.field_key, v)}
                                    onCancel={() => setEditingKey(null)}
                                  />
                                ) : hasValue ? (
                                  <div>
                                    <div className={`font-semibold leading-snug ${hasOverride ? "text-blue-800" : "text-slate-900"}`}>
                                      {hasOverride && <span className="text-blue-400 mr-1 text-[10px]">✓ edited</span>}
                                      {formatValue(displayVal)}
                                    </div>
                                    {r?.is_flagged && !hasOverride && (
                                      <div className="text-orange-600 text-[10px] mt-0.5">⚠ {r.flag_reason}</div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-300 italic">Not found — click ✏ to enter manually</span>
                                )}
                              </td>

                              {/* Confidence */}
                              <td className="px-4 py-3">
                                {hasOverride ? (
                                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                                    ✓ manual
                                  </span>
                                ) : r ? (
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${CONF_STYLES[r.confidence_label] ?? CONF_STYLES.not_found}`}>
                                    {CONF_ICON[r.confidence_label]} {r.confidence_label}
                                  </span>
                                ) : (
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-400">
                                    ⬜ not found
                                  </span>
                                )}
                              </td>

                              {/* Evidence / source snippet */}
                              <td className="px-4 py-3">
                                {r?.raw_text ? (
                                  <div>
                                    <blockquote className="border-l-2 border-slate-300 pl-2 text-[10px] text-slate-500 italic leading-relaxed line-clamp-3">
                                      &ldquo;{r.raw_text}&rdquo;
                                    </blockquote>
                                    {displayText && (
                                      <button
                                        onClick={() =>
                                          setHighlightSnippet(
                                            highlightSnippet === r.raw_text ? null : r.raw_text
                                          )
                                        }
                                        className={`mt-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                                          highlightSnippet === r.raw_text
                                            ? "bg-yellow-200 text-yellow-800"
                                            : "bg-slate-100 text-slate-500 hover:bg-yellow-100 hover:text-yellow-700"
                                        }`}
                                      >
                                        {highlightSnippet === r.raw_text ? "✕ Unpin" : "🔍 Find in doc"}
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-200 text-[10px]">—</span>
                                )}
                              </td>

                              {/* Edit button */}
                              <td className="px-4 py-3 text-center">
                                {isEditing ? null : (
                                  <button
                                    onClick={() => setEditingKey(field.field_key)}
                                    title="Edit this field manually"
                                    className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-blue-100 hover:text-blue-700 transition-colors"
                                  >
                                    ✏ Edit
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}

                <div className="px-4 py-3 text-[10px] text-slate-400">
                  High + medium confidence values are auto-confirmed. Edited fields are saved individually.
                </div>
              </div>
            )}

            {/* Empty state when no results yet */}
            {!results && !loading && (
              <div className="flex-1 flex items-center justify-center text-center p-10 text-slate-400">
                <div>
                  <p className="text-4xl mb-3">⚡</p>
                  <p className="text-sm font-medium text-slate-500">
                    {hasExistingContent
                      ? "Click \"Run AI Extraction\" to extract all RFQ fields from this vendor's response."
                      : "Paste the vendor's offer text or upload a document, then click \"Run AI Extraction\"."}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SubmissionsList (table) ──────────────────────────────────────────────────

export function SubmissionsList({
  eventId,
  submissions,
  fields,
}: {
  eventId: string;
  submissions: Submission[];
  fields: SchemaField[];
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeSub = submissions.find((s) => s.id === activeId) ?? null;

  return (
    <>
      {activeSub && (
        <ExtractionPanel
          submission={activeSub}
          fields={fields}
          eventId={eventId}
          onClose={() => setActiveId(null)}
        />
      )}

      <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs font-medium uppercase tracking-wide text-slate-400">
              <th className="px-5 py-2 text-left">Vendor</th>
              <th className="px-5 py-2 text-left">Status</th>
              <th className="px-5 py-2 text-left">Extraction</th>
              <th className="px-5 py-2 text-left">Source</th>
              <th className="px-5 py-2 text-left">Received</th>
              <th className="px-5 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((sub) => {
              const attCount = sub.offer_attachments?.length ?? 0;
              return (
                <tr
                  key={sub.id}
                  className={`border-b border-slate-50 hover:bg-slate-50 ${activeId === sub.id ? "bg-blue-50" : ""}`}
                >
                  <td className="px-5 py-3">
                    <div className="font-medium text-slate-900">{sub.vendors?.company_name ?? "Unknown"}</div>
                    <div className="text-xs text-slate-400">{sub.vendors?.primary_email}</div>
                    <div className="mt-0.5 flex gap-1.5">
                      {sub.is_late && (
                        <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-xs text-orange-600">LATE</span>
                      )}
                      {sub.email_body_text && (
                        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">✍ text</span>
                      )}
                      {attCount > 0 && (
                        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                          📎 {attCount} file{attCount > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[sub.status] ?? "bg-slate-100 text-slate-600"}`}>
                      {sub.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-medium ${EXT_STATUS_COLORS[sub.extraction_status] ?? "text-slate-400"}`}>
                      {sub.extraction_status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-400 capitalize">
                    {sub.submission_channel ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-400">
                    {format(new Date(sub.submitted_at), "dd MMM yyyy, HH:mm")}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setActiveId(activeId === sub.id ? null : sub.id)}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                      >
                        ⚡ Extract & Analyze
                      </button>
                      <Link href={`/events/${eventId}/submissions/${sub.id}`} className="text-xs text-slate-400 hover:text-blue-600">
                        Detail →
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
