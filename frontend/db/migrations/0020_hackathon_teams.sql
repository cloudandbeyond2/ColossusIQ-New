-- ════════════════════════════════════════════════════════════════════════════════════════════
--  0020 — hackathon teams & registrations
--  Tracks hackathons and student team registrations with PostgreSQL RLS.
-- ════════════════════════════════════════════════════════════════════════════════════════════
SET client_encoding = 'UTF8';
BEGIN;

CREATE TABLE IF NOT EXISTS hackathon_teams (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id          uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  user_id             uuid NOT NULL,
  hackathon_id        text NOT NULL,
  hackathon_name      text NOT NULL,
  team_name           text NOT NULL CHECK (length(team_name) BETWEEN 2 AND 100),
  team_lead_name      text NOT NULL CHECK (length(team_lead_name) BETWEEN 2 AND 100),
  team_lead_email     text NOT NULL DEFAULT '',
  roll_no             text NOT NULL DEFAULT '',
  members_count       integer NOT NULL DEFAULT 4 CHECK (members_count BETWEEN 1 AND 10),
  member_names        text NOT NULL DEFAULT '',
  problem_statement   text NOT NULL CHECK (length(problem_statement) BETWEEN 2 AND 250),
  domain              text NOT NULL DEFAULT 'AI & Machine Learning',
  repo_url            text NOT NULL DEFAULT '' CHECK (length(repo_url) <= 300),
  status              text NOT NULL DEFAULT 'Registered' CHECK (status IN ('Registered', 'Shortlisted', 'Finalist', 'Winner', 'Withdrawn')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hackathon_teams_college_idx ON hackathon_teams (college_id);
CREATE INDEX IF NOT EXISTS hackathon_teams_user_idx ON hackathon_teams (user_id);
CREATE INDEX IF NOT EXISTS hackathon_teams_hackathon_idx ON hackathon_teams (hackathon_id);

ALTER TABLE hackathon_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE hackathon_teams FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY college_isolation ON hackathon_teams
    USING (app_scope_all() OR college_id = app_college())
    WITH CHECK (app_scope_all() OR college_id = app_college());
EXCEPTION WHEN duplicate_object THEN null;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON hackathon_teams TO ciq_app;

COMMIT;
