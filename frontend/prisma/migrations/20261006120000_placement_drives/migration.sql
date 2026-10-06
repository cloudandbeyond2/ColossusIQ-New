-- ════════════════════════════════════════════════════════════════════════════════════════════
--  0011 — placement drives
--  One row per campus recruitment drive the placement office schedules: company, role, date, package, who may apply
--  (departments and a minimum Placement Readiness total) and the outcome counts once it has run.
-- ════════════════════════════════════════════════════════════════════════════════════════════
SET client_encoding = 'UTF8';
BEGIN;

CREATE TABLE IF NOT EXISTS placement_drives (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id    uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  company       text NOT NULL CHECK (length(company) BETWEEN 2 AND 100),
  role_title    text NOT NULL CHECK (length(role_title) BETWEEN 2 AND 100),
  drive_type    text NOT NULL CHECK (drive_type IN ('On-campus','Off-campus','Virtual','Pool campus')),
  drive_date    text NOT NULL CHECK (drive_date ~ '^\d{4}-\d{2}-\d{2}$'),
  drive_time    text NOT NULL DEFAULT '' CHECK (drive_time = '' OR drive_time ~ '^([01]\d|2[0-3]):[0-5]\d$'),
  venue         text NOT NULL DEFAULT '' CHECK (length(venue) <= 150),
  package_min   double precision NOT NULL DEFAULT 0 CHECK (package_min BETWEEN 0 AND 500),
  package_max   double precision NOT NULL DEFAULT 0 CHECK (package_max BETWEEN 0 AND 500 AND package_max >= package_min),
  openings      integer NOT NULL DEFAULT 0 CHECK (openings BETWEEN 0 AND 5000),
  departments   text[] NOT NULL DEFAULT '{}',
  min_readiness integer NOT NULL DEFAULT 0 CHECK (min_readiness BETWEEN 0 AND 100),
  deadline      text NOT NULL DEFAULT '' CHECK (deadline = '' OR deadline ~ '^\d{4}-\d{2}-\d{2}$'),
  description   text NOT NULL DEFAULT '' CHECK (length(description) <= 1500),
  rounds        text[] NOT NULL DEFAULT '{}',
  status        text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Open','Closed','Completed','Cancelled')),
  registered    integer NOT NULL DEFAULT 0 CHECK (registered >= 0),
  shortlisted   integer NOT NULL DEFAULT 0 CHECK (shortlisted >= 0 AND shortlisted <= registered),
  offers        integer NOT NULL DEFAULT 0 CHECK (offers >= 0 AND offers <= registered),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS placement_drives_college_date_idx ON placement_drives (college_id, drive_date);

ALTER TABLE placement_drives ENABLE ROW LEVEL SECURITY;
ALTER TABLE placement_drives FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY college_isolation ON placement_drives
    USING (app_scope_all() OR college_id = app_college())
    WITH CHECK (app_scope_all() OR college_id = app_college());
EXCEPTION WHEN duplicate_object THEN null;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON placement_drives TO ciq_app;

COMMIT;
