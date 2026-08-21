-- Migration 001: Tenants and Profiles
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE tenants (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  slug                  TEXT UNIQUE NOT NULL,
  industry              TEXT,
  inbound_email_domain  TEXT NOT NULL DEFAULT 'inbound.rfxai.com',
  settings              JSONB NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES tenants,
  full_name   TEXT,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'buyer'
              CHECK (role IN ('admin', 'buyer', 'approver', 'viewer')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants: own tenant only" ON tenants
  FOR ALL USING (id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);

CREATE POLICY "Profiles: own tenant only" ON profiles
  FOR ALL USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID);
