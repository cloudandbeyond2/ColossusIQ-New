-- Event Generator: saved event blueprints (agenda, budget, promotion, forms, volunteers), shared by the college's staff.
BEGIN;

CREATE TABLE IF NOT EXISTS event_plans (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id       uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  title            text NOT NULL CHECK (length(title) BETWEEN 2 AND 160),
  category         text NOT NULL CHECK (length(category) BETWEEN 2 AND 40),
  status           text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Published')),
  plan             jsonb NOT NULL,
  created_by_sub   text NOT NULL DEFAULT '',
  created_by_name  text NOT NULL DEFAULT '' CHECK (length(created_by_name) <= 120),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS event_plans_college_idx ON event_plans (college_id, updated_at DESC);

ALTER TABLE event_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_plans FORCE ROW LEVEL SECURITY;
DO $$
BEGIN
  CREATE POLICY college_isolation ON event_plans
    USING (app_scope_all() OR college_id = app_college())
    WITH CHECK (app_scope_all() OR college_id = app_college());
EXCEPTION WHEN duplicate_object THEN null;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON event_plans TO ciq_app;

COMMIT;
