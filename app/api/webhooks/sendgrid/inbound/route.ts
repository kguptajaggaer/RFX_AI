import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { extractReplyToken } from "@/lib/email-routing/tokens";
import { logAudit } from "@/lib/audit/logger";
import { runExtractionPipeline } from "@/lib/extraction/pipeline";

export const runtime = "nodejs";

// Disable Next.js body parsing — we need the raw multipart body
export const config = { api: { bodyParser: false } };

type QuarantineReason =
  | "token_not_found"
  | "sender_mismatch"
  | "event_closed"
  | "late_submission"
  | "duplicate";

export async function POST(request: NextRequest) {
  // Always return 200 to SendGrid immediately (retry on non-200)
  // Do the heavy work without blocking the response
  processInbound(request.clone()).catch((err) =>
    console.error("[inbound] unhandled error:", err)
  );
  return NextResponse.json({ ok: true });
}

async function processInbound(request: Request) {
  const serviceClient = createServiceClient();
  const formData = await request.formData();

  const from = String(formData.get("from") ?? "");
  const to = String(formData.get("to") ?? "");
  const subject = String(formData.get("subject") ?? "");
  const bodyText = String(formData.get("text") ?? "");
  const bodyHtml = String(formData.get("html") ?? "");

  // Parse sender email from "Name <email>" format
  const senderEmailMatch = from.match(/<([^>]+)>/) ?? from.match(/\S+@\S+/);
  const senderEmail = (senderEmailMatch?.[1] ?? senderEmailMatch?.[0] ?? from).toLowerCase().trim();

  // Parse reply token from To address
  const replyToken = extractReplyToken(to);

  async function quarantine(reason: QuarantineReason, invitationId?: string, tenantId?: string) {
    await serviceClient.from("email_quarantine").insert({
      tenant_id: tenantId ?? null,
      from_email: senderEmail,
      to_email: to,
      reply_token: replyToken,
      matched_invitation_id: invitationId ?? null,
      subject,
      body_preview: bodyText.substring(0, 500),
      attachment_count: countAttachments(formData),
      quarantine_reason: reason,
      status: "quarantined",
    });
  }

  if (!replyToken) {
    await quarantine("token_not_found");
    return;
  }

  type InvitationFull = {
    id: string; event_id: string; tenant_id: string; vendor_id: string; status: string;
    vendors: { primary_email: string } | null;
    rfx_events: { status: string; submission_deadline: string | null; late_response_rule: string } | null;
  };
  // Look up invitation by reply token
  const { data: invitation } = await serviceClient
    .from("vendor_invitations")
    .select("id, event_id, tenant_id, vendor_id, status, vendors(primary_email), rfx_events(status, submission_deadline, late_response_rule)")
    .eq("invite_token", replyToken)
    .single() as { data: InvitationFull | null; error: unknown };

  if (!invitation) {
    await quarantine("token_not_found");
    return;
  }

  const vendor = invitation.vendors;
  const event = invitation.rfx_events;

  // Verify sender matches invited vendor
  if (!vendor || senderEmail !== vendor.primary_email) {
    await quarantine("sender_mismatch", invitation.id, invitation.tenant_id);
    return;
  }

  // Check event is still open
  if (!event || ["cancelled", "awarded"].includes(event.status)) {
    await quarantine("event_closed", invitation.id, invitation.tenant_id);
    return;
  }

  const isLate =
    event.submission_deadline && new Date() > new Date(event.submission_deadline);

  if (isLate && event.late_response_rule === "reject") {
    await quarantine("late_submission", invitation.id, invitation.tenant_id);
    return;
  }

  // Check for duplicate
  const { data: existing } = await serviceClient
    .from("offer_submissions")
    .select("id")
    .eq("invitation_id", invitation.id)
    .neq("status", "quarantined")
    .maybeSingle();

  if (existing) {
    await quarantine("duplicate", invitation.id, invitation.tenant_id);
    return;
  }

  // Create submission
  const { data: submission } = await serviceClient
    .from("offer_submissions")
    .insert({
      event_id: invitation.event_id,
      tenant_id: invitation.tenant_id,
      vendor_id: invitation.vendor_id,
      invitation_id: invitation.id,
      submission_channel: "email",
      sender_email: senderEmail,
      sender_verified: true,
      status: isLate ? "late" : "received",
      extraction_status: "queued",
      email_subject: subject,
      email_body_text: bodyText || null,
      email_body_html: bodyHtml || null,
      is_late: Boolean(isLate),
      submitted_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (!submission) return;

  // Upload and record attachments
  let attachmentIndex = 1;
  while (formData.has(`attachment${attachmentIndex}`)) {
    const file = formData.get(`attachment${attachmentIndex}`) as File | null;
    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const storagePath = `${invitation.tenant_id}/${invitation.event_id}/${submission.id}/${file.name}`;

      await serviceClient.storage
        .from("offer-documents")
        .upload(storagePath, buffer, { contentType: file.type, upsert: true });

      await serviceClient.from("offer_attachments").insert({
        submission_id: submission.id,
        tenant_id: invitation.tenant_id,
        original_filename: file.name,
        mime_type: file.type,
        storage_path: storagePath,
        file_size_bytes: file.size,
        is_primary: attachmentIndex === 1,
      });
    }
    attachmentIndex++;
  }

  // Update invitation status
  await serviceClient
    .from("vendor_invitations")
    .update({ status: "submitted", submitted_at: new Date().toISOString() })
    .eq("id", invitation.id);

  await logAudit({
    tenant_id: invitation.tenant_id,
    event_id: invitation.event_id,
    submission_id: submission.id,
    actor_type: "vendor",
    actor_label: senderEmail,
    action: "offer.received",
    entity_type: "offer_submission",
    entity_id: submission.id,
    metadata: { channel: "email", is_late: isLate, attachments: attachmentIndex - 1 },
  });

  // Trigger extraction pipeline (non-blocking)
  runExtractionPipeline({
    submissionId: submission.id,
    tenantId: invitation.tenant_id,
    eventId: invitation.event_id,
  }).catch((err) => console.error("[extraction] pipeline error:", err));
}

function countAttachments(formData: FormData): number {
  let count = 0;
  let i = 1;
  while (formData.has(`attachment${i}`)) {
    count++;
    i++;
  }
  return count;
}
