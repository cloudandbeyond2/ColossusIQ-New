-- ════════════════════════════════════════════════════════════════════════════════════════════
--  0017 — Module access (Super Admin → Module Control)
--  Modules the University Super Admin has switched off for a role. Every module is on for the roles it is granted
--  to until a row here switches it off. Everyone may read it (menus and pages consult it on every request); only
--  the Super Admin at "All colleges" scope may change it through the application role.
-- ════════════════════════════════════════════════════════════════════════════════════════════
SET client_encoding = 'UTF8';
BEGIN;

CREATE TABLE IF NOT EXISTS module_access (
  module_slug  text NOT NULL CHECK (module_slug ~ '^[a-z0-9-]{2,60}$'),
  role         text NOT NULL CHECK (role IN ('student','faculty','hod','placement','incubation','institution','recruiter','admin')),
  enabled      boolean NOT NULL DEFAULT false,
  updated_by   text NOT NULL DEFAULT '' CHECK (length(updated_by) <= 120),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (module_slug, role)
);

ALTER TABLE module_access ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY read_all ON module_access FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE POLICY platform_admin_write ON module_access FOR ALL
    USING (app_scope_all())
    WITH CHECK (app_scope_all());
EXCEPTION WHEN duplicate_object THEN null;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON module_access TO ciq_app;

COMMIT;
