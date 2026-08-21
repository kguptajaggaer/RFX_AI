import { getOpenAIClient, DRAFTING_MODEL } from "./client";
import type { RFxDraft } from "@/types/index";

export const DRAFTING_SYSTEM_PROMPT = `You are an expert procurement co-pilot for sourcing buyers.
Your role is to help draft RFx events (RFQ, RFP, RFI, RFPQ) through conversation.

RULES:
- Never auto-submit or treat any draft as final — always propose, let the buyer decide.
- When intent is ambiguous, ask ONE clarifying question. Do not assume.
- Propose schema fields with machine-readable field_key (snake_case), human labels, and correct data_type.
- Mark required vs optional fields explicitly.
- is_price_field must be true for any unit price, total price, or cost field.
- When the buyer edits something, incorporate it faithfully — never revert their changes.
- Reference industry context when proposing fields.
- event_type: use RFQ for goods/pricing, RFP for services/solutions, RFI for information gathering, RFPQ for pre-qualification.

DATA TYPES: text | number | currency | date | boolean | select | multi_select | textarea

ALWAYS call update_draft after your conversational reply, even if nothing in the draft changed.`;

export const UPDATE_DRAFT_FUNCTION = {
  name: "update_draft",
  description:
    "Update the current RFx draft with the latest state after each conversation turn.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "Event title" },
      event_type: {
        type: "string",
        enum: ["RFQ", "RFP", "RFI", "RFPQ"],
      },
      description: {
        type: "string",
        description: "Short description of what is being sourced",
      },
      background: {
        type: "string",
        description: "Background context for vendors",
      },
      submission_deadline: {
        type: "string",
        description: "ISO 8601 datetime or null",
        nullable: true,
      },
      questions_deadline: {
        type: "string",
        description: "ISO 8601 datetime for vendor questions, or null",
        nullable: true,
      },
      award_date: {
        type: "string",
        description: "Expected award date, ISO 8601 or null",
        nullable: true,
      },
      late_response_rule: {
        type: "string",
        enum: ["reject", "hold", "accept"],
        description: "How to handle late submissions",
      },
      evaluation_criteria: {
        type: "array",
        items: {
          type: "object",
          properties: {
            criterion: { type: "string" },
            weight: { type: "number", description: "0–100, should sum to 100" },
            description: { type: "string" },
          },
          required: ["criterion", "weight"],
        },
      },
      schema_fields: {
        type: "array",
        description: "Fields vendors must fill in their offer",
        items: {
          type: "object",
          properties: {
            field_key: {
              type: "string",
              description: "snake_case machine key, unique within event",
            },
            label: { type: "string", description: "Human-readable label" },
            section: {
              type: "string",
              description: "e.g. Pricing, Technical, Commercial",
            },
            data_type: {
              type: "string",
              enum: [
                "text",
                "number",
                "currency",
                "date",
                "boolean",
                "select",
                "multi_select",
                "textarea",
              ],
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
                properties: {
                  value: { type: "string" },
                  label: { type: "string" },
                },
              },
            },
          },
          required: ["field_key", "label", "data_type", "required", "is_price_field"],
        },
      },
      completeness_issues: {
        type: "array",
        description: "Fields or sections that are missing or incomplete",
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
  onDraftUpdate: (draft: Partial<RFxDraft>) => void
): AsyncGenerator<string> {
  const client = getOpenAIClient();

  const stream = await client.chat.completions.create({
    model: DRAFTING_MODEL,
    messages: [
      { role: "system", content: DRAFTING_SYSTEM_PROMPT },
      ...messages,
    ],
    tools: [{ type: "function", function: UPDATE_DRAFT_FUNCTION }],
    tool_choice: "auto",
    stream: true,
  });

  let functionCallBuffer = "";
  let functionCallName = "";
  let textBuffer = "";

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta;
    if (!delta) continue;

    if (delta.content) {
      textBuffer += delta.content;
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
        onDraftUpdate(draft);
      } catch {
        // Malformed JSON from stream — ignore
      }
    }
  }
}
