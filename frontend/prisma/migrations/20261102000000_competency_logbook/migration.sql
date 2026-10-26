-- CBME competency logbook. A college keeps a catalogue of competencies; a student asks for sign-off on one (an entry);
-- a faculty member or HOD certifies it or returns it with remarks. "Not attempted" is the absence of an entry.
BEGIN;

CREATE TABLE IF NOT EXISTS logbook_competencies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id  uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  code        text NOT NULL CHECK (length(code) BETWEEN 2 AND 30),
  description text NOT NULL CHECK (length(description) BETWEEN 3 AND 300),
  department  text NOT NULL CHECK (length(department) BETWEEN 2 AND 120),
  level       text NOT NULL CHECK (level IN ('K','KH','SH','P')),
  created_by_sub text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS logbook_competencies_code_key ON logbook_competencies (college_id, lower(code));

CREATE TABLE IF NOT EXISTS logbook_entries (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id     uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  competency_id  uuid NOT NULL REFERENCES logbook_competencies(id) ON DELETE CASCADE,
  student_sub    text NOT NULL CHECK (length(student_sub) BETWEEN 1 AND 100),
  student_name   text NOT NULL DEFAULT '',
  roll_no        text NOT NULL DEFAULT '',
  attempts       int  NOT NULL DEFAULT 1 CHECK (attempts BETWEEN 1 AND 100),
  status         text NOT NULL DEFAULT 'Pending review' CHECK (status IN ('Pending review','Certified','Returned')),
  notes          text NOT NULL DEFAULT '' CHECK (length(notes) <= 500),
  remarks        text NOT NULL DEFAULT '' CHECK (length(remarks) <= 500),
  certified_by   text NOT NULL DEFAULT '',
  certified_at   timestamptz,
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS logbook_entries_key ON logbook_entries (competency_id, student_sub);
CREATE INDEX IF NOT EXISTS logbook_entries_college_idx ON logbook_entries (college_id, status);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['logbook_competencies','logbook_entries'] LOOP
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
