import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit/logger";
import type { RFxDraft } from "@/types/index";

// GET /api/events — list events for the current tenant
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  let query = supabase
    .from("rfx_events")
    .select("id, title, event_type, status, submission_deadline, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status as "draft" | "in_review" | "approved" | "published" | "closed" | "awarded" | "cancelled");

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data });
}

// POST /api/events — create event from AI draft
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 403 });

  const { draft, sessionId }: { draft: RFxDraft; sessionId?: string } = await request.json();

  const serviceClient = createServiceClient();

  // Create event
  const { data: event, error: eventError } = await serviceClient
    .from("rfx_events")
    .insert({
      tenant_id: profile.tenant_id,
      title: draft.title,
      event_type: draft.event_type,
      status: "draft",
      description: draft.description ?? null,
      background: draft.background ?? null,
      submission_deadline: draft.submission_deadline ?? null,
      questions_deadline: draft.questions_deadline ?? null,
      award_date: draft.award_date ?? null,
      late_response_rule: draft.late_response_rule ?? "hold",
      evaluation_criteria: draft.evaluation_criteria as import("@/types/database").Json ?? null,
      completeness_issues: draft.completeness_issues as import("@/types/database").Json ?? null,
      ai_session_id: sessionId ?? null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (eventError || !event) {
    return NextResponse.json({ error: eventError?.message ?? "Failed to create event" }, { status: 500 });
  }

  // Insert schema fields
  if (draft.schema_fields?.length) {
    const fields = draft.schema_fields.map((f, i) => ({
      event_id: event.id,
      tenant_id: profile.tenant_id,
      field_key: f.field_key,
      label: f.label,
      section: f.section ?? null,
      data_type: f.data_type,
      currency_code: f.currency_code ?? null,
      options: f.options as import("@/types/database").Json ?? null,
      required: f.required,
      is_price_field: f.is_price_field,
      help_text: f.help_text ?? null,
      display_order: i,
    }));

    await serviceClient.from("rfx_schema_fields").insert(fields);
  }

  // Link session to event
  if (sessionId) {
    await serviceClient
      .from("ai_drafting_sessions")
      .update({ event_id: event.id, status: "completed" })
      .eq("id", sessionId);
  }

  await logAudit({
    tenant_id: profile.tenant_id,
    event_id: event.id,
    actor_id: user.id,
    actor_type: "buyer",
    action: "rfx.created",
    entity_type: "rfx_event",
    entity_id: event.id,
    new_value: { title: draft.title, event_type: draft.event_type },
  });

  return NextResponse.json({ data: event }, { status: 201 });
}
