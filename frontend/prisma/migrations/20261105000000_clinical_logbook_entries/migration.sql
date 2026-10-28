-- Clinical Rotations: bedside patient cases clerked by students and DOPS procedural skills awaiting faculty sign-off.
BEGIN;

CREATE TABLE IF NOT EXISTS clinical_cases (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id    uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  student_sub   text NOT NULL DEFAULT '',
  student_name  text NOT NULL CHECK (length(student_name) BETWEEN 1 AND 120),
  bed           text NOT NULL DEFAULT '' CHECK (length(bed) <= 40),
  patient       text NOT NULL CHECK (length(patient) BETWEEN 2 AND 120),
  diagnosis     text NOT NULL CHECK (length(diagnosis) BETWEEN 2 AND 200),
  complaints    text NOT NULL DEFAULT '' CHECK (length(complaints) <= 1000),
  faculty       text NOT NULL DEFAULT '' CHECK (length(faculty) <= 120),
  status        text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected')),
  case_date     date NOT NULL DEFAULT current_date,
  verified_by   text NOT NULL DEFAULT '' CHECK (length(verified_by) <= 120),
  verified_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS clinical_cases_college_idx ON clinical_cases (college_id, case_date DESC);
CREATE INDEX IF NOT EXISTS clinical_cases_student_idx ON clinical_cases (college_id, student_sub);

CREATE TABLE IF NOT EXISTS clinical_skills (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id    uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  student_sub   text NOT NULL DEFAULT '',
  student_name  text NOT NULL CHECK (length(student_name) BETWEEN 1 AND 120),
  code          text NOT NULL CHECK (length(code) BETWEEN 2 AND 20),
  name          text NOT NULL CHECK (length(name) BETWEEN 3 AND 200),
  level         text NOT NULL CHECK (level IN ('Shows How','Performs')),
  notes         text NOT NULL DEFAULT '' CHECK (length(notes) <= 2000),
  supervisor    text NOT NULL CHECK (length(supervisor) BETWEEN 2 AND 120),
  status        text NOT NULL DEFAULT 'Pending Review' CHECK (status IN ('Pending Review','Certified','Rejected')),
  performed_on  date NOT NULL DEFAULT current_date,
  certified_by  text NOT NULL DEFAULT '' CHECK (length(certified_by) <= 120),
  certified_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS clinical_skills_college_idx ON clinical_skills (college_id, performed_on DESC);
CREATE INDEX IF NOT EXISTS clinical_skills_student_idx ON clinical_skills (college_id, student_sub);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['clinical_cases','clinical_skills'] LOOP
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
