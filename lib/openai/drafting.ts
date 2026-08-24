import { getOpenAIClient, DRAFTING_MODEL } from "./client";
import type { RFxDraft } from "@/types/index";

export const DRAFTING_SYSTEM_PROMPT = `/no_think
You are a senior procurement specialist and AI co-pilot helping buyers create and refine RFx events.

PERSONALITY:
- Be conversational and specific. Always reference what you actually changed or added.
- Acknowledge the user's request directly ("I've added a 5-year warranty field" not "The draft has been updated").
- When refining, say exactly which fields were modified/added/removed.
- Ask a follow-up question only when you genuinely need clarification, not by default.

RESPONSE FORMAT:
- Text reply: 2–4 sentences. Confirm what changed and what's in the draft.
- ALL field details go into the update_draft function call, not the text.
- Always call update_draft on every turn.

WHEN REFINING AN EXISTING DRAFT (current draft state injected below if present):
- Preserve ALL existing fields. Only modify what the user explicitly requested.
- Do NOT restart from scratch — start from the current draft and apply the amendment.
- Be specific: "I've updated payment_terms to Net 60, added a 3-year support field, and kept everything else the same."

WHEN CREATING A NEW DRAFT:
- Aim for ~20–25 fields for a focused single-lot RFQ; ~25–35 for multi-lot.
- Cover all 7 sections (use exact names as the section value):
  "Pricing" | "Technical Specifications" | "Commercial Terms" |
  "Compliance & Certifications" | "Logistics & Delivery" |
  "After-Sales Support" | "Sustainability"

FIELD RULES:
- is_price_field = true for every monetary field (price, cost, total, TCO, discount).
- Use data_type "currency" with currency_code for money fields.
- Use "boolean" for yes/no, "select" for fixed choices, "number" for measurements.
- Include help_text on each field (what to state, expected unit/format, why it matters).

MULTI-LOT: when multiple products are requested, create separate pricing fields per lot
(e.g. unit_price_lot1, freight_lot1, tco_lot1) plus a grand_total field.

EVALUATION CRITERIA: always propose 4–6 criteria with weights summing to 100.

COMPLETENESS: only flag truly missing info as "blocking" (e.g. no title, no event_type).
Never flag field count as blocking. Field count warnings are fine but not blocking.

event_type: RFQ = goods/pricing, RFP = services, RFI = information, RFPQ = pre-qualification.
DATA TYPES: text | number | currency | date | boolean | select | multi_select | textarea`;

export const UPDATE_DRAFT_FUNCTION = {
  name: "update_draft",
  description: "Update the current RFx draft with the complete latest state.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string" },
      event_type: { type: "string", enum: ["RFQ", "RFP", "RFI", "RFPQ"] },
      description: { type: "string" },
      background: { type: "string" },
      submission_deadline: { type: "string", nullable: true },
      questions_deadline: { type: "string", nullable: true },
      award_date: { type: "string", nullable: true },
      late_response_rule: { type: "string", enum: ["reject", "hold", "accept"] },
      evaluation_criteria: {
        type: "array",
        items: {
          type: "object",
          properties: {
            criterion: { type: "string" },
            weight: { type: "number" },
            description: { type: "string" },
          },
          required: ["criterion", "weight"],
        },
      },
      schema_fields: {
        type: "array",
        description: "Complete list of ALL fields in the draft. When refining, include existing fields with any modifications plus new fields added.",
        items: {
          type: "object",
          properties: {
            field_key: { type: "string", description: "snake_case, unique" },
            label: { type: "string" },
            section: { type: "string" },
            data_type: {
              type: "string",
              enum: ["text", "number", "currency", "date", "boolean", "select", "multi_select", "textarea"],
            },
            currency_code: { type: "string", nullable: true },
            required: { type: "boolean" },
            is_price_field: { type: "boolean" },
            help_text: { type: "string", nullable: true },
            options: {
              type: "array",
              nullable: true,
              items: {
                type: "object",
                properties: { value: { type: "string" }, label: { type: "string" } },
              },
            },
          },
          required: ["field_key", "label", "data_type", "required", "is_price_field"],
        },
      },
      completeness_issues: {
        type: "array",
        description: "Only truly blocking issues (missing title/event_type). Never flag field count as blocking.",
        items: {
          type: "object",
          properties: {
            field: { type: "string" },
            issue: { type: "string" },
            severity: { type: "string", enum: ["blocking", "warning"] },
          },
          required: ["field", "issue", "severity"],
        },
      },
    },
    required: ["title", "event_type", "schema_fields"],
  },
};

