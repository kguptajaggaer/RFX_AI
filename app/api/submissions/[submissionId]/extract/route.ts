import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { runExtractionPipeline } from "@/lib/extraction/pipeline";
import { logAudit } from "@/lib/audit/logger";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  const { submissionId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 403 });

  const serviceClient = createServiceClient();

  // Get submission
  const { data: submission } = await serviceClient
    .from("offer_submissions")
    .select("id, event_id, tenant_id, extraction_status")
    .eq("id", submissionId)
    .single();

  if (!submission || submission.tenant_id !== profile.tenant_id) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  // Parse body — accept either JSON { vendorText } or multipart FormData { emailBody, file* }
  let vendorText: string | undefined;
  let uploadedFiles: File[] = [];

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const emailBody = formData.get("emailBody");
    if (typeof emailBody === "string" && emailBody.trim()) {
      vendorText = emailBody.trim();
    }
    uploadedFiles = formData.getAll("file").filter((f): f is File => f instanceof File);
  } else {
    try {
      const body: { vendorText?: string } = await request.json();
      vendorText = body.vendorText?.trim();
    } catch { /* no body */ }
  }

  // Save vendor text as the email body if provided
  if (vendorText) {
    await serviceClient
      .from("offer_submissions")
      .update({ email_body_text: vendorText })
      .eq("id", submissionId);
  }

  // Upload any buyer-added files to storage and create attachment records
  for (const file of uploadedFiles) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const storagePath = `${submission.tenant_id}/${submission.event_id}/${submissionId}/${file.name}`;

    const { error: uploadError } = await serviceClient.storage
      .from("offer-documents")
      .upload(storagePath, buffer, { contentType: file.type, upsert: true });

    if (!uploadError) {
      await serviceClient.from("offer_attachments").insert({
        submission_id: submissionId,
        tenant_id: submission.tenant_id,
        original_filename: file.name,
        mime_type: file.type,
        storage_path: storagePath,
        file_size_bytes: file.size,
        is_primary: true,
      });
    }
  }

  // Delete any previous extraction results so we re-run clean
  await serviceClient
    .from("extracted_values")
    .delete()
    .eq("submission_id", submissionId);

  let pipelineWarnings: string[] = [];
  try {
    const result = await runExtractionPipeline({
      submissionId,
      tenantId: profile.tenant_id,
      eventId: submission.event_id,
    });
    pipelineWarnings = result.warnings ?? [];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Load fresh extracted values + schema
  const [{ data: extracted }, { data: fields }] = await Promise.all([
    serviceClient
      .from("extracted_values")
      .select(
        "field_key, raw_text, normalized_value, confidence_score, confidence_label, is_flagged, flag_reason, has_conflict, conflict_detail"
      )
      .eq("submission_id", submissionId),
    serviceClient
      .from("rfx_schema_fields")
      .select("field_key, label, data_type, is_price_field, required, section")
      .eq("event_id", submission.event_id)
      .order("display_order"),
  ]);

  await logAudit({
    tenant_id: profile.tenant_id,
    event_id: submission.event_id,
    submission_id: submissionId,
    actor_id: user.id,
    actor_type: "buyer",
    action: "offer.extracted",
    entity_type: "offer_submission",
    entity_id: submissionId,
    new_value: {
      fields_extracted: extracted?.length ?? 0,
      high_confidence: extracted?.filter((e) => e.confidence_label === "high").length ?? 0,
    },
  });

  return NextResponse.json({
    data: {
      extracted: extracted ?? [],
      fields: fields ?? [],
      warnings: pipelineWarnings,
    },
  });
}
