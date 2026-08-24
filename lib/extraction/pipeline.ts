import { createServiceClient } from "@/lib/supabase/server";
import { getOpenAIClient, EXTRACTION_MODEL, VISION_MODEL } from "@/lib/openai/client";
import { scoreToLabel } from "./confidence";
import type { ExtractionResult, RFxSchemaField, SourceRef } from "@/types/index";

const EXTRACTION_SYSTEM_PROMPT = `You are a precision data extraction engine for procurement offers.
You receive an RFx schema (list of required fields) and a vendor offer document.
Your job: extract the value of EVERY schema field from the document.

OUTPUT FORMAT — return a single JSON object where each key is a field_key from the schema:
{
  "<field_key>": {
    "raw_text": "<verbatim text from document, or null if not found>",
    "normalized_value": <extracted value in correct type, or null if not found>,
    "confidence_score": <0.0–1.0>,
    "source_location": "<page/line/cell reference, or null>"
  },
  ...
}

RULES:
1. Include EVERY field_key from the schema in your response, even if not found (use confidence_score: 0.0, normalized_value: null).
2. Only extract from the provided document — do NOT infer or guess values not present.
3. For number fields: normalized_value must be a number (e.g. 42, not "42").
4. For currency fields: normalized_value = { "value": <number>, "currency": "<3-letter code>" }.
5. For boolean/select fields: normalized_value = the exact matched option string or true/false.
6. For multi_select fields: normalized_value = array of matched option strings.
7. Confidence calibration:
   - 0.95–1.0: Exact label match, unambiguous, single occurrence
   - 0.70–0.94: Similar label or paraphrased, value clearly parseable
   - 0.40–0.69: Inferred from context, multiple possible matches
   - 0.01–0.39: Very uncertain
   - 0.00: Not present in document at all
8. For PRICE FIELDs: prefer confidence 0.00 + null value over a guess.
9. raw_text must be the verbatim text snippet from the document (not "not_found").`;

interface ExtractionInput {
  submissionId: string;
  tenantId: string;
  eventId: string;
}

export async function runExtractionPipeline(input: ExtractionInput): Promise<{ warnings?: string[] }> {
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

    // Extract from each attachment (errors are soft — one bad file won't kill other sources)
    const attachmentErrors: string[] = [];
    for (const attachment of attachments ?? []) {
      const { data: fileData } = await supabase.storage
        .from("offer-documents")
        .download(attachment.storage_path);

      if (!fileData) continue;

      const buffer = Buffer.from(await fileData.arrayBuffer());

      try {
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
      } catch (attachErr) {
        const msg = attachErr instanceof Error ? attachErr.message : String(attachErr);
        attachmentErrors.push(`${attachment.original_filename}: ${msg}`);
      }
    }

    // If every source failed (no text body, all attachments errored), surface a clear message
    if (allResults.length === 0 && !submission.email_body_text && attachmentErrors.length > 0) {
      throw new Error(attachmentErrors.join(" | "));
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

    if (rows.length > 0) {
      await supabase.from("extracted_values").insert(rows);
    }

    // Mark completed — store any attachment warnings in extraction_error as info
    await supabase
      .from("offer_submissions")
      .update({
        extraction_status: "completed",
        status: "extracted",
        ...(attachmentErrors.length > 0
          ? { extraction_error: "WARN: " + attachmentErrors.join(" | ") }
          : { extraction_error: null }),
      })
      .eq("id", input.submissionId);

    // Rebuild comparison grid cache
    await rebuildGridCache(input.eventId, input.tenantId);

    return attachmentErrors.length > 0 ? { warnings: attachmentErrors } : {};
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from("offer_submissions")
      .update({ extraction_status: "failed", extraction_error: message })
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

  // NOTE: response_format is intentionally omitted — Qwen3-32B via Bedrock Mantle does not
  // support the json_object response_format parameter. The system prompt already enforces JSON.
  // extra_body disables Qwen3 chain-of-thought thinking, which otherwise wastes ~20-40s silently.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extractParams: any = {
    model: EXTRACTION_MODEL,
    max_tokens: 4000,
    messages: [
      { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
      {
        role: "user",
        content: `SCHEMA FIELDS TO EXTRACT:\n${schemaDescription}\n\nDOCUMENT TEXT:\n${text.substring(0, 60000)}`,
      },
    ],
    extra_body: { enable_thinking: false },
  };

  const response = await (client.chat.completions.create(extractParams) as unknown as Promise<{ choices: Array<{ message?: { content?: string | null } }> }>);

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
  let pdfText = "";
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import("pdf-parse") as any;
    const pdfParse = mod.default ?? mod;
    const parsed = await pdfParse(buffer);
    pdfText = parsed.text?.trim() ?? "";
  } catch (parseErr) {
    throw new Error(
      `Could not parse PDF: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}. ` +
      "Please paste the offer text manually into the text area."
    );
  }

  if (pdfText.length === 0) {
    throw new Error(
      "This PDF contains no selectable text (it may be a scanned image). " +
      "Please copy the vendor's response text and paste it into the text area manually."
    );
  }

  return extractFromText(pdfText, schema, "llm_text", attachmentId);
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
  _buffer: Buffer,
  _schema: RFxSchemaField[],
  _attachmentId: string,
  mimeType: string
): Promise<ExtractionResult[]> {
  // qwen.qwen3-32b does not support vision/image input.
  // If a vision-capable model becomes available, set OPENAI_VISION_MODEL in .env.local.
  // For now, image files cannot be auto-extracted — instruct the user to paste text.
  const ext = mimeType.split("/")[1] ?? mimeType;
  throw new Error(
    `Image extraction is not supported by the current model (${VISION_MODEL}). ` +
    `The uploaded ${ext.toUpperCase()} file cannot be read automatically. ` +
    "Please paste the offer text manually into the text area instead."
  );
}

