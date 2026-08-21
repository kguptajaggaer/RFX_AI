-- Migration 006: Email Quarantine and Audit Logs

CREATE TABLE email_quarantine (
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

-- Partitioned audit log
CREATE TABLE audit_logs (
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

CREATE TABLE audit_logs_2026_q3 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-07-01') TO ('2026-10-01');
CREATE TABLE audit_logs_2026_q4 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-10-01') TO ('2027-01-01');
CREATE TABLE audit_logs_2027_q1 PARTITION OF audit_logs
  FOR VALUES FROM ('2027-01-01') TO ('2027-04-01');

-- RLS
ALTER TABLE email_quarantine ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Quarantine: tenant isolation" ON email_quarantine
  FOR ALL USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);
CREATE POLICY "Audit logs: tenant isolation" ON audit_logs
  FOR SELECT USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);

-- Indexes
CREATE INDEX idx_quarantine_tenant_status ON email_quarantine(tenant_id, status);
CREATE INDEX idx_audit_tenant_event ON audit_logs(tenant_id, event_id, created_at DESC);
