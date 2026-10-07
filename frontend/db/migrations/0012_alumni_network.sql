-- ════════════════════════════════════════════════════════════════════════════════════════════
--  0012 — alumni network and mentorship
--  Tables for verified alumni mentors and student mentorship requests.
-- ════════════════════════════════════════════════════════════════════════════════════════════
SET client_encoding = 'UTF8';
BEGIN;

CREATE TABLE IF NOT EXISTS alumni_members (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id          uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  name                text NOT NULL CHECK (length(name) BETWEEN 2 AND 120),
  batch               text NOT NULL CHECK (length(batch) BETWEEN 2 AND 50),
  current_position    text NOT NULL CHECK (length(current_position) BETWEEN 2 AND 120),
  company             text NOT NULL CHECK (length(company) BETWEEN 2 AND 120),
  location            text NOT NULL DEFAULT '' CHECK (length(location) <= 120),
  degree              text NOT NULL DEFAULT 'B.E. Computer Science & Engineering' CHECK (length(degree) <= 150),
  department          text NOT NULL DEFAULT 'Computer Science & Engineering' CHECK (length(department) <= 120),
  mentorship_topics   text[] NOT NULL DEFAULT '{}',
  skills              text[] NOT NULL DEFAULT '{}',
  linkedin_url        text NOT NULL DEFAULT '' CHECK (length(linkedin_url) <= 300),
  email               text NOT NULL DEFAULT '' CHECK (length(email) <= 150),
  bio                 text NOT NULL DEFAULT '' CHECK (length(bio) <= 1500),
  is_available        boolean NOT NULL DEFAULT true,
  active_mentees      integer NOT NULL DEFAULT 0 CHECK (active_mentees >= 0),
  max_mentees         integer NOT NULL DEFAULT 5 CHECK (max_mentees >= 1),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS alumni_members_college_idx ON alumni_members (college_id);
CREATE INDEX IF NOT EXISTS alumni_members_college_avail_idx ON alumni_members (college_id, is_available);

ALTER TABLE alumni_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE alumni_members FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY college_isolation ON alumni_members
    USING (app_scope_all() OR college_id = app_college())
    WITH CHECK (app_scope_all() OR college_id = app_college());
EXCEPTION WHEN duplicate_object THEN null;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON alumni_members TO ciq_app;

CREATE TABLE IF NOT EXISTS alumni_mentorship_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id      uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  alumni_id       uuid NOT NULL REFERENCES alumni_members(id) ON DELETE CASCADE,
  student_id      text NOT NULL,
  student_name    text NOT NULL,
  student_roll_no text NOT NULL DEFAULT '',
  student_dept    text NOT NULL DEFAULT '',
  topic           text NOT NULL CHECK (length(topic) BETWEEN 2 AND 150),
  preferred_mode  text NOT NULL DEFAULT 'Virtual Call' CHECK (preferred_mode IN ('Virtual Call','Async Review','Email Q&A')),
  message         text NOT NULL DEFAULT '' CHECK (length(message) <= 1000),
  status          text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Accepted','Declined','Completed')),
  response_note   text NOT NULL DEFAULT '' CHECK (length(response_note) <= 1000),
  meeting_link    text NOT NULL DEFAULT '' CHECK (length(meeting_link) <= 500),
  scheduled_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS alumni_requests_college_idx ON alumni_mentorship_requests (college_id);
CREATE INDEX IF NOT EXISTS alumni_requests_alumni_idx ON alumni_mentorship_requests (alumni_id);
CREATE INDEX IF NOT EXISTS alumni_requests_student_idx ON alumni_mentorship_requests (student_id);

ALTER TABLE alumni_mentorship_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE alumni_mentorship_requests FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY college_isolation ON alumni_mentorship_requests
    USING (app_scope_all() OR college_id = app_college())
    WITH CHECK (app_scope_all() OR college_id = app_college());
EXCEPTION WHEN duplicate_object THEN null;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON alumni_mentorship_requests TO ciq_app;

COMMIT;