export async function* streamDraftingConversation(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  onDraftUpdate: (draft: Partial<RFxDraft>) => void,
  currentDraft?: Partial<RFxDraft> | null
): AsyncGenerator<string> {
  const client = getOpenAIClient();

  // Build system prompt — inject current draft if we're refining an existing one
  let systemContent = DRAFTING_SYSTEM_PROMPT;
  if (currentDraft && (currentDraft.title || (currentDraft.schema_fields?.length ?? 0) > 0)) {
    systemContent += `\n\n---\nCURRENT DRAFT STATE (amend this — do NOT start from scratch):\n${JSON.stringify(currentDraft, null, 2)}\n---\n\nThe user wants to refine the draft above. Preserve all existing fields and only make the changes they request. In your text reply, be specific about exactly what changed.`;
  }

  const stream = await client.chat.completions.create({
    model: DRAFTING_MODEL,
    messages: [
      { role: "system", content: systemContent },
      ...messages,
    ],
    tools: [{ type: "function", function: UPDATE_DRAFT_FUNCTION }],
    tool_choice: "auto",
    stream: true,
    max_tokens: 8000,
    // Disable Qwen3 chain-of-thought thinking — eliminates 20-40s thinking latency
    // @ts-expect-error extra_body passed through to Bedrock Mantle endpoint
    extra_body: { enable_thinking: false },
  });

  let functionCallBuffer = "";
  let functionCallName = "";

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta;
    if (!delta) continue;

    if (delta.content) {
      yield delta.content;
    }

    if (delta.tool_calls) {
      for (const toolCall of delta.tool_calls) {
        if (toolCall.function?.name) {
          functionCallName = toolCall.function.name;
        }
        if (toolCall.function?.arguments) {
          functionCallBuffer += toolCall.function.arguments;
        }
      }
    }

    if (
      chunk.choices[0]?.finish_reason === "tool_calls" &&
      functionCallName === "update_draft" &&
      functionCallBuffer
    ) {
      try {
        const draft = JSON.parse(functionCallBuffer) as Partial<RFxDraft>;
        // Strip any blocking completeness issues about field count — those are warnings only
        if (draft.completeness_issues) {
          draft.completeness_issues = draft.completeness_issues.map((issue) =>
            issue.field === "schema_fields" && issue.severity === "blocking"
              ? { ...issue, severity: "warning" }
              : issue
          );
        }
        onDraftUpdate(draft);
      } catch {
        // Malformed / truncated JSON — recover whatever fields we can
        const partial = recoverPartialDraft(functionCallBuffer);
        if (partial) onDraftUpdate(partial);
      }
    }
  }
}

/**
 * Best-effort recovery when the model's JSON tool call is truncated mid-stream.
 * Extracts the title, event_type, and any complete field objects.
 */
function recoverPartialDraft(raw: string): Partial<RFxDraft> | null {
  const titleMatch = raw.match(/"title"\s*:\s*"([^"]+)"/);
  const typeMatch  = raw.match(/"event_type"\s*:\s*"(RFQ|RFP|RFI|RFPQ)"/);

  // Pull out complete field objects from the schema_fields array
  const fields: RFxDraft["schema_fields"] = [];
  const fieldRegex = /\{\s*"field_key"\s*:[^}]+?"label"\s*:[^}]+?\}/gs;
  let m: RegExpExecArray | null;
  while ((m = fieldRegex.exec(raw)) !== null) {
    try {
      const candidate = m[0].endsWith("}") ? m[0] : m[0] + "}";
      const f = JSON.parse(candidate);
      if (f.field_key && f.label && f.data_type) {
        fields.push({
          field_key: f.field_key,
          label: f.label,
          section: f.section ?? "General",
          data_type: f.data_type,
          required: f.required ?? false,
          is_price_field: f.is_price_field ?? false,
          help_text: f.help_text ?? null,
        });
      }
    } catch { /* skip */ }
  }

  if (!titleMatch && fields.length === 0) return null;

  return {
    title: titleMatch?.[1] ?? "Draft RFx",
    event_type: (typeMatch?.[1] as RFxDraft["event_type"]) ?? "RFQ",
    schema_fields: fields,
  };
}
