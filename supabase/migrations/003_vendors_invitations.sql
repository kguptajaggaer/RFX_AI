-- Migration 003: Vendors and Invitations

CREATE TABLE vendors (
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

CREATE TABLE vendor_invitations (
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

-- RLS
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors: tenant isolation" ON vendors
  FOR ALL USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);
CREATE POLICY "Invitations: tenant isolation" ON vendor_invitations
  FOR ALL USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);

-- Indexes
CREATE INDEX idx_invitations_token ON vendor_invitations(invite_token);
CREATE INDEX idx_invitations_reply_email ON vendor_invitations(reply_email);
CREATE INDEX idx_invitations_event ON vendor_invitations(event_id, status);
