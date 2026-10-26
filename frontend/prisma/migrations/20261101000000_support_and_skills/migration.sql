-- Student support (Early Warning) and skill programmes (Skill Intelligence), previously held only in server memory.
--   student_support_cases   one review record per student: status, mentor, notes
--   student_support_actions support plans staff create for a student
--   skill_interventions     skill programmes a department runs for a batch
BEGIN;

CREATE TABLE IF NOT EXISTS student_support_cases (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id       uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  student_sub      text NOT NULL CHECK (length(student_sub) BETWEEN 1 AND 100),
  status           text NOT NULL DEFAULT 'Pending review' CHECK (status IN ('Pending review','In progress','Resolved')),
  assigned_mentor  text NOT NULL DEFAULT '' CHECK (length(assigned_mentor) <= 120),
  notes            text NOT NULL DEFAULT '' CHECK (length(notes) <= 600),
  last_action_date date,
  updated_by_sub   text NOT NULL DEFAULT '',
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS student_support_cases_key ON student_support_cases (college_id, student_sub);

CREATE TABLE IF NOT EXISTS student_support_actions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id   uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  student_sub  text NOT NULL CHECK (length(student_sub) BETWEEN 1 AND 100),
  student_name text NOT NULL DEFAULT '',
  roll_no      text NOT NULL DEFAULT '',
  department   text NOT NULL DEFAULT '',
  strategy     text NOT NULL CHECK (length(strategy) BETWEEN 2 AND 200),
  faculty_lead text NOT NULL CHECK (length(faculty_lead) BETWEEN 2 AND 120),
  target_date  text NOT NULL CHECK (length(target_date) BETWEEN 4 AND 20),
  status       text NOT NULL DEFAULT 'In progress' CHECK (status IN ('Scheduled','In progress','Completed')),
  notes        text NOT NULL DEFAULT '' CHECK (length(notes) <= 500),
  author_sub   text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS student_support_actions_college_idx ON student_support_actions (college_id, created_at DESC);

CREATE TABLE IF NOT EXISTS skill_interventions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id    uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  title         text NOT NULL CHECK (length(title) BETWEEN 2 AND 120),
  department    text NOT NULL CHECK (length(department) BETWEEN 1 AND 120),
  batch         text NOT NULL CHECK (length(batch) BETWEEN 1 AND 80),
  target_skill  text NOT NULL CHECK (length(target_skill) BETWEEN 2 AND 120),
  faculty_lead  text NOT NULL CHECK (length(faculty_lead) BETWEEN 2 AND 120),
  duration      text NOT NULL CHECK (length(duration) BETWEEN 2 AND 60),
  status        text NOT NULL DEFAULT 'Upcoming' CHECK (status IN ('Active','Upcoming','Completed')),
  author_sub    text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS skill_interventions_college_idx ON skill_interventions (college_id, created_at DESC);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['student_support_cases','student_support_actions','skill_interventions'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    BEGIN
      EXECUTE format('CREATE POLICY college_isolation ON %I USING (app_scope_all() OR college_id = app_college()) WITH CHECK (app_scope_all() OR college_id = app_college())', t);
    EXCEPTION WHEN duplicate_object THEN null;
    END;
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO ciq_app', t);
  END LOOP;
END $$;

COMMIT;
