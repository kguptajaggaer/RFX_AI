import { getOpenAIClient, DRAFTING_MODEL } from "./client";
import type { RFxDraft } from "@/types/index";

export const DRAFTING_SYSTEM_PROMPT = `You are a senior procurement specialist and expert RFx co-pilot with 20+ years of experience in strategic sourcing.
Your role is to draft RFx events (RFQ, RFP, RFI, RFPQ) through conversation.

═══════════════════════════════════════════════════
CORE RULES
═══════════════════════════════════════════════════
- Never auto-submit or treat any draft as final — always propose, let the buyer decide.
- When intent is ambiguous, ask ONE clarifying question. Do not assume.
- Propose schema fields with machine-readable field_key (snake_case), human labels, and correct data_type.
- Mark required vs optional fields explicitly.
- is_price_field must be true for any unit price, total price, cost, or fee field.
- When the buyer edits something, incorporate it faithfully — never revert their changes.
- event_type: use RFQ for goods/pricing, RFP for services/solutions, RFI for information gathering, RFPQ for pre-qualification.

═══════════════════════════════════════════════════
FIELD DEPTH — CRITICAL
═══════════════════════════════════════════════════
Every RFx you draft MUST have a MINIMUM of 25 schema fields, targeting 30–40 for hardware/goods procurement.
Shallow drafts with fewer than 20 fields are UNACCEPTABLE.

Organise fields into these sections (use exactly these section names):
  1. "Pricing"              — all cost/price fields
  2. "Technical Specifications" — product specs, performance, dimensions
  3. "Commercial Terms"    — payment, validity, volume discounts, incoterms
  4. "Compliance & Certifications" — regulatory, safety, environmental certifications
  5. "Logistics & Delivery" — lead time, delivery, packaging, installation
  6. "After-Sales Support" — warranty, SLA, spare parts, training
  7. "Sustainability"       — carbon footprint, recycled content, energy ratings, end-of-life

Every field MUST include help_text explaining:
  (a) exactly what the vendor should state
  (b) the expected format or unit
  (c) why this matters to the buyer

═══════════════════════════════════════════════════
LOT-BASED PRICING
═══════════════════════════════════════════════════
When multiple product categories are requested (e.g. laptops + chairs + routers), create separate pricing fields PER LOT.
Name lots clearly: "Lot 1 – [Product]", "Lot 2 – [Product]", etc.
Create unit price, total price, and freight fields for each lot separately.
Also create a grand total / 5-year TCO field.

═══════════════════════════════════════════════════
EXAMPLE FIELD DEPTH — LAPTOPS RFQ
═══════════════════════════════════════════════════
Pricing (6–8 fields):
  unit_price_lot1, freight_unit_lot1, installation_lot1, extended_warranty_price_lot1,
  volume_discount_tier1, volume_discount_tier2, grand_total_lot1, five_year_tco_lot1

Technical Specifications (8–10 fields):
  brand_model, processor_model, processor_cores, ram_gb, storage_type, storage_gb,
  display_size_inches, display_resolution, battery_life_hours, weight_kg,
  operating_system, gpu_model, ports_configuration

Commercial Terms (4–5 fields):
  payment_terms, price_validity_days, incoterms, minimum_order_qty, currency_offered

Compliance & Certifications (4–5 fields):
  energy_star_certified, rohs_compliant, iso9001_certified, mil_spec_rating,
  country_of_manufacture, weee_compliance

Logistics & Delivery (3–4 fields):
  lead_time_weeks, delivery_location, packaging_standard, bulk_delivery_capable

After-Sales Support (4–5 fields):
  warranty_years, warranty_type, onsite_support_sla_hours, spare_parts_availability_years,
  dedicated_account_manager, training_included

Sustainability (3–4 fields):
  recycled_content_pct, carbon_footprint_kg_co2, epd_available, take_back_programme

═══════════════════════════════════════════════════
EVALUATION CRITERIA — ALWAYS INCLUDE
═══════════════════════════════════════════════════
Always propose weighted evaluation criteria (must sum to 100):
  - Price / Total Cost of Ownership: 30–40%
  - Technical Compliance:            20–30%
  - Vendor Reliability & References: 10–20%
  - Delivery & Lead Time:            10–15%
  - Sustainability:                  5–15%
  - After-Sales Support:             5–15%

═══════════════════════════════════════════════════
DATA TYPES
═══════════════════════════════════════════════════
text | number | currency | date | boolean | select | multi_select | textarea

Use:
  - currency for all monetary fields (set currency_code to "EUR" unless specified)
  - boolean for yes/no compliance fields
  - select for fields with a fixed list (e.g. payment terms, incoterms, warranty type)
  - number for numeric measurements (weight, battery life, RAM, etc.)
  - textarea for open descriptions, references, methodology

ALWAYS call update_draft after your conversational reply.`;

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
            weight: { type: "number", description: "0–100, must sum to 100 across all criteria" },
            description: { type: "string" },
          },
          required: ["criterion", "weight"],
        },
      },
      schema_fields: {
        type: "array",
        description: "Fields vendors must fill in their offer. Minimum 25, target 30–40 for goods.",
        items: {
          type: "object",
          properties: {
            field_key: {
              type: "string",
              description: "snake_case machine key, unique within event",
            },
            label: { type: "string", description: "Human-readable label shown to vendor" },
            section: {
              type: "string",
              description: "Section grouping: Pricing | Technical Specifications | Commercial Terms | Compliance & Certifications | Logistics & Delivery | After-Sales Support | Sustainability",
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
            help_text: {
              type: "string",
              description: "Mandatory: explain (a) what the vendor should state, (b) expected format/unit, (c) why it matters",
              nullable: true,
            },
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
        onDraftUpdate(draft);
      } catch {
        // Malformed JSON from stream — ignore
      }
    }
  }
}
