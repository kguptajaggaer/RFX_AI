import { createServiceClient } from "@/lib/supabase/server";
import { getOpenAIClient, EXTRACTION_MODEL, VISION_MODEL } from "@/lib/openai/client";
import { scoreToLabel } from "./confidence";
import type { ExtractionResult, RFxSchemaField, SourceRef } from "@/types/index";

const EXTRACTION_SYSTEM_PROMPT = `You are a precision data extraction engine for procurement offers.
You receive an RFx event schema and a vendor offer document.
Extract values for each schema field from the document.

RULES:
- Only extract from the provided document. Do not infer, assume, or fill in from prior knowledge.
- For each field: provide the verbatim raw_text from the document, a normalized_value, a confidence_score (0.0–1.0), and the source location.
- Confidence calibration:
  * 0.95–1.0: Exact label match, unambiguous value, single occurrence
  * 0.70–0.94: Similar label, value parseable, single occurrence
  * 0.40–0.69: Inferred from context, multiple possible matches
  * 0.00–0.39: Highly uncertain or no reliable match
  * 0.00: Field not present in document (confidence_label = "not_found")
- For currency fields: always capture both amount and currency code.
- For price fields: a wrong price or currency is a critical extraction failure — prefer "not_found" over a guess.
- Provide source_location as precisely as possible (page, char_offset or bbox, cell_ref, etc.).`;

interface ExtractionInput {
  submissionId: string;
  tenantId: string;
  eventId: string;
}

export async function runExtractionPipeline(input: ExtractionInput): Promise<void> {
  const supabase = createServiceClient();

  // Mark as in_progress
  await supabase
    .from("offer_submissions")
    .update({ extraction_status: "in_progress" })
    .eq("id", input.submissionId);

  try {
    // Load submission + attachments + schema
    const [{ data: submission }, { data: schema }, { data: attachments }] =
      await Promise.all([
        supabase
          .from("offer_submissions")
          .select("*")
          .eq("id", input.submissionId)
          .single(),
        supabase
          .from("rfx_schema_fields")
          .select("*")
          .eq("event_id", input.eventId)
          .order("display_order"),
        supabase
          .from("offer_attachments")
          .select("*")
          .eq("submission_id", input.submissionId),
      ]);

    if (!submission || !schema) throw new Error("Submission or schema not found");

    const allResults: ExtractionResult[] = [];

    // Extract from email body if present
    if (submission.email_body_text) {
      const bodyResults = await extractFromText(
        submission.email_body_text,
        schema,
        "email_parse",
        null
      );
      allResults.push(...bodyResults);
    }

    // Extract from each attachment
    for (const attachment of attachments ?? []) {
      const { data: fileData } = await supabase.storage
        .from("offer-documents")
        .download(attachment.storage_path);

      if (!fileData) continue;

      const buffer = Buffer.from(await fileData.arrayBuffer());
      let results: ExtractionResult[] = [];

      if (attachment.mime_type.includes("pdf")) {
        results = await extractFromPDF(buffer, schema, attachment.id);
      } else if (
        attachment.mime_type.includes("spreadsheet") ||
        attachment.mime_type.includes("excel") ||
        attachment.original_filename.endsWith(".xlsx") ||
        attachment.original_filename.endsWith(".csv")
      ) {
        results = await extractFromSpreadsheet(buffer, schema, attachment.id);
      } else if (
        attachment.mime_type.includes("word") ||
        attachment.original_filename.endsWith(".docx")
      ) {
        results = await extractFromDocx(buffer, schema, attachment.id);
      } else if (attachment.mime_type.startsWith("image/")) {
        results = await extractFromImage(buffer, schema, attachment.id, attachment.mime_type);
      }

      allResults.push(...results);
    }

    // Merge and detect conflicts between email body and attachments
    const merged = mergeResults(allResults, !!submission.email_body_text);

    // Store in extracted_values
    const rows = merged.map((r) => ({
      submission_id: input.submissionId,
      tenant_id: input.tenantId,
      event_id: input.eventId,
      attachment_id: r.source_ref ? null : null, // set per-result
      field_key: r.field_key,
      raw_text: r.raw_text,
      normalized_value: r.normalized_value as import("@/types/database").Json,
      confidence_score: r.confidence_score,
      confidence_label: r.confidence_label,
      source_ref: r.source_ref as import("@/types/database").Json,
      extraction_method: r.extraction_method,
      model_version: `${EXTRACTION_MODEL}-2024`,
      is_flagged: r.is_flagged,
      flag_reason: r.flag_reason ?? null,
      has_conflict: r.has_conflict,
      conflict_detail: r.conflict_detail as import("@/types/database").Json ?? null,
    }));

    await supabase.from("extracted_values").insert(rows);

    // Mark completed
    await supabase
      .from("offer_submissions")
      .update({ extraction_status: "completed", status: "extracted" })
      .eq("id", input.submissionId);

    // Rebuild comparison grid cache
    await rebuildGridCache(input.eventId, input.tenantId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from("offer_submissions")
      .update({ extraction_status: "queued", extraction_error: message })
      .eq("id", input.submissionId);
    throw err;
  }
}

async function extractFromText(
  text: string,
  schema: RFxSchemaField[],
  method: ExtractionResult["extraction_method"],
  attachmentId: string | null
): Promise<ExtractionResult[]> {
  const client = getOpenAIClient();

  const schemaDescription = schema
    .map((f) => `- ${f.field_key} (${f.label}): ${f.data_type}${f.is_price_field ? " [PRICE FIELD]" : ""}`)
    .join("\n");

  const response = await client.chat.completions.create({
    model: EXTRACTION_MODEL,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
      {
        role: "user",
        content: `SCHEMA FIELDS TO EXTRACT:\n${schemaDescription}\n\nDOCUMENT TEXT:\n${text.substring(0, 60000)}`,
      },
    ],
  });

  return parseExtractionResponse(
    response.choices[0]?.message?.content ?? "{}",
    schema,
    method
  );
}

