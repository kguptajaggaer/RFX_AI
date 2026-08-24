-- ============================================================
-- RFX AI — Combined idempotent migrations
-- Safe to run multiple times. Tables/indexes/policies that
-- already exist are skipped automatically.
-- ============================================================

-- ============================================================
-- 001: Tenants and Profiles
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS tenants (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  slug                  TEXT UNIQUE NOT NULL,
  industry              TEXT,
  inbound_email_domain  TEXT NOT NULL DEFAULT 'inbound.rfxai.com',
  settings              JSONB NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES tenants,
  full_name   TEXT,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'buyer'
              CHECK (role IN ('admin', 'buyer', 'approver', 'viewer')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE tenants  ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenants: own tenant only' AND tablename = 'tenants') THEN
    CREATE POLICY "Tenants: own tenant only" ON tenants
      FOR ALL USING (id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Profiles: own tenant only' AND tablename = 'profiles') THEN
    CREATE POLICY "Profiles: own tenant only" ON profiles
      FOR ALL USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);
  END IF;
END $$;

-- ============================================================
-- 002: RFx Events and Schema Fields
-- ============================================================
CREATE TABLE IF NOT EXISTS rfx_events (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants,
  title                 TEXT NOT NULL,
  event_type            TEXT NOT NULL CHECK (event_type IN ('RFQ', 'RFP', 'RFI', 'RFPQ')),
  status                TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','in_review','approved','published','closed','awarded','cancelled')),
  description           TEXT,
  background            TEXT,
  evaluation_criteria   JSONB,
  submission_deadline   TIMESTAMPTZ,
  questions_deadline    TIMESTAMPTZ,
  award_date            TIMESTAMPTZ,
  late_response_rule    TEXT NOT NULL DEFAULT 'hold' CHECK (late_response_rule IN ('reject','hold','accept')),
  completeness_score    SMALLINT,
  completeness_issues   JSONB,
  ai_session_id         UUID,
  created_by            UUID NOT NULL REFERENCES profiles,
  approved_by           UUID REFERENCES profiles,
  approved_at           TIMESTAMPTZ,
  published_at          TIMESTAMPTZ,
  closed_at             TIMESTAMPTZ,
  awarded_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rfx_schema_fields (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID NOT NULL REFERENCES rfx_events ON DELETE CASCADE,
  tenant_id         UUID NOT NULL,
  field_key         TEXT NOT NULL,
  label             TEXT NOT NULL,
  section           TEXT,
  data_type         TEXT NOT NULL CHECK (data_type IN ('text','number','currency','date','boolean','select','multi_select','textarea')),
  currency_code     TEXT,
  options           JSONB,
  required          BOOLEAN NOT NULL DEFAULT true,
  is_price_field    BOOLEAN NOT NULL DEFAULT false,
  validation_rules  JSONB,
  help_text         TEXT,
  display_order     INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, field_key)
);

CREATE TABLE IF NOT EXISTS ai_drafting_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID REFERENCES rfx_events,
  tenant_id       UUID NOT NULL REFERENCES tenants,
  created_by      UUID NOT NULL REFERENCES profiles,
  messages        JSONB NOT NULL DEFAULT '[]',
  current_draft   JSONB,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','abandoned')),
  model_version   TEXT,
  token_count     INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'rfx_events_updated_at') THEN
    CREATE TRIGGER rfx_events_updated_at BEFORE UPDATE ON rfx_events
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'ai_sessions_updated_at') THEN
    CREATE TRIGGER ai_sessions_updated_at BEFORE UPDATE ON ai_drafting_sessions
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

ALTER TABLE rfx_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfx_schema_fields   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_drafting_sessions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'RFx events: tenant isolation' AND tablename = 'rfx_events') THEN
    CREATE POLICY "RFx events: tenant isolation" ON rfx_events
      FOR ALL USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Schema fields: tenant isolation' AND tablename = 'rfx_schema_fields') THEN
    CREATE POLICY "Schema fields: tenant isolation" ON rfx_schema_fields
      FOR ALL USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'AI sessions: tenant isolation' AND tablename = 'ai_drafting_sessions') THEN
    CREATE POLICY "AI sessions: tenant isolation" ON ai_drafting_sessions
      FOR ALL USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_rfx_events_tenant_status ON rfx_events(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_schema_fields_event ON rfx_schema_fields(event_id, display_order);

-- ============================================================
-- 003: Vendors and Invitations
-- ============================================================
CREATE TABLE IF NOT EXISTS vendors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants,
  company_name    TEXT NOT NULL,
  primary_email   TEXT NOT NULL,
  contact_name    TEXT,
  phone           TEXT,
  country         TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, primary_email)
);

