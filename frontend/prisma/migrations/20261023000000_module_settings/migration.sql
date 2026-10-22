-- module_settings: what an administrator saves on a settings page (Branding & White Label, Security settings,
-- Notification rules). One row per college and page; college_id NULL holds the platform default that every college
-- inherits until it saves its own. Until now these lived in server memory and were lost on every restart.
BEGIN;

CREATE TABLE IF NOT EXISTS module_settings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id  uuid REFERENCES colleges(id) ON DELETE CASCADE,
  slug        text NOT NULL CHECK (length(slug) BETWEEN 1 AND 60),
  settings    jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(settings) = 'object' AND length(settings::text) <= 40000),
  updated_by  text NOT NULL DEFAULT '' CHECK (length(updated_by) <= 120),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS module_settings_college_slug_uniq ON module_settings (college_id, slug) WHERE college_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS module_settings_default_slug_uniq ON module_settings (slug) WHERE college_id IS NULL;

ALTER TABLE module_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_settings FORCE ROW LEVEL SECURITY;

-- The platform default (college_id NULL) is readable in every college but written only at "All colleges".
DO $$ BEGIN
  CREATE POLICY college_or_default ON module_settings
    USING (app_scope_all() OR college_id IS NULL OR college_id = app_college())
    WITH CHECK (app_scope_all() OR college_id = app_college());
EXCEPTION WHEN duplicate_object THEN null;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON module_settings TO ciq_app;

COMMIT;
