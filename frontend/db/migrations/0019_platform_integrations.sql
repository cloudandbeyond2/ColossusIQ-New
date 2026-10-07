-- ════════════════════════════════════════════════════════════════════════════════════════════
--  0019 — Integrations & Setup
--  University-wide settings for external services: cloud storage, email, WhatsApp, SMS, online payments, single
--  sign-on, online classes and the ERP/SIS webhook. One row per integration: the chosen provider, on/off, its
--  non-secret settings (JSON) and its secrets (one JSON object encrypted with AES-256-GCM by the application, never
--  stored in plain text). Only the University Super Admin at "All colleges" scope can read or change it through the
--  application role.
-- ════════════════════════════════════════════════════════════════════════════════════════════
SET client_encoding = 'UTF8';
BEGIN;

CREATE TABLE IF NOT EXISTS platform_integrations (
  id           text PRIMARY KEY CHECK (id IN ('storage','email','whatsapp','sms','payments','sso','meetings','webhook')),
  provider     text NOT NULL CHECK (provider ~ '^[a-z0-9-]{2,40}$'),
  enabled      boolean NOT NULL DEFAULT false,
  settings     jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(settings) = 'object' AND length(settings::text) <= 20000),
  secrets_enc  bytea,
  updated_by   text NOT NULL DEFAULT '' CHECK (length(updated_by) <= 120),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE platform_integrations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY platform_admin ON platform_integrations
    USING (app_scope_all())
    WITH CHECK (app_scope_all());
EXCEPTION WHEN duplicate_object THEN null;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON platform_integrations TO ciq_app;

COMMIT;
