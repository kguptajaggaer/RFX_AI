"use client";

import { useState, useRef, useEffect } from "react";
import type { RFxDraft } from "@/types/index";
import DraftPreview from "./DraftPreview";
import { useRouter } from "next/navigation";

interface Message {
  role: "user" | "assistant";
  content: string;
}

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

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    const userMessage = input.trim();
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
        body: JSON.stringify({ sessionId, message: userMessage, history: messages }),
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
    } catch (err) {
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

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-4">
      {/* Chat panel */}
      <div className="flex w-1/2 flex-col rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="border-b border-slate-200 px-5 py-4">
          <h1 className="font-semibold text-slate-900">New RFx — AI Co-pilot</h1>
          <p className="text-xs text-slate-400">
            Describe your sourcing need and I&apos;ll draft the event.
          </p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="py-12 text-center text-slate-400">
              <p className="text-4xl mb-3">🤖</p>
              <p className="text-sm">Start by describing what you need to source.</p>
              <p className="text-xs mt-2 text-slate-300">
                e.g. &quot;I need to source 500 laptops for our engineering team&quot;
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-800"
                }`}
              >
                {msg.content || (
                  <span className="inline-flex gap-1">
                    <span className="animate-bounce">●</span>
                    <span className="animate-bounce delay-100">●</span>
                    <span className="animate-bounce delay-200">●</span>
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
              placeholder="Describe your sourcing need…"
              disabled={isStreaming}
              className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isStreaming || !input.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </form>
      </div>

      {/* Draft preview panel */}
      <div className="flex w-1/2 flex-col rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="font-semibold text-slate-900">Draft Preview</h2>
            {draft?.completeness_issues && draft.completeness_issues.length > 0 && (
              <p className="text-xs text-orange-500 mt-0.5">
                {draft.completeness_issues.filter((i) => i.severity === "blocking").length} blocking issue(s)
              </p>
            )}
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
              <p className="text-sm">Your draft will appear here as you chat.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
