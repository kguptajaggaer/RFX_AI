"use client";
import { useState } from "react";

interface VendorRow {
  email: string;
  companyName: string;
  contactName: string;
}

export function VendorDispatchForm({ eventId }: { eventId: string }) {
  const [vendors, setVendors] = useState<VendorRow[]>([
    { email: "", companyName: "", contactName: "" },
  ]);
  const [personalMessage, setPersonalMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    dispatched: string[];
    failed: { email: string; reason: string }[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function updateVendor(idx: number, field: keyof VendorRow, value: string) {
    setVendors((prev) => prev.map((v, i) => (i === idx ? { ...v, [field]: value } : v)));
  }

  function addRow() {
    setVendors((prev) => [...prev, { email: "", companyName: "", contactName: "" }]);
  }

  function removeRow(idx: number) {
    setVendors((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleDispatch() {
    setError(null);
    setResult(null);

    const validVendors = vendors.filter((v) => v.email.trim() && v.companyName.trim());
    if (validVendors.length === 0) {
      setError("Add at least one vendor with email and company name.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendors: validVendors.map((v) => ({
            email: v.email.trim(),
            companyName: v.companyName.trim(),
            contactName: v.contactName.trim() || undefined,
          })),
          personalMessage: personalMessage.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to dispatch");
      } else {
        setResult(data.data);
        // Clear form on success
        setVendors([{ email: "", companyName: "", contactName: "" }]);
        setPersonalMessage("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Result banner */}
      {result && (
        <div className="rounded-xl bg-green-50 ring-1 ring-green-200 p-5">
          <p className="font-semibold text-green-800">
            ✅ Dispatched to {result.dispatched.length} vendor(s)
          </p>
          {result.dispatched.length > 0 && (
            <ul className="mt-2 text-sm text-green-700 list-disc list-inside">
              {result.dispatched.map((e) => <li key={e}>{e}</li>)}
            </ul>
          )}
          {result.failed.length > 0 && (
            <div className="mt-3 text-sm text-red-700">
              <p className="font-medium">Failed:</p>
              <ul className="list-disc list-inside">
                {result.failed.map((f) => (
                  <li key={f.email}>{f.email} — {f.reason}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-3 text-xs text-green-600">
            Event status updated to <strong>Published</strong>. Refresh the page to see the updated status.
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 ring-1 ring-red-200 p-4 text-sm text-red-700">
          ❌ {error}
        </div>
      )}

      {/* Vendor table */}
      <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-3">
          <h3 className="text-sm font-semibold text-slate-700">Vendors to Invite</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs font-medium uppercase tracking-wide text-slate-400">
              <th className="px-4 py-2 text-left">Email *</th>
              <th className="px-4 py-2 text-left">Company Name *</th>
              <th className="px-4 py-2 text-left">Contact Name</th>
              <th className="px-4 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {vendors.map((v, idx) => (
              <tr key={idx} className="border-b border-slate-50">
                <td className="px-4 py-2">
                  <input
                    type="email"
                    value={v.email}
                    onChange={(e) => updateVendor(idx, "email", e.target.value)}
                    placeholder="vendor@company.com"
                    className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="text"
                    value={v.companyName}
                    onChange={(e) => updateVendor(idx, "companyName", e.target.value)}
                    placeholder="Acme Corp"
                    className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="text"
                    value={v.contactName}
                    onChange={(e) => updateVendor(idx, "contactName", e.target.value)}
                    placeholder="Jane Smith (optional)"
                    className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </td>
                <td className="px-4 py-2 text-center">
                  {vendors.length > 1 && (
                    <button
                      onClick={() => removeRow(idx)}
                      className="text-slate-300 hover:text-red-500 transition-colors text-lg leading-none"
                    >
                      ×
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-5 py-3 border-t border-slate-100">
          <button
            onClick={addRow}
            className="text-sm text-blue-600 hover:underline"
          >
            + Add another vendor
          </button>
        </div>
      </div>

      {/* Personal message */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Personal Message <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <textarea
          value={personalMessage}
          onChange={(e) => setPersonalMessage(e.target.value)}
          rows={3}
          placeholder="Add a custom note that will appear in the invitation email..."
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Dispatch button */}
      <div className="flex justify-end">
        <button
          onClick={handleDispatch}
          disabled={loading}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Dispatching…" : `Dispatch RFx →`}
        </button>
      </div>
    </div>
  );
}
