"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";

const ACCEPTED_TYPES = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/vnd.ms-excel": [".xls"],
  "text/csv": [".csv"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
};

interface Props {
  token: string;
  invitationId: string;
}

export default function VendorSubmitForm({ token, invitationId }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [emailBody, setEmailBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refCode, setRefCode] = useState<string | null>(null);

  const onDrop = useCallback((accepted: File[]) => {
    setFiles((prev) => [...prev, ...accepted]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: 50 * 1024 * 1024, // 50 MB
  });

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (files.length === 0 && !emailBody.trim()) {
      setError("Please upload at least one file or paste your offer text.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.append("token", token);
    formData.append("invitationId", invitationId);
    if (emailBody.trim()) formData.append("emailBody", emailBody.trim());
    files.forEach((f) => formData.append("files", f));

    const res = await fetch(`/api/vendor-portal/${token}/submit`, {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      const { data } = await res.json();
      setRefCode(data.referenceCode);
      setSubmitted(true);
    } else {
      const { error: msg } = await res.json();
      setError(msg ?? "Submission failed. Please try again.");
    }

    setSubmitting(false);
  }

  if (submitted) {
    return (
      <div className="rounded-xl bg-green-50 p-8 text-center ring-1 ring-green-200">
        <p className="text-5xl mb-3">✅</p>
        <h2 className="text-xl font-bold text-green-800">Offer Received!</h2>
        <p className="mt-2 text-sm text-green-600">
          Your offer has been submitted and is being processed.
        </p>
        {refCode && (
          <div className="mt-4 rounded-lg bg-white px-4 py-3 ring-1 ring-green-200">
            <p className="text-xs text-slate-400">Reference code</p>
            <p className="font-mono font-semibold text-slate-800">{refCode}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h2 className="font-semibold text-slate-900 mb-1">Submit Your Offer</h2>
      <p className="text-sm text-slate-500 mb-6">
        Upload your offer in any format, or paste your offer text below. No login required.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Drop zone */}
        <div
          {...getRootProps()}
          className={`rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
            isDragActive
              ? "border-blue-400 bg-blue-50"
              : "border-slate-300 hover:border-slate-400"
          }`}
        >
          <input {...getInputProps()} />
          <p className="text-3xl mb-2">📎</p>
          <p className="text-sm font-medium text-slate-700">
            {isDragActive ? "Drop files here" : "Drag & drop or click to upload"}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            PDF, Word, Excel, CSV, PNG, JPEG — up to 50 MB each
          </p>
        </div>

        {/* File list */}
        {files.length > 0 && (
          <ul className="space-y-2">
            {files.map((file, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-2.5 text-sm"
              >
                <span className="truncate text-slate-700">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="ml-3 text-red-400 hover:text-red-600"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Text area */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Or paste offer text / additional notes
          </label>
          <textarea
            value={emailBody}
            onChange={(e) => setEmailBody(e.target.value)}
            rows={5}
            placeholder="Paste pricing, terms, or any other offer details here…"
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit Offer"}
        </button>
      </form>
    </div>
  );
}
