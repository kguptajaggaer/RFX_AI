-- Migration 004: Offer Submissions and Attachments

CREATE TABLE offer_submissions (
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

CREATE TABLE offer_attachments (
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

-- RLS
ALTER TABLE offer_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Submissions: tenant isolation" ON offer_submissions
  FOR ALL USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);
CREATE POLICY "Attachments: tenant isolation" ON offer_attachments
  FOR ALL USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);

-- Indexes
CREATE INDEX idx_submissions_event ON offer_submissions(event_id, status);
CREATE INDEX idx_submissions_extraction ON offer_submissions(extraction_status) WHERE extraction_status IN ('queued','in_progress');
CREATE INDEX idx_attachments_submission ON offer_attachments(submission_id);
