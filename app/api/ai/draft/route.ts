import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { streamDraftingConversation, UPDATE_DRAFT_FUNCTION, DRAFTING_SYSTEM_PROMPT } from "@/lib/openai/drafting";
import type { RFxDraft } from "@/types/index";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const serviceClient = createServiceClient();

  let { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  // Auto-provision profile if missing (new user)
  if (!profile) {
    const email = user.email ?? "";
    const domain = email.split("@")[1] ?? "company.com";
    const slug = domain.replace(/[^a-z0-9]/gi, "-").toLowerCase();
    const name = domain.split(".")[0];
    const { data: tenant } = await serviceClient
      .from("tenants")
      .upsert({ name, slug, inbound_email_domain: "inbound.rfxai.com" }, { onConflict: "slug" })
      .select("id").single();
    if (tenant) {
      const { data: newProfile } = await serviceClient
        .from("profiles")
        .insert({ id: user.id, tenant_id: tenant.id, email, role: "admin" })
        .select("tenant_id").single();
      profile = newProfile;
    }
  }

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 403 });

  const { sessionId, message, history = [], currentDraft = null } = await request.json();

  // Load existing session messages if resuming
  let existingMessages: Array<{ role: "user" | "assistant"; content: string }> = history;
  let currentSessionId: string | null = sessionId ?? null;

  if (currentSessionId) {
    const { data: session } = await serviceClient
      .from("ai_drafting_sessions")
      .select("messages")
      .eq("id", currentSessionId)
      .single();
    if (session?.messages) {
      existingMessages = session.messages as typeof existingMessages;
    }
  }

  const allMessages = [...existingMessages, { role: "user" as const, content: message }];

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      let latestDraft: Partial<RFxDraft> | null = null;
      let fullText = "";

      try {
        const generator = streamDraftingConversation(
          allMessages,
          (draft) => {
            latestDraft = draft;
            send({ type: "draft_update", draft });
          },
          currentDraft
        );

        for await (const token of generator) {
          fullText += token;
          send({ type: "delta", content: token });
        }

        // Upsert session
        const updatedMessages = [
          ...allMessages,
          { role: "assistant" as const, content: fullText },
        ];

        if (!currentSessionId) {
          const { data: newSession } = await serviceClient
            .from("ai_drafting_sessions")
            .insert({
              tenant_id: profile.tenant_id,
              created_by: user.id,
              messages: updatedMessages as import("@/types/database").Json,
              current_draft: latestDraft as import("@/types/database").Json,
              status: "active",
              model_version: "gpt-4o",
            })
            .select("id")
            .single();
          currentSessionId = newSession?.id ?? null;
        } else {
          await serviceClient
            .from("ai_drafting_sessions")
            .update({
              messages: updatedMessages as import("@/types/database").Json,
              current_draft: latestDraft as import("@/types/database").Json,
            })
            .eq("id", currentSessionId);
        }

        if (currentSessionId) {
          send({ type: "session", sessionId: currentSessionId });
        }

        send({ type: "done" });
      } catch (err) {
        send({ type: "error", message: "Streaming error" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
