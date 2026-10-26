-- Campus clubs: each college's own clubs and who has joined them. A club's member count is never stored: it is the
-- number of rows in club_members, so it always matches the people who actually joined.
BEGIN;

CREATE TABLE IF NOT EXISTS clubs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id       uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  name             text NOT NULL CHECK (length(name) BETWEEN 2 AND 100),
  category         text NOT NULL CHECK (category IN ('Technical','Cultural','Social','Innovation','Arts','Sports','Academic')),
  description      text NOT NULL DEFAULT '' CHECK (length(description) <= 1000),
  lead             text NOT NULL CHECK (length(lead) BETWEEN 2 AND 100),
  faculty_advisor  text NOT NULL DEFAULT '' CHECK (length(faculty_advisor) <= 100),
  meeting_schedule text NOT NULL CHECK (length(meeting_schedule) BETWEEN 2 AND 100),
  venue            text NOT NULL DEFAULT '' CHECK (length(venue) <= 100),
  status           text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Recruiting','Inactive')),
  created_by_sub   text NOT NULL DEFAULT '',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS clubs_name_key ON clubs (college_id, lower(name));

CREATE TABLE IF NOT EXISTS club_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id  uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  club_id     uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_sub    text NOT NULL CHECK (length(user_sub) BETWEEN 1 AND 120),
  member_name text NOT NULL DEFAULT '' CHECK (length(member_name) <= 160),
  joined_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS club_members_unique ON club_members (club_id, user_sub);
CREATE INDEX IF NOT EXISTS club_members_user_idx ON club_members (college_id, user_sub);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['clubs','club_members'] LOOP
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