async function extractFromPDF(
  buffer: Buffer,
  schema: RFxSchemaField[],
  attachmentId: string
): Promise<ExtractionResult[]> {
  // Dynamic import to avoid build issues
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfParse = (await import("pdf-parse") as any).default ?? (await import("pdf-parse"));
  try {
    const parsed = await pdfParse(buffer);
    if (parsed.text.trim().length > 100) {
      // Has selectable text — use text extraction
      return extractFromText(parsed.text, schema, "llm_text", attachmentId);
    }
  } catch {
    // Fall through to Vision
  }
  // Scanned PDF — fall through to Vision
  return extractFromImage(buffer, schema, attachmentId, "application/pdf");
}

async function extractFromSpreadsheet(
  buffer: Buffer,
  schema: RFxSchemaField[],
  attachmentId: string
): Promise<ExtractionResult[]> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "buffer" });

  let combinedText = "";
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    combinedText += `\n=== Sheet: ${sheetName} ===\n${csv}`;
  }

  return extractFromText(combinedText, schema, "spreadsheet_parse", attachmentId);
}

async function extractFromDocx(
  buffer: Buffer,
  schema: RFxSchemaField[],
  attachmentId: string
): Promise<ExtractionResult[]> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return extractFromText(result.value, schema, "llm_text", attachmentId);
}

async function extractFromImage(
  buffer: Buffer,
  schema: RFxSchemaField[],
  attachmentId: string,
  mimeType: string
): Promise<ExtractionResult[]> {
  const client = getOpenAIClient();
  const base64 = buffer.toString("base64");
  const dataUrl = `data:${mimeType === "application/pdf" ? "image/jpeg" : mimeType};base64,${base64}`;

  const schemaDescription = schema
    .map((f) => `- ${f.field_key} (${f.label}): ${f.data_type}${f.is_price_field ? " [PRICE FIELD]" : ""}`)
    .join("\n");

  const response = await client.chat.completions.create({
    model: VISION_MODEL,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `SCHEMA FIELDS TO EXTRACT:\n${schemaDescription}\n\nFor each found value, include bbox as [left, top, width, height] as fractions of page dimensions (0.0–1.0).\n\nReturn JSON with "fields" array.`,
          },
          { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
        ],
      },
    ],
  });

  return parseExtractionResponse(
    response.choices[0]?.message?.content ?? "{}",
    schema,
    "llm_vision"
  );
}

