import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit/logger";
import { runExtractionPipeline } from "@/lib/extraction/pipeline";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const serviceClient = createServiceClient();

  type InvitationWithEvent = {
    id: string; event_id: string; tenant_id: string; vendor_id: string; status: string;
    rfx_events: { status: string; submission_deadline: string | null; late_response_rule: string } | null;
  };
  // Validate token
  const { data: invitation } = await serviceClient
    .from("vendor_invitations")
    .select("id, event_id, tenant_id, vendor_id, status, rfx_events(status, submission_deadline, late_response_rule)")
    .eq("invite_token", token)
    .single() as { data: InvitationWithEvent | null; error: unknown };

  if (!invitation) {
    return NextResponse.json({ error: "Invalid or expired invitation" }, { status: 404 });
  }

  const event = invitation.rfx_events;

  if (!event || ["cancelled", "awarded"].includes(event.status)) {
    return NextResponse.json({ error: "This event is no longer accepting submissions" }, { status: 410 });
  }

  const isLate =
    event.submission_deadline && new Date() > new Date(event.submission_deadline);

  if (isLate && event.late_response_rule === "reject") {
    return NextResponse.json({ error: "The submission deadline has passed" }, { status: 410 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid form submission — please use the portal form to submit" },
      { status: 400 }
    );
  }
  const emailBody = formData.get("emailBody") as string | null;
  const files = formData.getAll("files") as File[];

  if (!emailBody && files.length === 0) {
    return NextResponse.json(
      { error: "Please upload at least one file or include offer text" },
      { status: 400 }
    );
  }

  // Create submission
  const { data: submission } = await serviceClient
    .from("offer_submissions")
    .insert({
      event_id: invitation.event_id,
      tenant_id: invitation.tenant_id,
      vendor_id: invitation.vendor_id,
      invitation_id: invitation.id,
      submission_channel: "portal",
      sender_verified: true,
      status: isLate ? "late" : "received",
      extraction_status: "queued",
      email_body_text: emailBody || null,
      is_late: Boolean(isLate),
      submitted_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (!submission) {
    return NextResponse.json({ error: "Failed to create submission" }, { status: 500 });
  }

  // Upload files to Supabase Storage
  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const storagePath = `${invitation.tenant_id}/${invitation.event_id}/${submission.id}/${file.name}`;

    const { error: uploadError } = await serviceClient.storage
      .from("offer-documents")
      .upload(storagePath, buffer, { contentType: file.type, upsert: true });

    if (!uploadError) {
      await serviceClient.from("offer_attachments").insert({
        submission_id: submission.id,
        tenant_id: invitation.tenant_id,
        original_filename: file.name,
        mime_type: file.type,
        storage_path: storagePath,
        file_size_bytes: file.size,
        is_primary: files.indexOf(file) === 0,
      });
    }
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
    action: "offer.received",
    entity_type: "offer_submission",
    entity_id: submission.id,
    metadata: { channel: "portal", files: files.length, is_late: isLate },
  });

  // Trigger extraction (non-blocking)
  runExtractionPipeline({
    submissionId: submission.id,
    tenantId: invitation.tenant_id,
    eventId: invitation.event_id,
  }).catch(console.error);

  return NextResponse.json({
    data: {
      submissionId: submission.id,
      referenceCode: submission.id.substring(0, 8).toUpperCase(),
    },
  });
}
