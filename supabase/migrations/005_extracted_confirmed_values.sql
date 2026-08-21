-- Migration 005: Extracted and Confirmed Values (two-table hard constraint)

-- AI-extracted values — NEVER shown as vendor-attested
CREATE TABLE extracted_values (
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

-- Human-confirmed values — these ARE vendor-attested
CREATE TABLE confirmed_values (
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

-- Comparison grid cache
CREATE TABLE comparison_grid_cache (
  event_id                      UUID PRIMARY KEY REFERENCES rfx_events,
  tenant_id                     UUID NOT NULL,
  grid_data                     JSONB NOT NULL DEFAULT '{}',
  has_unconfirmed_low_conf      BOOLEAN NOT NULL DEFAULT false,
  award_blocked_field_keys      TEXT[] NOT NULL DEFAULT '{}',
  last_rebuilt_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE extracted_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE confirmed_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE comparison_grid_cache ENABLE ROW LEVEL SECURITY;

-- Sealed-bid: extraction only visible after event close OR to event creator
CREATE POLICY "Extracted values: sealed-bid" ON extracted_values
  FOR SELECT USING (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID
    AND EXISTS (
      SELECT 1 FROM rfx_events e
      WHERE e.id = extracted_values.event_id
        AND (e.status IN ('closed','awarded') OR e.created_by = auth.uid())
    )
  );
CREATE POLICY "Extracted values: insert by service role" ON extracted_values
  FOR INSERT WITH CHECK (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);

CREATE POLICY "Confirmed values: tenant isolation" ON confirmed_values
  FOR ALL USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);

CREATE POLICY "Grid cache: tenant isolation" ON comparison_grid_cache
  FOR ALL USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);

-- Indexes
CREATE INDEX idx_extracted_submission ON extracted_values(submission_id, field_key);
CREATE INDEX idx_extracted_event ON extracted_values(event_id);
CREATE INDEX idx_confirmed_submission ON confirmed_values(submission_id, field_key);
CREATE INDEX idx_confirmed_event ON confirmed_values(event_id);
