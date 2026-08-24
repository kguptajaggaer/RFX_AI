"use client";

import { useState, useRef, useEffect } from "react";
import type { RFxDraft } from "@/types/index";
import DraftPreview from "./DraftPreview";
import { useRouter } from "next/navigation";
import { TEMPLATES, TEMPLATE_GREETINGS } from "@/lib/drafting-templates";

interface Message {
  role: "user" | "assistant";
  content: string;
}

// ── Quick-start scenarios — keys match TEMPLATES in lib/drafting-templates.ts ──
const QUICK_STARTS = [
  {
    icon: "💻",
    label: "1,000 Laptops",
    description: "Engineering-grade laptops",
    templateKey: "laptops",
  },
  {
    icon: "🪑",
    label: "1,000 Office Chairs",
    description: "Ergonomic task & executive seating",
    templateKey: "chairs",
  },
  {
    icon: "📡",
    label: "500 WiFi Routers",
    description: "Enterprise WiFi 6E access points",
    templateKey: "routers",
  },
  {
    icon: "🛒",
    label: "All Three Together",
    description: "Laptops + Chairs + WiFi Routers",
    templateKey: "all_three",
  },
];

export default function DraftingInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [draft, setDraft] = useState<Partial<RFxDraft> | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /**
   * Load a pre-saved template instantly — no LLM call.
   * The draft appears immediately; the user can then refine it via chat.
   */
  function handleQuickStart(templateKey: string, label: string) {
    if (isStreaming) return;

    const template = TEMPLATES[templateKey];
    const greeting = TEMPLATE_GREETINGS[templateKey];
    if (!template) return;

    setDraft(template);
    setMessages([
      { role: "user", content: `Create a detailed RFQ for ${label}` },
      { role: "assistant", content: greeting },
    ]);
    // Session stays empty; first refinement message creates it
    setSessionId(null);
  }

  async function sendMessage(e: React.FormEvent, overrideText?: string) {
    e.preventDefault();
    const userMessage = (overrideText ?? input).trim();
    if (!userMessage || isStreaming) return;

    setInput("");
    setIsStreaming(true);

    const newMessages = [...messages, { role: "user" as const, content: userMessage }];
    setMessages(newMessages);

    let assistantText = "";
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/ai/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          message: userMessage,
          // Only send the conversational history — not the instant-loaded greeting pair
          history: messages,
          // Always send current draft so AI can amend it rather than starting from scratch
          currentDraft: draft,
        }),
      });

      if (!res.body) throw new Error("No stream body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.type === "delta") {
                assistantText += parsed.content;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: assistantText,
                  };
                  return updated;
                });
              } else if (parsed.type === "draft_update") {
                setDraft(parsed.draft);
              } else if (parsed.type === "session") {
                setSessionId(parsed.sessionId);
              }
            } catch {
              // Non-JSON line — skip
            }
          }
        }
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
        };
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  }

  async function saveDraft() {
    if (!draft?.title || isSaving) return;
    setIsSaving(true);

    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draft, sessionId }),
    });

    if (res.ok) {
      const { data } = await res.json();
      router.push(`/events/${data.id}`);
    } else {
      setIsSaving(false);
    }
  }

  const hasBlockingIssues = draft?.completeness_issues?.some(
    (i) => i.severity === "blocking"
  );

  const fieldCount = draft?.schema_fields?.length ?? 0;

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-4">
      {/* Chat panel */}
      <div className="flex w-1/2 flex-col rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="border-b border-slate-200 px-5 py-4">
          <h1 className="font-semibold text-slate-900">New RFx — AI Co-pilot</h1>
          <p className="text-xs text-slate-400">
            Pick a quick start for an instant draft, or describe your own sourcing need.
          </p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="space-y-4">
              {/* Welcome */}
              <div className="py-6 text-center text-slate-400">
                <p className="text-4xl mb-2">🤖</p>
                <p className="text-sm font-medium text-slate-600">AI Procurement Co-pilot</p>
                <p className="text-xs mt-1 text-slate-400">
                  Quick starts load instantly. Then refine anything via chat.
                </p>
              </div>

              {/* Quick-start chips */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                  Quick start — instant draft
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {QUICK_STARTS.map((qs) => (
                    <button
                      key={qs.label}
                      onClick={() => handleQuickStart(qs.templateKey, qs.label)}
                      disabled={isStreaming}
                      className="group flex flex-col items-start gap-1 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-left transition-all hover:border-blue-300 hover:bg-blue-50 disabled:opacity-50"
                    >
                      <span className="text-xl">{qs.icon}</span>
                      <span className="text-sm font-semibold text-slate-800 group-hover:text-blue-700">
                        {qs.label}
                      </span>
                      <span className="text-xs text-slate-400 group-hover:text-blue-500">
                        {qs.description}
                      </span>
                      <span className="text-[10px] text-green-600 font-medium">⚡ Instant</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-3 text-xs text-slate-400">or describe your own</span>
                </div>
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="mr-2 mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                  R
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-800"
                }`}
              >
                {msg.content || (
                  <span className="inline-flex gap-1">
                    <span className="animate-bounce">●</span>
                    <span className="animate-bounce" style={{ animationDelay: "0.15s" }}>●</span>
                    <span className="animate-bounce" style={{ animationDelay: "0.3s" }}>●</span>
                  </span>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form onSubmit={sendMessage} className="border-t border-slate-200 p-4">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                draft
                  ? "Ask for changes — e.g. 'Add a 3-year support contract field' or 'Change payment terms to Net 60'…"
                  : "Describe your sourcing need…"
              }
              disabled={isStreaming}
              className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isStreaming || !input.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isStreaming ? "…" : "Send"}
            </button>
          </div>
        </form>
      </div>

      {/* Draft preview panel */}
      <div className="flex w-1/2 flex-col rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="font-semibold text-slate-900">Draft Preview</h2>
            <div className="flex items-center gap-3 mt-0.5">
              {fieldCount > 0 && (
                <span className="text-xs font-medium text-slate-400">
                  {fieldCount} fields drafted
                </span>
              )}
              {draft?.completeness_issues && draft.completeness_issues.filter(i => i.severity === "blocking").length > 0 && (
                <span className="text-xs text-red-500">
                  {draft.completeness_issues.filter(i => i.severity === "blocking").length} blocking issue(s)
                </span>
              )}
            </div>
          </div>
          {draft?.title && (
            <button
              onClick={saveDraft}
              disabled={isSaving || hasBlockingIssues === true}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              title={hasBlockingIssues ? "Resolve blocking issues before saving" : undefined}
            >
              {isSaving ? "Saving…" : "Save Draft →"}
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {draft ? (
            <DraftPreview draft={draft} />
          ) : (
            <div className="py-20 text-center text-slate-300">
              <p className="text-4xl mb-3">📄</p>
              <p className="text-sm">Your draft will appear here instantly.</p>
              <p className="text-xs mt-2 text-slate-200">
                Pick a quick start above — 25+ fields load in under a second.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
