import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getOpenAIClient, DRAFTING_MODEL } from "@/lib/openai/client";

interface VendorSummary {
  vendorId: string;
  companyName: string;
  submissionId: string;
  fields: Record<string, { value: unknown; confidence: string; raw: string | null }>;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;

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

  // Load event + schema
  const { data: event } = await serviceClient
    .from("rfx_events")
    .select("id, title, event_type, description, evaluation_criteria")
    .eq("id", eventId)
    .single();
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const { data: fields } = await serviceClient
    .from("rfx_schema_fields")
    .select("field_key, label, data_type, is_price_field, required, section")
    .eq("event_id", eventId)
    .order("display_order");

  // Load all submissions with extracted + confirmed values
  type SubRow = { id: string; vendor_id: string; vendors: { company_name: string } | null };
  const { data: rawSubs } = await serviceClient
    .from("offer_submissions")
    .select("id, vendor_id, vendors(company_name)")
    .eq("event_id", eventId)
    .neq("status", "disqualified") as { data: SubRow[] | null; error: unknown };

  if (!rawSubs || rawSubs.length === 0) {
    return NextResponse.json({ error: "No submissions to analyze" }, { status: 422 });
  }

  const [{ data: extracted }, { data: confirmed }] = await Promise.all([
    serviceClient
      .from("extracted_values")
      .select("submission_id, field_key, normalized_value, raw_text, confidence_label")
      .eq("event_id", eventId),
    serviceClient
      .from("confirmed_values")
      .select("submission_id, field_key, confirmed_value")
      .eq("event_id", eventId),
  ]);

  // Build vendor summaries
  const confirmedMap: Record<string, Record<string, unknown>> = {};
  for (const c of confirmed ?? []) {
    if (!confirmedMap[c.submission_id]) confirmedMap[c.submission_id] = {};
    confirmedMap[c.submission_id][c.field_key] = c.confirmed_value;
  }
  const extractedMap: Record<string, Record<string, { value: unknown; confidence: string; raw: string | null }>> = {};
  for (const e of extracted ?? []) {
    if (!extractedMap[e.submission_id]) extractedMap[e.submission_id] = {};
    extractedMap[e.submission_id][e.field_key] = {
      value: e.normalized_value,
      confidence: e.confidence_label,
      raw: e.raw_text,
    };
  }

  const vendors: VendorSummary[] = rawSubs.map((sub) => {
    const fieldValues: VendorSummary["fields"] = {};
    for (const f of fields ?? []) {
      const confVal = confirmedMap[sub.id]?.[f.field_key];
      const extVal = extractedMap[sub.id]?.[f.field_key];
      if (confVal !== undefined) {
        fieldValues[f.field_key] = { value: confVal, confidence: "confirmed", raw: null };
      } else if (extVal) {
        fieldValues[f.field_key] = extVal;
      } else {
        fieldValues[f.field_key] = { value: null, confidence: "not_found", raw: null };
      }
    }
    return {
      vendorId: sub.vendor_id,
      companyName: sub.vendors?.company_name ?? "Unknown",
      submissionId: sub.id,
      fields: fieldValues,
    };
  });

  if (vendors.every((v) => Object.values(v.fields).every((f) => f.value === null))) {
    return NextResponse.json({ error: "No extracted data available yet. Run extraction on submissions first." }, { status: 422 });
  }

  // Build the AI prompt
  const schemaDesc = (fields ?? [])
    .map((f) => `  - ${f.label} (${f.field_key}): ${f.data_type}${f.is_price_field ? " [PRICE — lower is better]" : ""}${f.required ? " *required" : ""}`)
    .join("\n");

  const vendorDesc = vendors
    .map((v) => {
      const vals = (fields ?? [])
        .map((f) => {
          const fv = v.fields[f.field_key];
          if (!fv || fv.value === null) return `    ${f.label}: NOT PROVIDED`;
          const valStr = typeof fv.value === "object"
            ? JSON.stringify(fv.value)
            : String(fv.value);
          return `    ${f.label}: ${valStr} (confidence: ${fv.confidence})`;
        })
        .join("\n");
      return `VENDOR: ${v.companyName}\n${vals}`;
    })
    .join("\n\n");

  const evalCriteria = Array.isArray(event.evaluation_criteria)
    ? (event.evaluation_criteria as Array<{ criterion: string; weight: number }>)
        .map((c) => `  - ${c.criterion}: ${c.weight}%`)
        .join("\n")
    : "  - Price: 40%, Quality: 30%, Delivery: 20%, Support: 10%";

  const systemPrompt = `You are an expert procurement analyst. Your job is to evaluate vendor responses to an RFx and produce a ranked shortlist.

You must:
1. Score each vendor objectively based on the schema fields and evaluation criteria
2. Pick the TOP 3 vendors (or fewer if less than 3 submitted)
3. For each, write a clear rationale covering strengths, weaknesses, and key risks
4. Give an overall recommendation

Output ONLY valid JSON in this exact shape:
{
  "summary": "One paragraph executive summary of the competitive landscape",
  "top3": [
    {
      "rank": 1,
      "companyName": "...",
      "submissionId": "...",
      "score": 87,
      "badge": "Best Value",
      "rationale": "...",
      "strengths": ["...", "..."],
      "risks": ["...", "..."],
      "keyMetrics": { "price": "...", "delivery": "...", "other": "..." }
    }
  ],
  "recommendation": "Final recommendation paragraph naming the preferred vendor and why."
}`;

  const userMsg = `EVENT: ${event.title} (${event.event_type})
${event.description ? `DESCRIPTION: ${event.description}` : ""}

EVALUATION CRITERIA:
${evalCriteria}

SCHEMA FIELDS:
${schemaDesc}

VENDOR RESPONSES:
${vendorDesc}

Analyze and produce the TOP 3 ranking JSON.`;

  const client = getOpenAIClient();
  const response = await client.chat.completions.create({
    model: DRAFTING_MODEL,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMsg },
    ],
  });

  let analysis: unknown;
  try {
    analysis = JSON.parse(response.choices[0]?.message?.content ?? "{}");
  } catch {
    return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 500 });
  }

  return NextResponse.json({ data: analysis });
}