function parseExtractionResponse(
  jsonStr: string,
  schema: RFxSchemaField[],
  method: ExtractionResult["extraction_method"]
): ExtractionResult[] {
  let parsed: { fields?: unknown[] } = {};
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return [];
  }

  const fields = Array.isArray(parsed.fields) ? parsed.fields : [];
  return fields.map((f: unknown) => {
    const field = f as Record<string, unknown>;
    const score = typeof field.confidence_score === "number" ? field.confidence_score : 0;
    const schemaField = schema.find((s) => s.field_key === field.field_key);
    return {
      field_key: String(field.field_key ?? ""),
      raw_text: field.raw_text ? String(field.raw_text) : null,
      normalized_value: field.normalized_value ?? null,
      confidence_score: score,
      confidence_label: scoreToLabel(score),
      source_ref: (field.source_location ?? field.source_ref ?? null) as SourceRef | null,
      extraction_method: method,
      is_flagged:
        schemaField?.is_price_field === true && score < 0.5,
      flag_reason:
        schemaField?.is_price_field && score < 0.5
          ? "Low-confidence price field — requires buyer confirmation"
          : undefined,
      has_conflict: false,
    };
  });
}

function mergeResults(
  results: ExtractionResult[],
  hasEmailBody: boolean | null
): ExtractionResult[] {
  const byField: Record<string, ExtractionResult[]> = {};
  for (const r of results) {
    if (!byField[r.field_key]) byField[r.field_key] = [];
    byField[r.field_key].push(r);
  }

  return Object.entries(byField).map(([, fieldResults]) => {
    if (fieldResults.length === 1) return fieldResults[0];

    // Pick highest confidence
    const best = [...fieldResults].sort((a, b) => b.confidence_score - a.confidence_score)[0];

    // Check for conflict between sources
    const emailResult = fieldResults.find((r) => r.extraction_method === "email_parse");
    const attachmentResult = fieldResults.find((r) => r.extraction_method !== "email_parse");

    if (emailResult && attachmentResult && hasEmailBody) {
      const eq = JSON.stringify(emailResult.normalized_value) === JSON.stringify(attachmentResult.normalized_value);
      if (!eq) {
        return {
          ...best,
          confidence_label: "conflicted",
          has_conflict: true,
          is_flagged: true,
          flag_reason: "Conflicting values found in email body and attachment",
          conflict_detail: {
            body_value: emailResult.normalized_value,
            attachment_value: attachmentResult.normalized_value,
            attachment_filename: "",
          },
        };
      }
    }

    return best;
  });
}

async function rebuildGridCache(eventId: string, tenantId: string): Promise<void> {
  const supabase = createServiceClient();

  const [{ data: fields }, { data: submissions }, { data: confirmed }] =
    await Promise.all([
      supabase.from("rfx_schema_fields").select("*").eq("event_id", eventId).order("display_order"),
      supabase
        .from("offer_submissions")
        .select("*, vendors(id, company_name), vendor_invitations(status)")
        .eq("event_id", eventId)
        .neq("status", "disqualified"),
      supabase.from("confirmed_values").select("*").eq("event_id", eventId),
    ]);

  if (!fields || !submissions) return;

  const confirmedMap: Record<string, Record<string, unknown>> = {};
  for (const cv of confirmed ?? []) {
    if (!confirmedMap[cv.submission_id]) confirmedMap[cv.submission_id] = {};
    confirmedMap[cv.submission_id][cv.field_key] = cv.confirmed_value;
  }

  const priceFields = fields.filter((f) => f.is_price_field);
  const blockingFields: string[] = [];

  // Find unconfirmed low-confidence price fields
  const { data: lowConfExtracted } = await supabase
    .from("extracted_values")
    .select("submission_id, field_key, confidence_label")
    .eq("event_id", eventId)
    .in("confidence_label", ["low", "not_found", "conflicted"]);

  for (const ex of lowConfExtracted ?? []) {
    const priceField = priceFields.find((f) => f.field_key === ex.field_key);
    if (!priceField) continue;
    const confirmed = confirmedMap[ex.submission_id]?.[ex.field_key];
    if (!confirmed) blockingFields.push(ex.field_key);
  }

  await supabase.from("comparison_grid_cache").upsert({
    event_id: eventId,
    tenant_id: tenantId,
    grid_data: { fields, submissions, confirmed: confirmedMap } as import("@/types/database").Json,
    has_unconfirmed_low_conf: blockingFields.length > 0,
    award_blocked_field_keys: [...new Set(blockingFields)],
    last_rebuilt_at: new Date().toISOString(),
  });
}
