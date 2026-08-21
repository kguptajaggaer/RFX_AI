-- Migration 002: RFx Events and Schema Fields

CREATE TABLE rfx_events (
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

CREATE TABLE rfx_schema_fields (
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

CREATE TABLE ai_drafting_sessions (
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

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rfx_events_updated_at BEFORE UPDATE ON rfx_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER ai_sessions_updated_at BEFORE UPDATE ON ai_drafting_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE rfx_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfx_schema_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_drafting_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "RFx events: tenant isolation" ON rfx_events
  FOR ALL USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);
CREATE POLICY "Schema fields: tenant isolation" ON rfx_schema_fields
  FOR ALL USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);
CREATE POLICY "AI sessions: tenant isolation" ON ai_drafting_sessions
  FOR ALL USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);

-- Indexes
CREATE INDEX idx_rfx_events_tenant_status ON rfx_events(tenant_id, status);
CREATE INDEX idx_schema_fields_event ON rfx_schema_fields(event_id, display_order);
