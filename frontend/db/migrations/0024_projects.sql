-- ════════════════════════════════════════════════════════════════════════════════════════════
--  0023 — projects table
--  Stores student projects, stages lifecycle, teammates, and AI/faculty reviews.
-- ════════════════════════════════════════════════════════════════════════════════════════════
SET client_encoding = 'UTF8';
BEGIN;

CREATE SEQUENCE IF NOT EXISTS seq_project_public START 1001;

CREATE TABLE IF NOT EXISTS projects (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id    text NOT NULL UNIQUE DEFAULT ('PRJ-' || nextval('seq_project_public')),
  college_id   uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL,
  title        text NOT NULL CHECK (length(title) BETWEEN 2 AND 150),
  domain       text NOT NULL CHECK (length(domain) BETWEEN 2 AND 100),
  mentor       text NOT NULL DEFAULT 'Unassigned',
  mentor_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  team         jsonb NOT NULL DEFAULT '[]'::jsonb,
  stage        text NOT NULL DEFAULT 'Idea',
  progress     int NOT NULL DEFAULT 10 CHECK (progress BETWEEN 0 AND 100),
  stages       jsonb NOT NULL DEFAULT '[]'::jsonb,
  review       jsonb NOT NULL DEFAULT '{"architecture": 0, "documentation": 0, "codeQuality": 0, "testing": 0, "innovation": 0}'::jsonb,
  repo_url     text NOT NULL DEFAULT '',
  doc_url      text NOT NULL DEFAULT '',
  demo_url     text NOT NULL DEFAULT '',
  status       text NOT NULL DEFAULT 'Active',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS projects_college_idx ON projects (college_id);
CREATE INDEX IF NOT EXISTS projects_user_idx ON projects (user_id);
CREATE INDEX IF NOT EXISTS projects_mentor_idx ON projects (mentor_id);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY college_isolation ON projects
    USING (app_scope_all() OR college_id = app_college())
    WITH CHECK (app_scope_all() OR college_id = app_college());
EXCEPTION WHEN duplicate_object THEN null;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON projects TO ciq_app;
GRANT USAGE, SELECT ON SEQUENCE seq_project_public TO ciq_app;

COMMIT;
