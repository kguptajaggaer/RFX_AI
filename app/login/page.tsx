"use client";

import { Suspense, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";

type Mode = "signin" | "signup";

function LoginForm() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/events";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (mode === "signin") {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
      } else {
        router.push(redirectTo);
        router.refresh();
      }
    } else {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          setMode("signin");
          setError("Account already exists — please sign in.");
        } else {
          setError(body.error ?? "Sign up failed");
        }
      } else {
        const supabase = createClient();
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          setError("Account created! Please sign in.");
          setMode("signin");
        } else {
          router.push(redirectTo);
          router.refresh();
        }
      }
    }

    setLoading(false);
  }

  return (
    <div className="rounded-2xl bg-white p-8 shadow-lg ring-1 ring-slate-200">
      {/* Brand */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600">
          <span className="text-xl font-bold text-white">R</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">RFX AI</h1>
        <p className="mt-1 text-sm text-slate-500">Intelligent Sourcing Platform</p>
      </div>

      {/* Mode toggle */}
      <div className="mb-6 flex rounded-lg bg-slate-100 p-1">
        {(["signin", "signup"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); setError(null); }}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
              mode === m
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {m === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700">
            Work email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-700">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"}
            className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {loading
            ? "Please wait…"
            : mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="w-full max-w-md">
        <Suspense fallback={
          <div className="rounded-2xl bg-white p-8 shadow-lg ring-1 ring-slate-200 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600">
              <span className="text-xl font-bold text-white">R</span>
            </div>
            <p className="text-sm text-slate-400">Loading…</p>
          </div>
        }>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
