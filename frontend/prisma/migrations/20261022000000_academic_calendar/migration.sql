-- calendar_entries: the Academic Calendar. One row per assessment, holiday, exam-cell circular, event or milestone,
-- kept with its real category, audience and department so that nothing is flattened into a generic event type.
BEGIN;

CREATE TABLE IF NOT EXISTS calendar_entries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id      uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  title           text NOT NULL CHECK (length(title) BETWEEN 2 AND 120),
  date            text NOT NULL CHECK (date ~ '^\d{4}-\d{2}-\d{2}$'),
  end_date        text CHECK (end_date IS NULL OR end_date ~ '^\d{4}-\d{2}-\d{2}$'),
  time_label      text NOT NULL DEFAULT 'Full day' CHECK (length(time_label) <= 50),
  tag             text NOT NULL DEFAULT 'Event' CHECK (tag IN ('Assessment','Holiday','Exam cell','Event','Milestone')),
  department      text NOT NULL DEFAULT 'All Departments' CHECK (length(department) <= 80),
  venue           text NOT NULL DEFAULT '' CHECK (length(venue) <= 100),
  description     text NOT NULL DEFAULT '' CHECK (length(description) <= 500),
  audience        text NOT NULL DEFAULT 'All' CHECK (audience IN ('All','Students','Faculty','Staff')),
  source          text NOT NULL DEFAULT 'academic' CHECK (source IN ('academic','campus_event')),
  notify          boolean NOT NULL DEFAULT true,
  created_by_sub  text NOT NULL DEFAULT '' CHECK (length(created_by_sub) <= 120),
  created_by_name text NOT NULL DEFAULT '' CHECK (length(created_by_name) <= 120),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date IS NULL OR end_date >= date)
);
CREATE INDEX IF NOT EXISTS calendar_entries_college_date_idx ON calendar_entries (college_id, date);

ALTER TABLE calendar_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_entries FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY college_isolation ON calendar_entries
    USING (app_scope_all() OR college_id = app_college())
    WITH CHECK (app_scope_all() OR college_id = app_college());
EXCEPTION WHEN duplicate_object THEN null;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON calendar_entries TO ciq_app;

COMMIT;
