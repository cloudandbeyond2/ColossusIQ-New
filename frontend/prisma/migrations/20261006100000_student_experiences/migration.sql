-- ════════════════════════════════════════════════════════════════════════════════════════════
--  0009 — student experience passport
--  One row per activity a student records (volunteering, leadership, competitions …). Faculty and HODs of the same college
--  verify or reject each one; the decision, the reviewer and the date are kept with the row.
-- ════════════════════════════════════════════════════════════════════════════════════════════
SET client_encoding = 'UTF8';
BEGIN;

CREATE TABLE IF NOT EXISTS student_experiences (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id    uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL,
  student_name  text NOT NULL,
  roll_no       text NOT NULL DEFAULT '',
  title         text NOT NULL CHECK (length(title) BETWEEN 2 AND 120),
  category      text NOT NULL CHECK (category IN ('Volunteering','Leadership','Competition','Conference or workshop','Social service','Club or society','Sports or cultural','Internship or work','Other')),
  organisation  text NOT NULL DEFAULT '' CHECK (length(organisation) <= 120),
  role_title    text NOT NULL DEFAULT '' CHECK (length(role_title) <= 100),
  start_month   text NOT NULL CHECK (start_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  end_month     text CHECK (end_month IS NULL OR (end_month ~ '^\d{4}-(0[1-9]|1[0-2])$' AND end_month >= start_month)),
  description   text NOT NULL DEFAULT '' CHECK (length(description) <= 1000),
  link          text NOT NULL DEFAULT '' CHECK (length(link) <= 500),
  status        text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Verified','Rejected')),
  review_note   text NOT NULL DEFAULT '' CHECK (length(review_note) <= 500),
  reviewer_name text NOT NULL DEFAULT '',
  reviewer_role text NOT NULL DEFAULT '',
  reviewed_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS student_experiences_college_status_idx ON student_experiences (college_id, status);
CREATE INDEX IF NOT EXISTS student_experiences_user_idx ON student_experiences (user_id);

ALTER TABLE student_experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_experiences FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY college_isolation ON student_experiences
    USING (app_scope_all() OR college_id = app_college())
    WITH CHECK (app_scope_all() OR college_id = app_college());
EXCEPTION WHEN duplicate_object THEN null;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON student_experiences TO ciq_app;

COMMIT;
