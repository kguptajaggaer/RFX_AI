"use client";

import { useState } from "react";

type Props = {
  profile: {
    id: string;
    full_name: string | null;
    email: string;
    role: string;
  };
  tenant: {
    name: string;
    slug: string;
    inbound_email_domain: string | null;
  } | null;
};

export default function SettingsForm({ profile, tenant }: Props) {
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    const res = await fetch("/api/settings/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: fullName }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Save failed");
    }
  }

  return (
    <div className="space-y-8">
      {/* Profile card */}
      <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="font-semibold text-slate-900">Your Profile</h2>
          <p className="text-sm text-slate-400">Update your display name.</p>
        </div>
        <div className="px-6 py-6 space-y-5">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-xl font-bold text-white">
              {(fullName || profile.email)[0]?.toUpperCase() ?? "?"}
            </div>
            <div>
              <p className="font-medium text-slate-900">{fullName || profile.email}</p>
              <p className="text-sm capitalize text-slate-400">{profile.role}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">
                Display Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">
                Email Address
              </label>
              <input
                type="email"
                value={profile.email}
                readOnly
                className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Role</label>
              <input
                type="text"
                value={profile.role}
                readOnly
                className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm capitalize text-slate-500 cursor-not-allowed"
              />
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 ring-1 ring-red-200">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
            {saved && (
              <span className="text-sm text-green-600 font-medium">✓ Saved</span>
            )}
          </div>
        </div>
      </div>

      {/* Tenant card */}
      {tenant && (
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="font-semibold text-slate-900">Organisation</h2>
            <p className="text-sm text-slate-400">Your workspace details. Contact support to change.</p>
          </div>
          <div className="px-6 py-6 grid grid-cols-2 gap-5">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">
                Organisation Name
              </label>
              <input
                type="text"
                value={tenant.name}
                readOnly
                className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500 cursor-not-allowed capitalize"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Slug</label>
              <input
                type="text"
                value={tenant.slug}
                readOnly
                className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-mono text-slate-500 cursor-not-allowed"
              />
            </div>
            <div className="col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-slate-600">
                Inbound Email Domain
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={tenant.inbound_email_domain ?? "Not configured"}
                  readOnly
                  className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-mono text-slate-500 cursor-not-allowed"
                />
                <span className="whitespace-nowrap text-xs text-slate-400">
                  Vendors email replies here
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI / Integration info */}
      <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="font-semibold text-slate-900">AI Configuration</h2>
          <p className="text-sm text-slate-400">Current model and endpoint settings (read-only).</p>
        </div>
        <div className="px-6 py-6 grid grid-cols-2 gap-5">
          {[
            { label: "Extraction Model",   value: "Qwen 3 32B" },
            { label: "Inference Provider", value: "Amazon Bedrock Mantle" },
            { label: "Region",             value: "eu-north-1" },
            { label: "Context Window",     value: "32,768 tokens" },
          ].map(({ label, value }) => (
            <div key={label}>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">{label}</label>
              <input
                type="text"
                value={value}
                readOnly
                className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500 cursor-not-allowed"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
