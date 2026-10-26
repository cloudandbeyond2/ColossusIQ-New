-- OSCE & Skills Simulation Lab: the college's own stations (with their checklist), exam sessions, skills-lab bookings,
-- graded results and simulator inventory. Pass rate, average score and "candidates evaluated" are never stored: they are
-- worked out from the graded results, so they always match what was actually recorded.
BEGIN;

CREATE TABLE IF NOT EXISTS osce_stations (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id             uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  number                 integer NOT NULL CHECK (number >= 1),
  title                  text NOT NULL CHECK (length(title) BETWEEN 3 AND 160),
  department             text NOT NULL CHECK (length(department) BETWEEN 2 AND 120),
  domain                 text NOT NULL CHECK (domain IN ('Procedure','Communication','Emergency','Data interpretation','Physical Exam')),
  duration_minutes       integer NOT NULL CHECK (duration_minutes BETWEEN 3 AND 30),
  total_marks            integer NOT NULL CHECK (total_marks BETWEEN 10 AND 100),
  pass_marks             integer NOT NULL CHECK (pass_marks BETWEEN 5 AND 100),
  nmc_competency_code    text NOT NULL CHECK (length(nmc_competency_code) BETWEEN 2 AND 30),
  room                   text NOT NULL CHECK (length(room) BETWEEN 2 AND 120),
  manikin_equipment      text NOT NULL CHECK (length(manikin_equipment) BETWEEN 2 AND 160),
  examiner               text NOT NULL DEFAULT '' CHECK (length(examiner) <= 120),
  status                 text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Maintenance','Under Review')),
  critical_step_required boolean NOT NULL DEFAULT false,
  critical_step_description text NOT NULL DEFAULT '' CHECK (length(critical_step_description) <= 400),
  checklist              jsonb NOT NULL DEFAULT '[]',
  created_by_sub         text NOT NULL DEFAULT '' CHECK (length(created_by_sub) <= 120),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS osce_stations_college_idx ON osce_stations (college_id, number);

CREATE TABLE IF NOT EXISTS osce_sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id       uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  title            text NOT NULL CHECK (length(title) BETWEEN 3 AND 160),
  batch            text NOT NULL CHECK (length(batch) BETWEEN 2 AND 120),
  department       text NOT NULL CHECK (length(department) BETWEEN 2 AND 120),
  date             text NOT NULL CHECK (date ~ '^\d{4}-\d{2}-\d{2}$'),
  time_slot        text NOT NULL CHECK (length(time_slot) BETWEEN 3 AND 60),
  venue            text NOT NULL CHECK (length(venue) BETWEEN 2 AND 160),
  total_candidates integer NOT NULL CHECK (total_candidates >= 1),
  lead_examiner    text NOT NULL CHECK (length(lead_examiner) BETWEEN 2 AND 120),
  status           text NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Scheduled','In Progress','Completed','Results Published')),
  created_by_sub   text NOT NULL DEFAULT '' CHECK (length(created_by_sub) <= 120),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS osce_sessions_college_idx ON osce_sessions (college_id, date);

CREATE TABLE IF NOT EXISTS osce_bookings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id     uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  applicant_name text NOT NULL CHECK (length(applicant_name) BETWEEN 2 AND 120),
  applicant_role text NOT NULL CHECK (applicant_role IN ('Student','Resident','Faculty')),
  station_or_room text NOT NULL CHECK (length(station_or_room) BETWEEN 2 AND 160),
  equipment      text NOT NULL CHECK (length(equipment) BETWEEN 2 AND 160),
  date           text NOT NULL CHECK (date ~ '^\d{4}-\d{2}-\d{2}$'),
  time_slot      text NOT NULL CHECK (length(time_slot) BETWEEN 3 AND 60),
  purpose        text NOT NULL CHECK (purpose IN ('Independent Practice','Faculty-Guided Demo','Remediation Training')),
  status         text NOT NULL DEFAULT 'Pending Review' CHECK (status IN ('Approved','Pending Review','Completed','Rejected')),
  notes          text NOT NULL DEFAULT '' CHECK (length(notes) <= 500),
  requested_by_sub text NOT NULL DEFAULT '' CHECK (length(requested_by_sub) <= 120),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS osce_bookings_college_idx ON osce_bookings (college_id, date);

CREATE TABLE IF NOT EXISTS osce_results (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id       uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  station_id       uuid NOT NULL REFERENCES osce_stations(id) ON DELETE CASCADE,
  session_id       uuid REFERENCES osce_sessions(id) ON DELETE SET NULL,
  roll_no          text NOT NULL CHECK (length(roll_no) BETWEEN 2 AND 40),
  student_name     text NOT NULL CHECK (length(student_name) BETWEEN 2 AND 120),
  batch            text NOT NULL CHECK (length(batch) BETWEEN 2 AND 120),
  score            numeric NOT NULL CHECK (score >= 0),
  total            integer NOT NULL CHECK (total >= 1),
  grade            text NOT NULL CHECK (grade IN ('Distinction','Pass','Remediation Needed')),
  critical_step_met boolean NOT NULL DEFAULT true,
  examiner         text NOT NULL DEFAULT '' CHECK (length(examiner) <= 120),
  examiner_sub     text NOT NULL DEFAULT '' CHECK (length(examiner_sub) <= 120),
  evaluator_remarks text NOT NULL DEFAULT '' CHECK (length(evaluator_remarks) <= 600),
  cbme_certified   boolean NOT NULL DEFAULT false,
  graded_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS osce_results_college_idx ON osce_results (college_id, graded_at DESC);
CREATE INDEX IF NOT EXISTS osce_results_station_idx ON osce_results (station_id);

CREATE TABLE IF NOT EXISTS osce_equipment (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id             uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  name                   text NOT NULL CHECK (length(name) BETWEEN 2 AND 160),
  serial_no              text NOT NULL CHECK (length(serial_no) BETWEEN 1 AND 60),
  category               text NOT NULL CHECK (length(category) BETWEEN 2 AND 120),
  room                   text NOT NULL CHECK (length(room) BETWEEN 2 AND 120),
  status                 text NOT NULL DEFAULT 'Operational' CHECK (status IN ('Operational','Calibration Due','Maintenance')),
  last_inspection        text NOT NULL DEFAULT '' CHECK (last_inspection = '' OR last_inspection ~ '^\d{4}-\d{2}-\d{2}$'),
  next_maintenance       text NOT NULL DEFAULT '' CHECK (next_maintenance = '' OR next_maintenance ~ '^\d{4}-\d{2}-\d{2}$'),
  utilization_hours_week numeric NOT NULL DEFAULT 0 CHECK (utilization_hours_week >= 0),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS osce_equipment_serial_key ON osce_equipment (college_id, upper(serial_no));

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['osce_stations','osce_sessions','osce_bookings','osce_results','osce_equipment'] LOOP
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
