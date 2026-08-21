import type { Database } from "./database";

// Table row shortcuts
export type Tenant = Database["public"]["Tables"]["tenants"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type RFxEvent = Database["public"]["Tables"]["rfx_events"]["Row"];
export type RFxSchemaField = Database["public"]["Tables"]["rfx_schema_fields"]["Row"];
export type Vendor = Database["public"]["Tables"]["vendors"]["Row"];
export type VendorInvitation = Database["public"]["Tables"]["vendor_invitations"]["Row"];
export type OfferSubmission = Database["public"]["Tables"]["offer_submissions"]["Row"];
export type OfferAttachment = Database["public"]["Tables"]["offer_attachments"]["Row"];
export type ExtractedValue = Database["public"]["Tables"]["extracted_values"]["Row"];
export type ConfirmedValue = Database["public"]["Tables"]["confirmed_values"]["Row"];
export type EmailQuarantine = Database["public"]["Tables"]["email_quarantine"]["Row"];
export type AuditLog = Database["public"]["Tables"]["audit_logs"]["Row"];
export type AIDraftingSession = Database["public"]["Tables"]["ai_drafting_sessions"]["Row"];

// RFx draft shape (used by the AI co-pilot)
export interface RFxDraft {
  title: string;
  event_type: "RFQ" | "RFP" | "RFI" | "RFPQ";
  description?: string;
  background?: string;
  submission_deadline?: string | null;
  questions_deadline?: string | null;
  award_date?: string | null;
  late_response_rule?: "reject" | "hold" | "accept";
  evaluation_criteria?: Array<{
    criterion: string;
    weight: number;
    description?: string;
  }>;
  schema_fields: Array<{
    field_key: string;
    label: string;
    section?: string;
    data_type:
      | "text"
      | "number"
      | "currency"
      | "date"
      | "boolean"
      | "select"
      | "multi_select"
      | "textarea";
    currency_code?: string;
    required: boolean;
    is_price_field: boolean;
    help_text?: string;
    options?: Array<{ value: string; label: string }>;
  }>;
  completeness_issues?: Array<{
    field: string;
    issue: string;
    severity: "blocking" | "warning";
  }>;
}

// Extraction result per field
export interface ExtractionResult {
  field_key: string;
  raw_text: string | null;
  normalized_value: unknown;
  confidence_score: number;
  confidence_label: "high" | "medium" | "low" | "not_found" | "ambiguous" | "conflicted";
  source_ref: SourceRef | null;
  extraction_method: "llm_text" | "llm_vision" | "spreadsheet_parse" | "email_parse";
  is_flagged: boolean;
  flag_reason?: string;
  has_conflict: boolean;
  conflict_detail?: {
    body_value: unknown;
    attachment_value: unknown;
    attachment_filename: string;
  };
}

export interface SourceRef {
  // Text/PDF
  page?: number;
  char_offset?: number;
  text_snippet?: string;
  // Vision/image
  bbox?: [number, number, number, number]; // [left, top, width, height] normalized 0-1
  // Spreadsheet
  sheet?: string;
  row?: number;
  col?: string;
  cell_ref?: string;
  // Email
  part?: "body" | "attachment";
}

// Comparison grid
export interface GridCell {
  field_key: string;
  vendor_id: string;
  confirmed_value: unknown | null;
  confidence_label: string | null;
  extracted_value_id: string | null;
  is_corrected: boolean;
  has_provenance: boolean;
}

export interface ComparisonGridData {
  fields: RFxSchemaField[];
  vendors: Array<{
    id: string;
    company_name: string;
    invitation_status: string;
    submission_id: string | null;
  }>;
  cells: Record<string, Record<string, GridCell>>; // field_key -> vendor_id -> cell
  award_blocked_field_keys: string[];
  has_unconfirmed_low_conf: boolean;
}

// API response shapes
export interface ApiSuccess<T> {
  data: T;
  error: null;
}

export interface ApiError {
  data: null;
  error: { code: string; message: string; details?: unknown };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
