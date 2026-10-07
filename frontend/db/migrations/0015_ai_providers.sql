-- ════════════════════════════════════════════════════════════════════════════════════════════
--  0015 — AI providers
--  University-wide settings for the AI providers the platform may use: Google Gemini (the default), Anthropic Claude
--  and OpenAI ChatGPT. One row per provider: its API key (encrypted with AES-256-GCM by the application, never stored
--  in plain text), model, on/off switch and whether it is the default. Only the University Super Admin at
--  "All colleges" scope can read or change it through the application role.
-- ════════════════════════════════════════════════════════════════════════════════════════════
SET client_encoding = 'UTF8';
BEGIN;

CREATE TABLE IF NOT EXISTS ai_provider_settings (
  provider     text PRIMARY KEY CHECK (provider IN ('gemini','claude','openai')),
  api_key_enc  bytea,
  model        text NOT NULL DEFAULT '' CHECK (model = '' OR model ~ '^[A-Za-z0-9.:-]{3,80}$'),
  enabled      boolean NOT NULL DEFAULT false,
  is_default   boolean NOT NULL DEFAULT false,
  updated_by   text NOT NULL DEFAULT '' CHECK (length(updated_by) <= 120),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT is_default OR enabled)
);
CREATE UNIQUE INDEX IF NOT EXISTS ai_provider_settings_one_default ON ai_provider_settings (is_default) WHERE is_default;

ALTER TABLE ai_provider_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY platform_admin ON ai_provider_settings
    USING (app_scope_all())
    WITH CHECK (app_scope_all());
EXCEPTION WHEN duplicate_object THEN null;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON ai_provider_settings TO ciq_app;

COMMIT;
