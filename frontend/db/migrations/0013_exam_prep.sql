-- ════════════════════════════════════════════════════════════════════════════════════════════
--  0013 — competitive exam prep
--  current_affairs: daily current-affairs items a college's staff curate for students (with an optional question).
--  prep_attempts:   one summary row per finished daily aptitude test, practice mock or weekly current-affairs quiz,
--                   for the one-test-a-day rule, XP and peer percentiles (percentages only, never names).
-- ════════════════════════════════════════════════════════════════════════════════════════════
SET client_encoding = 'UTF8';
BEGIN;

CREATE TABLE IF NOT EXISTS current_affairs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id   uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  item_date    text NOT NULL CHECK (item_date ~ '^\d{4}-\d{2}-\d{2}$'),
  category     text NOT NULL CHECK (category IN ('National','Tamil Nadu','International','Economy','Science & Tech','Environment','Sports','Awards','Schemes','Appointments')),
  headline     text NOT NULL CHECK (length(headline) BETWEEN 10 AND 140),
  summary      text NOT NULL CHECK (length(summary) BETWEEN 20 AND 600),
  source_name  text NOT NULL DEFAULT '' CHECK (length(source_name) <= 80),
  source_url   text NOT NULL DEFAULT '' CHECK (source_url = '' OR (source_url ~ '^https://' AND length(source_url) <= 300)),
  tags         text[] NOT NULL DEFAULT '{}',
  status       text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Published')),
  mcq          jsonb CHECK (mcq IS NULL OR (jsonb_typeof(mcq) = 'object' AND length(mcq::text) <= 2000)),
  author_name  text NOT NULL DEFAULT '' CHECK (length(author_name) <= 120),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS current_affairs_college_date_idx ON current_affairs (college_id, item_date);

CREATE TABLE IF NOT EXISTS prep_attempts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id    uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL,
  kind          text NOT NULL CHECK (kind IN ('daily','mock','ca-quiz')),
  exam_id       text NOT NULL DEFAULT '' CHECK (length(exam_id) <= 40),
  ref           text NOT NULL CHECK (length(ref) BETWEEN 3 AND 80),
  score         double precision NOT NULL,
  max_score     double precision NOT NULL CHECK (max_score >= 0),
  percent       integer NOT NULL CHECK (percent BETWEEN -100 AND 100),
  seconds       integer NOT NULL DEFAULT 0 CHECK (seconds BETWEEN 0 AND 86400),
  submitted_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, ref)
);
CREATE INDEX IF NOT EXISTS prep_attempts_college_kind_idx ON prep_attempts (college_id, kind, exam_id);

ALTER TABLE current_affairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE current_affairs FORCE ROW LEVEL SECURITY;
ALTER TABLE prep_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE prep_attempts FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY college_isolation ON current_affairs
    USING (app_scope_all() OR college_id = app_college())
    WITH CHECK (app_scope_all() OR college_id = app_college());
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY college_isolation ON prep_attempts
    USING (app_scope_all() OR college_id = app_college())
    WITH CHECK (app_scope_all() OR college_id = app_college());
EXCEPTION WHEN duplicate_object THEN null;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON current_affairs TO ciq_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON prep_attempts TO ciq_app;

COMMIT;
