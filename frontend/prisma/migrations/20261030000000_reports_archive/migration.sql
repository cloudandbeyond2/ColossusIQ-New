-- Reports archive and schedules. A report is a snapshot of the college's real numbers at the moment it was compiled
-- (kpis and breakdown are stored with it so it never changes later). A schedule compiles a new report each time it falls due.
BEGIN;

CREATE TABLE IF NOT EXISTS generated_reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id   uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  title        text NOT NULL CHECK (length(title) BETWEEN 2 AND 200),
  category     text NOT NULL CHECK (category IN ('Academic','Department','Placement','Compliance','Faculty','Institution')),
  scope        text NOT NULL CHECK (length(scope) BETWEEN 1 AND 120),
  period       text NOT NULL DEFAULT '' CHECK (length(period) <= 120),
  summary      text NOT NULL DEFAULT '',
  kpis         jsonb NOT NULL DEFAULT '[]'::jsonb,
  breakdown    jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_by text NOT NULL DEFAULT '',
  author_sub   text NOT NULL DEFAULT '',
  author_role  text NOT NULL DEFAULT '',
  schedule_id  uuid,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS generated_reports_college_idx ON generated_reports (college_id, created_at DESC);

CREATE TABLE IF NOT EXISTS report_schedules (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id     uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  name           text NOT NULL CHECK (length(name) BETWEEN 2 AND 200),
  category       text NOT NULL CHECK (category IN ('Academic','Department','Placement','Compliance','Faculty','Institution')),
  scope          text NOT NULL CHECK (length(scope) BETWEEN 1 AND 120),
  frequency      text NOT NULL CHECK (frequency IN ('Weekly','Bi-Weekly','Monthly','End of Term')),
  recipients     text NOT NULL DEFAULT '' CHECK (length(recipients) <= 500),
  enabled        boolean NOT NULL DEFAULT true,
  next_run       date NOT NULL,
  last_run_at    timestamptz,
  created_by_sub text NOT NULL DEFAULT '',
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS report_schedules_name_key ON report_schedules (college_id, lower(name));

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['generated_reports','report_schedules'] LOOP
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