CREATE TABLE IF NOT EXISTS vendor_invitations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id              UUID NOT NULL REFERENCES rfx_events ON DELETE CASCADE,
  tenant_id             UUID NOT NULL,
  vendor_id             UUID NOT NULL REFERENCES vendors,
  invite_token          TEXT UNIQUE NOT NULL,
  reply_email           TEXT UNIQUE NOT NULL,
  portal_url            TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','sent','delivered','viewed','submitted','declined','bounced')),
  sendgrid_message_id   TEXT,
  personal_message      TEXT,
  sent_at               TIMESTAMPTZ,
  viewed_at             TIMESTAMPTZ,
  submitted_at          TIMESTAMPTZ,
  declined_at           TIMESTAMPTZ,
  bounce_reason         TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE vendors             ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_invitations  ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Vendors: tenant isolation' AND tablename = 'vendors') THEN
    CREATE POLICY "Vendors: tenant isolation" ON vendors
      FOR ALL USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Invitations: tenant isolation' AND tablename = 'vendor_invitations') THEN
    CREATE POLICY "Invitations: tenant isolation" ON vendor_invitations
      FOR ALL USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_invitations_token ON vendor_invitations(invite_token);
CREATE INDEX IF NOT EXISTS idx_invitations_reply_email ON vendor_invitations(reply_email);
CREATE INDEX IF NOT EXISTS idx_invitations_event ON vendor_invitations(event_id, status);

