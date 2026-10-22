-- cbcs_courses / cbcs_registrations: the CBCS & Electives basket. A college offers elective courses; students (or staff
-- on their behalf) register for them. Seats filled is never stored: it is the number of registrations, so it can't drift.
-- The registration window and policy text live in module_settings (slug 'cbcs-electives').
BEGIN;

CREATE TABLE IF NOT EXISTS cbcs_courses (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id          uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  code                text NOT NULL CHECK (length(code) BETWEEN 2 AND 20),
  title               text NOT NULL CHECK (length(title) BETWEEN 3 AND 120),
  offering_department text NOT NULL CHECK (length(offering_department) BETWEEN 2 AND 100),
  semester            integer NOT NULL CHECK (semester BETWEEN 1 AND 8),
  category            text NOT NULL CHECK (category IN (
    'Discipline-Specific Elective (DSE)','Generic Elective (GE)','Skill Enhancement Course (SEC)',
    'Ability Enhancement (AECC)','Value-Added Course (VAC)')),
  credits             integer NOT NULL CHECK (credits BETWEEN 1 AND 6),
  seats_total         integer NOT NULL CHECK (seats_total BETWEEN 1 AND 1000),
  instructor          text NOT NULL DEFAULT '' CHECK (length(instructor) <= 100),
  schedule            text NOT NULL DEFAULT '' CHECK (length(schedule) <= 100),
  syllabus_summary    text NOT NULL DEFAULT '' CHECK (length(syllabus_summary) <= 500),
  created_by_sub      text NOT NULL DEFAULT '' CHECK (length(created_by_sub) <= 120),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS cbcs_courses_college_code_key ON cbcs_courses (college_id, upper(code));

CREATE TABLE IF NOT EXISTS cbcs_registrations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id    uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  course_id     uuid NOT NULL REFERENCES cbcs_courses(id) ON DELETE CASCADE,
  student_sub   text NOT NULL DEFAULT '' CHECK (length(student_sub) <= 120),
  student_name  text NOT NULL CHECK (length(student_name) BETWEEN 2 AND 100),
  reg_no        text NOT NULL CHECK (length(reg_no) BETWEEN 2 AND 30),
  department    text NOT NULL DEFAULT '' CHECK (length(department) <= 100),
  semester      integer NOT NULL CHECK (semester BETWEEN 1 AND 8),
  status        text NOT NULL DEFAULT 'Confirmed' CHECK (status IN ('Confirmed','Waitlisted','Pending Approval')),
  registered_by text NOT NULL DEFAULT '' CHECK (length(registered_by) <= 120),
  registered_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS cbcs_registrations_course_reg_key ON cbcs_registrations (course_id, upper(reg_no));
CREATE INDEX IF NOT EXISTS cbcs_registrations_college_idx ON cbcs_registrations (college_id, registered_at DESC);

ALTER TABLE cbcs_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE cbcs_courses FORCE ROW LEVEL SECURITY;
ALTER TABLE cbcs_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cbcs_registrations FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY college_isolation ON cbcs_courses
    USING (app_scope_all() OR college_id = app_college())
    WITH CHECK (app_scope_all() OR college_id = app_college());
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY college_isolation ON cbcs_registrations
    USING (app_scope_all() OR college_id = app_college())
    WITH CHECK (app_scope_all() OR college_id = app_college());
EXCEPTION WHEN duplicate_object THEN null;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON cbcs_courses TO ciq_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON cbcs_registrations TO ciq_app;

COMMIT;
