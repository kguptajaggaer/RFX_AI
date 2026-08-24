-- Migration 007: Fix RLS policies to use profiles table lookup
-- instead of app_metadata JWT claim (which requires a custom auth hook).
-- This makes multi-tenancy work out of the box without JWT configuration.

-- Helper: get tenant_id for the current user
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT tenant_id FROM profiles WHERE id = auth.uid()
$$;

-- ── tenants ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Tenants: own tenant only" ON tenants;
CREATE POLICY "Tenants: own tenant only" ON tenants
  FOR ALL USING (id = current_tenant_id());

-- ── profiles ──────────────────────────────────────────────
DROP POLICY IF EXISTS "Profiles: own tenant only" ON profiles;
CREATE POLICY "Profiles: own tenant only" ON profiles
  FOR ALL USING (tenant_id = current_tenant_id());

-- ── rfx_events ────────────────────────────────────────────
DROP POLICY IF EXISTS "RFx events: tenant isolation" ON rfx_events;
CREATE POLICY "RFx events: tenant isolation" ON rfx_events
  FOR ALL USING (tenant_id = current_tenant_id());

-- ── rfx_schema_fields ─────────────────────────────────────
DROP POLICY IF EXISTS "Schema fields: tenant isolation" ON rfx_schema_fields;
CREATE POLICY "Schema fields: tenant isolation" ON rfx_schema_fields
  FOR ALL USING (tenant_id = current_tenant_id());

-- ── ai_drafting_sessions ──────────────────────────────────
DROP POLICY IF EXISTS "AI sessions: tenant isolation" ON ai_drafting_sessions;
CREATE POLICY "AI sessions: tenant isolation" ON ai_drafting_sessions
  FOR ALL USING (tenant_id = current_tenant_id());

-- ── vendors ───────────────────────────────────────────────
DROP POLICY IF EXISTS "Vendors: tenant isolation" ON vendors;
CREATE POLICY "Vendors: tenant isolation" ON vendors
  FOR ALL USING (tenant_id = current_tenant_id());

-- ── vendor_invitations ────────────────────────────────────
DROP POLICY IF EXISTS "Invitations: tenant isolation" ON vendor_invitations;
CREATE POLICY "Invitations: tenant isolation" ON vendor_invitations
  FOR ALL USING (tenant_id = current_tenant_id());

-- ── offer_submissions ─────────────────────────────────────
DROP POLICY IF EXISTS "Submissions: tenant isolation" ON offer_submissions;
CREATE POLICY "Submissions: tenant isolation" ON offer_submissions
  FOR ALL USING (tenant_id = current_tenant_id());

-- ── offer_attachments ─────────────────────────────────────
DROP POLICY IF EXISTS "Attachments: tenant isolation" ON offer_attachments;
CREATE POLICY "Attachments: tenant isolation" ON offer_attachments
  FOR ALL USING (tenant_id = current_tenant_id());

-- ── extracted_values (sealed-bid) ────────────────────────
DROP POLICY IF EXISTS "Extracted values: sealed-bid" ON extracted_values;
CREATE POLICY "Extracted values: sealed-bid" ON extracted_values
  FOR SELECT USING (
    tenant_id = current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM rfx_events e
      WHERE e.id = extracted_values.event_id
        AND (e.status IN ('closed','awarded') OR e.created_by = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Extracted values: insert by service role" ON extracted_values;
CREATE POLICY "Extracted values: insert by service role" ON extracted_values
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

-- ── confirmed_values ──────────────────────────────────────
DROP POLICY IF EXISTS "Confirmed values: tenant isolation" ON confirmed_values;
CREATE POLICY "Confirmed values: tenant isolation" ON confirmed_values
  FOR ALL USING (tenant_id = current_tenant_id());

-- ── comparison_grid_cache ─────────────────────────────────
DROP POLICY IF EXISTS "Grid cache: tenant isolation" ON comparison_grid_cache;
CREATE POLICY "Grid cache: tenant isolation" ON comparison_grid_cache
  FOR ALL USING (tenant_id = current_tenant_id());

-- ── email_quarantine ──────────────────────────────────────
DROP POLICY IF EXISTS "Quarantine: tenant isolation" ON email_quarantine;
CREATE POLICY "Quarantine: tenant isolation" ON email_quarantine
  FOR ALL USING (tenant_id = current_tenant_id());

-- ── audit_logs ────────────────────────────────────────────
DROP POLICY IF EXISTS "Audit logs: tenant isolation" ON audit_logs;
CREATE POLICY "Audit logs: tenant isolation" ON audit_logs
  FOR SELECT USING (tenant_id = current_tenant_id());
