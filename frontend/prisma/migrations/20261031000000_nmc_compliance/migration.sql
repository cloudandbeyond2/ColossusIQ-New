-- NMC / council compliance: what the college itself records (registration profile, statutory committees, the action
-- plan, and the required faculty strength per department). Faculty counts, bed occupancy, skills-lab equipment and
-- every score are computed from the college's other records, never stored here.
BEGIN;

CREATE TABLE IF NOT EXISTS nmc_profile (
  college_id             uuid PRIMARY KEY REFERENCES colleges(id) ON DELETE CASCADE,
  nmc_code               text NOT NULL DEFAULT '' CHECK (length(nmc_code) <= 50),
  mbbs_seats             int  NOT NULL DEFAULT 0 CHECK (mbbs_seats BETWEEN 0 AND 500),
  lop_status             text NOT NULL DEFAULT '' CHECK (length(lop_status) <= 120),
  affiliation_year       int  NOT NULL DEFAULT 0 CHECK (affiliation_year = 0 OR affiliation_year BETWEEN 1800 AND 2200),
  cctv_online            int  NOT NULL DEFAULT 0 CHECK (cctv_online >= 0),
  cctv_total             int  NOT NULL DEFAULT 0 CHECK (cctv_total >= 0),
  aebas_active           boolean NOT NULL DEFAULT false,
  meu_certified          boolean NOT NULL DEFAULT false,
  ethics_reg_no          text NOT NULL DEFAULT '' CHECK (length(ethics_reg_no) <= 100),
  last_inspection_date   text NOT NULL DEFAULT '' CHECK (length(last_inspection_date) <= 20),
  next_inspection_window text NOT NULL DEFAULT '' CHECK (length(next_inspection_window) <= 80),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nmc_committees (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id        uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  name              text NOT NULL CHECK (length(name) BETWEEN 2 AND 160),
  mandate           text NOT NULL DEFAULT '' CHECK (length(mandate) <= 600),
  chairperson       text NOT NULL DEFAULT '' CHECK (length(chairperson) <= 100),
  convener          text NOT NULL DEFAULT '' CHECK (length(convener) <= 100),
  members_count     int  NOT NULL DEFAULT 0 CHECK (members_count BETWEEN 0 AND 50),
  meeting_frequency text NOT NULL DEFAULT '' CHECK (length(meeting_frequency) <= 60),
  last_meeting_date text NOT NULL DEFAULT '' CHECK (length(last_meeting_date) <= 20),
  status            text NOT NULL DEFAULT 'Not Constituted' CHECK (status IN ('Not Constituted','Constituted & Active','Pending Reconstitution','In Review')),
  mom_uploaded      boolean NOT NULL DEFAULT false,
  notes             text NOT NULL DEFAULT '' CHECK (length(notes) <= 500),
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS nmc_committees_name_key ON nmc_committees (college_id, lower(name));

CREATE TABLE IF NOT EXISTS nmc_actions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id  uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  title       text NOT NULL CHECK (length(title) BETWEEN 3 AND 200),
  category    text NOT NULL CHECK (length(category) BETWEEN 2 AND 100),
  priority    text NOT NULL CHECK (priority IN ('High','Medium','Low')),
  status      text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','In Progress','Resolved')),
  assignee    text NOT NULL CHECK (length(assignee) BETWEEN 2 AND 100),
  due_date    text NOT NULL CHECK (length(due_date) BETWEEN 8 AND 20),
  notes       text NOT NULL DEFAULT '' CHECK (length(notes) <= 500),
  resolved_at text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS nmc_actions_college_idx ON nmc_actions (college_id, created_at DESC);

CREATE TABLE IF NOT EXISTS nmc_department_norms (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id       uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  department       text NOT NULL CHECK (length(department) BETWEEN 2 AND 100),
  required_faculty int  CHECK (required_faculty IS NULL OR required_faculty BETWEEN 0 AND 200),
  aebas_attendance numeric(5,2) CHECK (aebas_attendance IS NULL OR aebas_attendance BETWEEN 0 AND 100),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (college_id, department)
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['nmc_profile','nmc_committees','nmc_actions','nmc_department_norms'] LOOP
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