-- ============================================================
-- 004: Offer Submissions and Attachments
-- ============================================================
CREATE TABLE IF NOT EXISTS offer_submissions (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id                  UUID NOT NULL REFERENCES rfx_events,
  tenant_id                 UUID NOT NULL,
  vendor_id                 UUID NOT NULL REFERENCES vendors,
  invitation_id             UUID NOT NULL REFERENCES vendor_invitations,
  submission_channel        TEXT NOT NULL CHECK (submission_channel IN ('portal','email','manual')),
  sender_email              TEXT,
  sender_verified           BOOLEAN NOT NULL DEFAULT false,
  status                    TEXT NOT NULL DEFAULT 'received'
                            CHECK (status IN ('quarantined','received','extracting','extracted','under_review','confirmed','disqualified','late')),
  extraction_status         TEXT NOT NULL DEFAULT 'pending'
                            CHECK (extraction_status IN ('pending','queued','in_progress','completed','failed','manual_required')),
  extraction_job_id         TEXT,
  extraction_error          TEXT,
  email_subject             TEXT,
  email_body_text           TEXT,
  email_body_html           TEXT,
  is_late                   BOOLEAN NOT NULL DEFAULT false,
  submitted_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS offer_attachments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id     UUID NOT NULL REFERENCES offer_submissions ON DELETE CASCADE,
  tenant_id         UUID NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type         TEXT NOT NULL,
  storage_path      TEXT NOT NULL,
  file_size_bytes   BIGINT,
  page_count        INTEGER,
  is_primary        BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE offer_submissions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_attachments  ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Submissions: tenant isolation' AND tablename = 'offer_submissions') THEN
    CREATE POLICY "Submissions: tenant isolation" ON offer_submissions
      FOR ALL USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Attachments: tenant isolation' AND tablename = 'offer_attachments') THEN
    CREATE POLICY "Attachments: tenant isolation" ON offer_attachments
      FOR ALL USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_submissions_event ON offer_submissions(event_id, status);
CREATE INDEX IF NOT EXISTS idx_submissions_extraction ON offer_submissions(extraction_status) WHERE extraction_status IN ('queued','in_progress');
CREATE INDEX IF NOT EXISTS idx_attachments_submission ON offer_attachments(submission_id);

-- ============================================================
-- 005: Extracted and Confirmed Values
-- ============================================================
CREATE TABLE IF NOT EXISTS extracted_values (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id     UUID NOT NULL REFERENCES offer_submissions ON DELETE CASCADE,
  tenant_id         UUID NOT NULL,
  event_id          UUID NOT NULL REFERENCES rfx_events,
  attachment_id     UUID REFERENCES offer_attachments,
  field_key         TEXT NOT NULL,
  raw_text          TEXT,
  normalized_value  JSONB,
  confidence_score  NUMERIC(4,3) CHECK (confidence_score BETWEEN 0 AND 1),
  confidence_label  TEXT NOT NULL
                    CHECK (confidence_label IN ('high','medium','low','not_found','ambiguous','conflicted')),
  source_ref        JSONB,
  extraction_method TEXT NOT NULL
                    CHECK (extraction_method IN ('llm_text','llm_vision','spreadsheet_parse','email_parse')),
  model_version     TEXT,
  is_flagged        BOOLEAN NOT NULL DEFAULT false,
  flag_reason       TEXT,
  has_conflict      BOOLEAN NOT NULL DEFAULT false,
  conflict_detail   JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS confirmed_values (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  extracted_value_id      UUID REFERENCES extracted_values,
  submission_id           UUID NOT NULL REFERENCES offer_submissions,
  tenant_id               UUID NOT NULL,
  event_id                UUID NOT NULL,
  field_key               TEXT NOT NULL,
  confirmed_value         JSONB NOT NULL,
  is_corrected            BOOLEAN NOT NULL DEFAULT false,
  original_extracted_val  JSONB,
  correction_note         TEXT,
  confirmed_by            UUID NOT NULL REFERENCES profiles,
  confirmed_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(submission_id, field_key)
);

CREATE TABLE IF NOT EXISTS comparison_grid_cache (
  event_id                      UUID PRIMARY KEY REFERENCES rfx_events,
  tenant_id                     UUID NOT NULL,
  grid_data                     JSONB NOT NULL DEFAULT '{}',
  has_unconfirmed_low_conf      BOOLEAN NOT NULL DEFAULT false,
  award_blocked_field_keys      TEXT[] NOT NULL DEFAULT '{}',
  last_rebuilt_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE extracted_values      ENABLE ROW LEVEL SECURITY;
ALTER TABLE confirmed_values      ENABLE ROW LEVEL SECURITY;
ALTER TABLE comparison_grid_cache ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Extracted values: sealed-bid' AND tablename = 'extracted_values') THEN
    CREATE POLICY "Extracted values: sealed-bid" ON extracted_values
      FOR SELECT USING (
        tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID
        AND EXISTS (
          SELECT 1 FROM rfx_events e
          WHERE e.id = extracted_values.event_id
            AND (e.status IN ('closed','awarded') OR e.created_by = auth.uid())
        )
      );
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Extracted values: insert by service role' AND tablename = 'extracted_values') THEN
    CREATE POLICY "Extracted values: insert by service role" ON extracted_values
      FOR INSERT WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Confirmed values: tenant isolation' AND tablename = 'confirmed_values') THEN
    CREATE POLICY "Confirmed values: tenant isolation" ON confirmed_values
      FOR ALL USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Grid cache: tenant isolation' AND tablename = 'comparison_grid_cache') THEN
    CREATE POLICY "Grid cache: tenant isolation" ON comparison_grid_cache
      FOR ALL USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_extracted_submission ON extracted_values(submission_id, field_key);
CREATE INDEX IF NOT EXISTS idx_extracted_event ON extracted_values(event_id);
CREATE INDEX IF NOT EXISTS idx_confirmed_submission ON confirmed_values(submission_id, field_key);
CREATE INDEX IF NOT EXISTS idx_confirmed_event ON confirmed_values(event_id);

-- ============================================================
-- 006: Email Quarantine and Audit Logs
-- ============================================================
CREATE TABLE IF NOT EXISTS email_quarantine (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID,
  sendgrid_message_id     TEXT,
  from_email              TEXT NOT NULL,
  to_email                TEXT,
  reply_token             TEXT,
  matched_invitation_id   UUID REFERENCES vendor_invitations,
  subject                 TEXT,
  body_preview            TEXT,
  attachment_count        INTEGER NOT NULL DEFAULT 0,
  raw_payload_path        TEXT,
  quarantine_reason       TEXT NOT NULL
                          CHECK (quarantine_reason IN (
                            'sender_mismatch','token_not_found','token_expired',
                            'duplicate','event_closed','late_submission','spam_detected'
                          )),
  status                  TEXT NOT NULL DEFAULT 'quarantined'
                          CHECK (status IN ('quarantined','released_as_submission','released_as_manual','rejected')),
  reviewed_by             UUID REFERENCES profiles,
  reviewed_at             TIMESTAMPTZ,
  release_submission_id   UUID REFERENCES offer_submissions,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  event_id      UUID,
  submission_id UUID,
  actor_id      UUID,
  actor_type    TEXT NOT NULL CHECK (actor_type IN ('buyer','approver','system','vendor')),
  actor_label   TEXT,
  action        TEXT NOT NULL,
  entity_type   TEXT,
  entity_id     UUID,
  old_value     JSONB,
  new_value     JSONB,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'audit_logs_2026_q3') THEN
    CREATE TABLE audit_logs_2026_q3 PARTITION OF audit_logs
      FOR VALUES FROM ('2026-07-01') TO ('2026-10-01');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'audit_logs_2026_q4') THEN
    CREATE TABLE audit_logs_2026_q4 PARTITION OF audit_logs
      FOR VALUES FROM ('2026-10-01') TO ('2027-01-01');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'audit_logs_2027_q1') THEN
    CREATE TABLE audit_logs_2027_q1 PARTITION OF audit_logs
      FOR VALUES FROM ('2027-01-01') TO ('2027-04-01');
  END IF;
END $$;

ALTER TABLE email_quarantine ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs       ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Quarantine: tenant isolation' AND tablename = 'email_quarantine') THEN
    CREATE POLICY "Quarantine: tenant isolation" ON email_quarantine
      FOR ALL USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Audit logs: tenant isolation' AND tablename = 'audit_logs') THEN
    CREATE POLICY "Audit logs: tenant isolation" ON audit_logs
      FOR SELECT USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_quarantine_tenant_status ON email_quarantine(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_tenant_event ON audit_logs(tenant_id, event_id, created_at DESC);

-- ============================================================
-- Done! 13 tables created.
-- ============================================================
