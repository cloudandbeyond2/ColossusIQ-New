-- Campus sports: each college's own sports teams and who has registered for their trials. A squad's size is never
-- stored: it is the number of rows in sport_registrations, so it always matches the people who actually registered.
BEGIN;

CREATE TABLE IF NOT EXISTS sports (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id     uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  sport          text NOT NULL CHECK (length(sport) BETWEEN 2 AND 80),
  team           text NOT NULL CHECK (length(team) BETWEEN 2 AND 80),
  coach          text NOT NULL CHECK (length(coach) BETWEEN 2 AND 80),
  captain        text NOT NULL DEFAULT '' CHECK (length(captain) <= 80),
  event          text NOT NULL DEFAULT '' CHECK (length(event) <= 100),
  venue          text NOT NULL DEFAULT '' CHECK (length(venue) <= 100),
  status         text NOT NULL DEFAULT 'Trials open' CHECK (status IN ('Trials open','Active','Off-season')),
  created_by_sub text NOT NULL DEFAULT '',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sports_team_key ON sports (college_id, lower(sport), lower(team));

CREATE TABLE IF NOT EXISTS sport_registrations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id    uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  sport_id      uuid NOT NULL REFERENCES sports(id) ON DELETE CASCADE,
  user_sub      text NOT NULL CHECK (length(user_sub) BETWEEN 1 AND 120),
  member_name   text NOT NULL DEFAULT '' CHECK (length(member_name) <= 160),
  position      text NOT NULL DEFAULT '' CHECK (length(position) <= 120),
  experience    text NOT NULL DEFAULT '' CHECK (length(experience) <= 300),
  registered_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sport_registrations_unique ON sport_registrations (sport_id, user_sub);
CREATE INDEX IF NOT EXISTS sport_registrations_user_idx ON sport_registrations (college_id, user_sub);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sports','sport_registrations'] LOOP
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
