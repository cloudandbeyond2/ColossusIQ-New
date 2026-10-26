-- Incubation cell: pipeline ventures, the startup portfolio (with its funding-readiness evaluation) and the mentor network.
BEGIN;

CREATE TABLE IF NOT EXISTS incubation_ventures (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id     uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  name           text NOT NULL CHECK (length(name) BETWEEN 2 AND 120),
  tagline        text NOT NULL CHECK (length(tagline) BETWEEN 3 AND 300),
  domain         text NOT NULL CHECK (length(domain) BETWEEN 2 AND 60),
  cohort         text NOT NULL CHECK (length(cohort) BETWEEN 2 AND 80),
  stage          text NOT NULL CHECK (stage IN ('Idea','Validation','Business Model & MVP','Prototyping & Mentorship','Incubation Review','Incubated')),
  founders       text[] NOT NULL DEFAULT '{}',
  lead_founder   text NOT NULL CHECK (length(lead_founder) BETWEEN 2 AND 100),
  lead_email     text NOT NULL CHECK (length(lead_email) BETWEEN 3 AND 120),
  department     text NOT NULL CHECK (length(department) BETWEEN 2 AND 120),
  readiness_score integer NOT NULL DEFAULT 0 CHECK (readiness_score BETWEEN 0 AND 100),
  mentor_name    text NOT NULL DEFAULT 'Unassigned' CHECK (length(mentor_name) <= 120),
  grant_amount   text NOT NULL DEFAULT '—' CHECK (length(grant_amount) <= 120),
  pitch_deck_url text NOT NULL DEFAULT '' CHECK (length(pitch_deck_url) <= 300),
  demo_url       text NOT NULL DEFAULT '' CHECK (length(demo_url) <= 300),
  review_verdict text NOT NULL DEFAULT 'Pending Review' CHECK (length(review_verdict) <= 60),
  review_score   integer CHECK (review_score IS NULL OR review_score BETWEEN 0 AND 100),
  review_notes   text NOT NULL DEFAULT '' CHECK (length(review_notes) <= 1500),
  submitted_at   timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS incubation_ventures_college_idx ON incubation_ventures (college_id, cohort);

CREATE TABLE IF NOT EXISTS incubation_startups (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id           uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  name                 text NOT NULL CHECK (length(name) BETWEEN 2 AND 120),
  tagline              text NOT NULL CHECK (length(tagline) BETWEEN 3 AND 300),
  registration_number  text NOT NULL DEFAULT '' CHECK (length(registration_number) <= 80),
  domain               text NOT NULL CHECK (length(domain) BETWEEN 2 AND 60),
  incorporation_status text NOT NULL CHECK (incorporation_status IN ('Registered Private Limited','LLP','DPIIT Recognized','Student Pre-Incubation','Campus IP Spin-off')),
  stage                text NOT NULL CHECK (stage IN ('Ideation','Early Prototype','MVP Live','Commercial Pilot','Growth & Scaling')),
  founders             jsonb NOT NULL DEFAULT '[]'::jsonb,
  lead_founder         text NOT NULL CHECK (length(lead_founder) BETWEEN 2 AND 100),
  lead_email           text NOT NULL CHECK (length(lead_email) BETWEEN 3 AND 120),
  department           text NOT NULL CHECK (length(department) BETWEEN 2 AND 120),
  cohort               text NOT NULL CHECK (length(cohort) BETWEEN 2 AND 80),
  assigned_mentor      text NOT NULL DEFAULT 'Unassigned' CHECK (length(assigned_mentor) <= 120),
  readiness_score      integer NOT NULL DEFAULT 0 CHECK (readiness_score BETWEEN 0 AND 100),
  funding_raised       text NOT NULL DEFAULT 'Bootstrapped' CHECK (length(funding_raised) <= 160),
  revenue              text NOT NULL DEFAULT 'Pre-revenue' CHECK (length(revenue) <= 120),
  active_pilots        integer NOT NULL DEFAULT 0 CHECK (active_pilots BETWEEN 0 AND 100000),
  patent_status        text NOT NULL DEFAULT 'Not Applicable' CHECK (patent_status IN ('Not Applicable','In Drafting','Filed (Provisional)','Published','Granted')),
  website_url          text NOT NULL DEFAULT '' CHECK (length(website_url) <= 300),
  pitch_deck_url       text NOT NULL DEFAULT '' CHECK (length(pitch_deck_url) <= 300),
  demo_url             text NOT NULL DEFAULT '' CHECK (length(demo_url) <= 300),
  status               text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Graduated','On Hold')),
  evaluation           jsonb,
  incubated_at         timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS incubation_startups_name_key ON incubation_startups (college_id, lower(name));

CREATE TABLE IF NOT EXISTS incubation_mentors (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id   uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  name         text NOT NULL CHECK (length(name) BETWEEN 2 AND 100),
  designation  text NOT NULL CHECK (length(designation) BETWEEN 2 AND 150),
  company      text NOT NULL CHECK (length(company) BETWEEN 2 AND 120),
  type         text NOT NULL CHECK (type IN ('Industry Founder','Alumni Leader','Faculty Specialist','Investor / VC','Legal & IP Expert')),
  expertise    text[] NOT NULL DEFAULT '{}',
  email        text NOT NULL CHECK (length(email) BETWEEN 3 AND 120),
  phone        text NOT NULL DEFAULT '' CHECK (length(phone) <= 30),
  linkedin_url text NOT NULL DEFAULT '' CHECK (length(linkedin_url) <= 300),
  availability text NOT NULL DEFAULT 'Available' CHECK (availability IN ('Available','Busy','On Sabbatical')),
  status       text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Pending Invitation','Inactive')),
  joined_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS incubation_mentors_email_key ON incubation_mentors (college_id, lower(email));

CREATE TABLE IF NOT EXISTS incubation_mentor_assignments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  mentor_id  uuid NOT NULL REFERENCES incubation_mentors(id) ON DELETE CASCADE,
  venture_id uuid NOT NULL REFERENCES incubation_ventures(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mentor_id, venture_id)
);

CREATE TABLE IF NOT EXISTS incubation_mentor_sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id       uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  mentor_id        uuid NOT NULL REFERENCES incubation_mentors(id) ON DELETE CASCADE,
  venture_name     text NOT NULL CHECK (length(venture_name) BETWEEN 1 AND 120),
  topic            text NOT NULL CHECK (length(topic) BETWEEN 3 AND 200),
  notes            text NOT NULL CHECK (length(notes) BETWEEN 3 AND 2000),
  duration_minutes integer NOT NULL DEFAULT 60 CHECK (duration_minutes BETWEEN 1 AND 1440),
  logged_by_sub    text NOT NULL DEFAULT '',
  created_at       timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['incubation_ventures','incubation_startups','incubation_mentors','incubation_mentor_assignments','incubation_mentor_sessions'] LOOP
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