function parseExtractionResponse(
  jsonStr: string,
  schema: RFxSchemaField[],
  method: ExtractionResult["extraction_method"]
): ExtractionResult[] {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return [];
  }

  // Normalise two LLM output formats into one list of items:
  //
  // Format A — { "fields": [ { field_key, raw_text, normalized_value, ... }, ... ] }
  //   (what the prompt asks for)
  //
  // Format B — { "field_key": { raw_text, normalized_value, ... }, ... }
  //   (flat object; qwen3-32b often uses this despite the prompt)
  //
  // Format C — { "field_key": { value, confidence, ... } }
  //   (another common variant)

  let items: Array<Record<string, unknown>>;

  if (Array.isArray(parsed.fields)) {
    // Format A
    items = parsed.fields as Array<Record<string, unknown>>;
  } else {
    // Format B / C — every top-level key IS a field_key
    items = Object.entries(parsed)
      .filter(([, val]) => val !== null && typeof val === "object")
      .map(([key, val]) => {
        const v = val as Record<string, unknown>;
        return {
          field_key: key,
          // support both raw_text and text aliases
          raw_text: v.raw_text ?? v.text ?? v.raw ?? null,
          // support both normalized_value and value aliases
          normalized_value: v.normalized_value ?? v.value ?? v.normalized ?? null,
          confidence_score: v.confidence_score ?? v.confidence ?? 0,
          source_location: v.source_location ?? v.source_ref ?? v.location ?? null,
        };
      });
  }

  const schemaKeys = new Set(schema.map((s) => s.field_key));

  return items
    .filter((item) => {
      const key = String(item.field_key ?? "");
      return key.length > 0 && schemaKeys.has(key);   // only keep fields in our schema
    })
    .map((item) => {
      const score = typeof item.confidence_score === "number" ? item.confidence_score : 0;
      const rawText = item.raw_text ? String(item.raw_text) : null;
      // Treat the string literal "not_found" (some models write it) as null
      const cleanRaw = rawText === "not_found" ? null : rawText;
      const normVal  = item.normalized_value === "not_found" ? null : (item.normalized_value ?? null);
      const schemaField = schema.find((s) => s.field_key === String(item.field_key));
      return {
        field_key: String(item.field_key),
        raw_text: cleanRaw,
        normalized_value: normVal,
        confidence_score: score,
        confidence_label: scoreToLabel(score),
        source_ref: (item.source_location ?? null) as SourceRef | null,
        extraction_method: method,
        is_flagged: schemaField?.is_price_field === true && score < 0.5,
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
