-- ════════════════════════════════════════════════════════════════════════════════════════════
--  0021 — Institutional & Accreditation Reports
--  Persists custom and scheduled reports across faculty, HOD, and institutional leadership.
-- ════════════════════════════════════════════════════════════════════════════════════════════
SET client_encoding = 'UTF8';
BEGIN;

CREATE TABLE IF NOT EXISTS institutional_reports (
  id            text PRIMARY KEY,
  college_id    uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  report        text NOT NULL CHECK (length(report) BETWEEN 2 AND 200),
  category      text NOT NULL CHECK (category IN ('Academic', 'Department', 'Placement', 'Compliance', 'Faculty', 'Institution')),
  scope         text NOT NULL,
  period        text NOT NULL,
  formats       jsonb NOT NULL DEFAULT '["PDF", "Excel", "CSV"]'::jsonb,
  file_size     text NOT NULL DEFAULT '3.2 MB',
  generated_by  text NOT NULL,
  author_role   text NOT NULL DEFAULT 'faculty',
  summary       text NOT NULL DEFAULT '',
  kpis          jsonb NOT NULL DEFAULT '[]'::jsonb,
  breakdown     jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS institutional_reports_college_idx ON institutional_reports (college_id);
CREATE INDEX IF NOT EXISTS institutional_reports_category_idx ON institutional_reports (category);
CREATE INDEX IF NOT EXISTS institutional_reports_created_idx ON institutional_reports (college_id, created_at DESC);

ALTER TABLE institutional_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE institutional_reports FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY college_isolation ON institutional_reports
    USING (app_scope_all() OR college_id = app_college())
    WITH CHECK (app_scope_all() OR college_id = app_college());
EXCEPTION WHEN duplicate_object THEN null;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON institutional_reports TO ciq_app;

CREATE TABLE IF NOT EXISTS scheduled_reports (
  id            text PRIMARY KEY,
  college_id    uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  name          text NOT NULL,
  frequency     text NOT NULL CHECK (frequency IN ('Weekly', 'Bi-Weekly', 'Monthly', 'End of Term')),
  scope         text NOT NULL,
  recipients    text NOT NULL,
  next_run      text NOT NULL,
  enabled       boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scheduled_reports_college_idx ON scheduled_reports (college_id);

ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_reports FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY college_isolation ON scheduled_reports
    USING (app_scope_all() OR college_id = app_college())
    WITH CHECK (app_scope_all() OR college_id = app_college());
EXCEPTION WHEN duplicate_object THEN null;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON scheduled_reports TO ciq_app;

COMMIT;
