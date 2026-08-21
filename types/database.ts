// Supabase database types — run `npx supabase gen types typescript` to regenerate from a live project

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: { id: string; name: string; slug: string; industry: string | null; inbound_email_domain: string; settings: Json; created_at: string };
        Insert: { id?: string; name: string; slug: string; industry?: string | null; inbound_email_domain?: string; settings?: Json; created_at?: string };
        Update: { id?: string; name?: string; slug?: string; industry?: string | null; inbound_email_domain?: string; settings?: Json };
        Relationships: [];
      };
      profiles: {
        Row: { id: string; tenant_id: string; full_name: string | null; email: string; role: "admin" | "buyer" | "approver" | "viewer"; created_at: string };
        Insert: { id: string; tenant_id: string; full_name?: string | null; email: string; role?: "admin" | "buyer" | "approver" | "viewer"; created_at?: string };
        Update: { id?: string; tenant_id?: string; full_name?: string | null; email?: string; role?: "admin" | "buyer" | "approver" | "viewer" };
        Relationships: [];
      };
      rfx_events: {
        Row: {
          id: string; tenant_id: string; title: string;
          event_type: "RFQ" | "RFP" | "RFI" | "RFPQ";
          status: "draft" | "in_review" | "approved" | "published" | "closed" | "awarded" | "cancelled";
          description: string | null; background: string | null; evaluation_criteria: Json | null;
          submission_deadline: string | null; questions_deadline: string | null; award_date: string | null;
          late_response_rule: "reject" | "hold" | "accept";
          completeness_score: number | null; completeness_issues: Json | null; ai_session_id: string | null;
          created_by: string; approved_by: string | null; approved_at: string | null;
          published_at: string | null; closed_at: string | null; awarded_at: string | null;
          created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; tenant_id: string; title: string;
          event_type: "RFQ" | "RFP" | "RFI" | "RFPQ";
          status?: "draft" | "in_review" | "approved" | "published" | "closed" | "awarded" | "cancelled";
          description?: string | null; background?: string | null; evaluation_criteria?: Json | null;
          submission_deadline?: string | null; questions_deadline?: string | null; award_date?: string | null;
          late_response_rule?: "reject" | "hold" | "accept";
          completeness_score?: number | null; completeness_issues?: Json | null; ai_session_id?: string | null;
          created_by: string; approved_by?: string | null; approved_at?: string | null;
          published_at?: string | null; closed_at?: string | null; awarded_at?: string | null;
          created_at?: string; updated_at?: string;
        };
        Update: {
          id?: string; title?: string;
          event_type?: "RFQ" | "RFP" | "RFI" | "RFPQ";
          status?: "draft" | "in_review" | "approved" | "published" | "closed" | "awarded" | "cancelled";
          description?: string | null; background?: string | null; evaluation_criteria?: Json | null;
          submission_deadline?: string | null; questions_deadline?: string | null; award_date?: string | null;
          late_response_rule?: "reject" | "hold" | "accept";
          completeness_score?: number | null; completeness_issues?: Json | null; ai_session_id?: string | null;
          approved_by?: string | null; approved_at?: string | null;
          published_at?: string | null; closed_at?: string | null; awarded_at?: string | null;
        };
        Relationships: [];
      };
      rfx_schema_fields: {
        Row: {
          id: string; event_id: string; tenant_id: string; field_key: string; label: string; section: string | null;
          data_type: "text" | "number" | "currency" | "date" | "boolean" | "select" | "multi_select" | "textarea";
          currency_code: string | null; options: Json | null; required: boolean; is_price_field: boolean;
          validation_rules: Json | null; help_text: string | null; display_order: number; created_at: string;
        };
        Insert: {
          id?: string; event_id: string; tenant_id: string; field_key: string; label: string; section?: string | null;
          data_type: "text" | "number" | "currency" | "date" | "boolean" | "select" | "multi_select" | "textarea";
          currency_code?: string | null; options?: Json | null; required?: boolean; is_price_field?: boolean;
          validation_rules?: Json | null; help_text?: string | null; display_order?: number; created_at?: string;
        };
        Update: {
          label?: string; section?: string | null;
          data_type?: "text" | "number" | "currency" | "date" | "boolean" | "select" | "multi_select" | "textarea";
          currency_code?: string | null; options?: Json | null; required?: boolean; is_price_field?: boolean;
          validation_rules?: Json | null; help_text?: string | null; display_order?: number;
        };
        Relationships: [];
      };
      vendors: {
        Row: { id: string; tenant_id: string; company_name: string; primary_email: string; contact_name: string | null; phone: string | null; country: string | null; metadata: Json; created_at: string };
        Insert: { id?: string; tenant_id: string; company_name: string; primary_email: string; contact_name?: string | null; phone?: string | null; country?: string | null; metadata?: Json; created_at?: string };
        Update: { id?: string; tenant_id?: string; company_name?: string; primary_email?: string; contact_name?: string | null; phone?: string | null; country?: string | null; metadata?: Json };
        Relationships: [];
      };
      vendor_invitations: {
        Row: {
          id: string; event_id: string; tenant_id: string; vendor_id: string; invite_token: string; reply_email: string; portal_url: string;
          status: "pending" | "sent" | "delivered" | "viewed" | "submitted" | "declined" | "bounced";
          sendgrid_message_id: string | null; personal_message: string | null;
          sent_at: string | null; viewed_at: string | null; submitted_at: string | null; declined_at: string | null; bounce_reason: string | null; created_at: string;
        };
        Insert: {
          id?: string; event_id: string; tenant_id: string; vendor_id: string; invite_token: string; reply_email: string; portal_url: string;
          status?: "pending" | "sent" | "delivered" | "viewed" | "submitted" | "declined" | "bounced";
          sendgrid_message_id?: string | null; personal_message?: string | null;
          sent_at?: string | null; viewed_at?: string | null; submitted_at?: string | null; declined_at?: string | null; bounce_reason?: string | null; created_at?: string;
        };
        Update: {
          status?: "pending" | "sent" | "delivered" | "viewed" | "submitted" | "declined" | "bounced";
          sendgrid_message_id?: string | null; sent_at?: string | null; viewed_at?: string | null; submitted_at?: string | null; declined_at?: string | null; bounce_reason?: string | null;
        };
        Relationships: [];
      };
      offer_submissions: {
        Row: {
          id: string; event_id: string; tenant_id: string; vendor_id: string; invitation_id: string;
          submission_channel: "portal" | "email" | "manual";
          sender_email: string | null; sender_verified: boolean;
          status: "quarantined" | "received" | "extracting" | "extracted" | "under_review" | "confirmed" | "disqualified" | "late";
          extraction_status: "pending" | "queued" | "in_progress" | "completed" | "failed" | "manual_required";
          extraction_job_id: string | null; extraction_error: string | null;
          email_subject: string | null; email_body_text: string | null; email_body_html: string | null;
          is_late: boolean; submitted_at: string; created_at: string;
        };
        Insert: {
          id?: string; event_id: string; tenant_id: string; vendor_id: string; invitation_id: string;
          submission_channel: "portal" | "email" | "manual";
          sender_email?: string | null; sender_verified?: boolean;
          status?: "quarantined" | "received" | "extracting" | "extracted" | "under_review" | "confirmed" | "disqualified" | "late";
          extraction_status?: "pending" | "queued" | "in_progress" | "completed" | "failed" | "manual_required";
          extraction_job_id?: string | null; extraction_error?: string | null;
          email_subject?: string | null; email_body_text?: string | null; email_body_html?: string | null;
          is_late?: boolean; submitted_at?: string; created_at?: string;
        };
        Update: {
          status?: "quarantined" | "received" | "extracting" | "extracted" | "under_review" | "confirmed" | "disqualified" | "late";
          extraction_status?: "pending" | "queued" | "in_progress" | "completed" | "failed" | "manual_required";
          extraction_job_id?: string | null; extraction_error?: string | null; is_late?: boolean;
        };
        Relationships: [];
      };
      offer_attachments: {
        Row: { id: string; submission_id: string; tenant_id: string; original_filename: string; mime_type: string; storage_path: string; file_size_bytes: number | null; page_count: number | null; is_primary: boolean; created_at: string };
        Insert: { id?: string; submission_id: string; tenant_id: string; original_filename: string; mime_type: string; storage_path: string; file_size_bytes?: number | null; page_count?: number | null; is_primary?: boolean; created_at?: string };
        Update: { id?: string; page_count?: number | null; is_primary?: boolean };
        Relationships: [];
      };
      extracted_values: {
        Row: {
          id: string; submission_id: string; tenant_id: string; event_id: string; attachment_id: string | null; field_key: string;
          raw_text: string | null; normalized_value: Json | null; confidence_score: number | null;
          confidence_label: "high" | "medium" | "low" | "not_found" | "ambiguous" | "conflicted";
          source_ref: Json | null;
          extraction_method: "llm_text" | "llm_vision" | "spreadsheet_parse" | "email_parse";
          model_version: string | null; is_flagged: boolean; flag_reason: string | null; has_conflict: boolean; conflict_detail: Json | null; created_at: string;
        };
        Insert: {
          id?: string; submission_id: string; tenant_id: string; event_id: string; attachment_id?: string | null; field_key: string;
          raw_text?: string | null; normalized_value?: Json | null; confidence_score?: number | null;
          confidence_label: "high" | "medium" | "low" | "not_found" | "ambiguous" | "conflicted";
          source_ref?: Json | null;
          extraction_method: "llm_text" | "llm_vision" | "spreadsheet_parse" | "email_parse";
          model_version?: string | null; is_flagged?: boolean; flag_reason?: string | null; has_conflict?: boolean; conflict_detail?: Json | null; created_at?: string;
        };
        Update: { is_flagged?: boolean; flag_reason?: string | null; has_conflict?: boolean; conflict_detail?: Json | null };
        Relationships: [];
      };
      confirmed_values: {
        Row: {
          id: string; extracted_value_id: string | null; submission_id: string; tenant_id: string; event_id: string; field_key: string;
          confirmed_value: Json; is_corrected: boolean; original_extracted_val: Json | null; correction_note: string | null;
          confirmed_by: string; confirmed_at: string; created_at: string;
        };
        Insert: {
          id?: string; extracted_value_id?: string | null; submission_id: string; tenant_id: string; event_id: string; field_key: string;
          confirmed_value: Json; is_corrected?: boolean; original_extracted_val?: Json | null; correction_note?: string | null;
          confirmed_by: string; confirmed_at?: string; created_at?: string;
        };
        Update: { confirmed_value?: Json; is_corrected?: boolean; original_extracted_val?: Json | null; correction_note?: string | null; confirmed_by?: string; confirmed_at?: string };
        Relationships: [];
      };
      email_quarantine: {
        Row: {
          id: string; tenant_id: string | null; sendgrid_message_id: string | null; from_email: string; to_email: string | null; reply_token: string | null; matched_invitation_id: string | null;
          subject: string | null; body_preview: string | null; attachment_count: number; raw_payload_path: string | null;
          quarantine_reason: "sender_mismatch" | "token_not_found" | "token_expired" | "duplicate" | "event_closed" | "late_submission" | "spam_detected";
          status: "quarantined" | "released_as_submission" | "released_as_manual" | "rejected";
          reviewed_by: string | null; reviewed_at: string | null; release_submission_id: string | null; created_at: string;
        };
        Insert: {
          id?: string; tenant_id?: string | null; sendgrid_message_id?: string | null; from_email: string; to_email?: string | null; reply_token?: string | null; matched_invitation_id?: string | null;
          subject?: string | null; body_preview?: string | null; attachment_count?: number; raw_payload_path?: string | null;
          quarantine_reason: "sender_mismatch" | "token_not_found" | "token_expired" | "duplicate" | "event_closed" | "late_submission" | "spam_detected";
          status?: "quarantined" | "released_as_submission" | "released_as_manual" | "rejected";
          reviewed_by?: string | null; reviewed_at?: string | null; release_submission_id?: string | null; created_at?: string;
        };
        Update: { status?: "quarantined" | "released_as_submission" | "released_as_manual" | "rejected"; reviewed_by?: string | null; reviewed_at?: string | null; release_submission_id?: string | null };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string; tenant_id: string; event_id: string | null; submission_id: string | null; actor_id: string | null;
          actor_type: "buyer" | "approver" | "system" | "vendor";
          actor_label: string | null; action: string; entity_type: string | null; entity_id: string | null;
          old_value: Json | null; new_value: Json | null; metadata: Json | null; created_at: string;
        };
        Insert: {
          id?: string; tenant_id: string; event_id?: string | null; submission_id?: string | null; actor_id?: string | null;
          actor_type: "buyer" | "approver" | "system" | "vendor";
          actor_label?: string | null; action: string; entity_type?: string | null; entity_id?: string | null;
          old_value?: Json | null; new_value?: Json | null; metadata?: Json | null; created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      comparison_grid_cache: {
        Row: { event_id: string; tenant_id: string; grid_data: Json; has_unconfirmed_low_conf: boolean; award_blocked_field_keys: string[]; last_rebuilt_at: string };
        Insert: { event_id: string; tenant_id: string; grid_data?: Json; has_unconfirmed_low_conf?: boolean; award_blocked_field_keys?: string[]; last_rebuilt_at?: string };
        Update: { event_id?: string; tenant_id?: string; grid_data?: Json; has_unconfirmed_low_conf?: boolean; award_blocked_field_keys?: string[]; last_rebuilt_at?: string };
        Relationships: [];
      };
      ai_drafting_sessions: {
        Row: {
          id: string; event_id: string | null; tenant_id: string; created_by: string;
          messages: Json; current_draft: Json | null;
          status: "active" | "completed" | "abandoned";
          model_version: string | null; token_count: number | null; created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; event_id?: string | null; tenant_id: string; created_by: string;
          messages?: Json; current_draft?: Json | null;
          status?: "active" | "completed" | "abandoned";
          model_version?: string | null; token_count?: number | null; created_at?: string; updated_at?: string;
        };
        Update: { event_id?: string | null; messages?: Json; current_draft?: Json | null; status?: "active" | "completed" | "abandoned"; model_version?: string | null; token_count?: number | null; updated_at?: string };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
