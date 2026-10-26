-- Placement employers: the recruiter relationships a college's placement office keeps (tier, contact, MoU, hiring outcomes).
BEGIN;

CREATE TABLE IF NOT EXISTS placement_employers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id          uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  company             text NOT NULL CHECK (length(company) BETWEEN 2 AND 100),
  sector              text NOT NULL CHECK (sector IN ('IT & Software','Product & Tech','BFSI & Fintech','Consulting & Services','Core Engineering','Healthcare & Biotech','Manufacturing & Automotive')),
  tier                text NOT NULL DEFAULT 'Active' CHECK (tier IN ('Tier-1 Partner','Preferred Recruiter','Active','Prospect','Inactive')),
  website             text NOT NULL DEFAULT '' CHECK (length(website) <= 200),
  location            text NOT NULL CHECK (length(location) BETWEEN 2 AND 100),
  contact_name        text NOT NULL CHECK (length(contact_name) BETWEEN 2 AND 100),
  contact_designation text NOT NULL CHECK (length(contact_designation) BETWEEN 2 AND 100),
  contact_email       text NOT NULL CHECK (length(contact_email) BETWEEN 3 AND 120),
  contact_phone       text NOT NULL DEFAULT '' CHECK (length(contact_phone) <= 25),
  contact_linkedin    text NOT NULL DEFAULT '' CHECK (length(contact_linkedin) <= 200),
  mou_status          text NOT NULL DEFAULT 'None' CHECK (mou_status IN ('Active MoU','Under Renewal','In Discussion','None')),
  mou_valid_until     text NOT NULL DEFAULT '' CHECK (mou_valid_until = '' OR mou_valid_until ~ '^\d{4}-\d{2}-\d{2}$'),
  total_hires         integer NOT NULL DEFAULT 0 CHECK (total_hires BETWEEN 0 AND 50000),
  average_package     double precision NOT NULL DEFAULT 0 CHECK (average_package BETWEEN 0 AND 500),
  highest_package     double precision NOT NULL DEFAULT 0 CHECK (highest_package BETWEEN 0 AND 500),
  last_drive_date     text NOT NULL DEFAULT '' CHECK (last_drive_date = '' OR last_drive_date ~ '^\d{4}-\d{2}-\d{2}$'),
  next_drive_date     text NOT NULL DEFAULT '' CHECK (next_drive_date = '' OR next_drive_date ~ '^\d{4}-\d{2}-\d{2}$'),
  notes               text NOT NULL DEFAULT '' CHECK (length(notes) <= 1500),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS placement_employers_company_key ON placement_employers (college_id, lower(company));

ALTER TABLE placement_employers ENABLE ROW LEVEL SECURITY;
ALTER TABLE placement_employers FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY college_isolation ON placement_employers
    USING (app_scope_all() OR college_id = app_college())
    WITH CHECK (app_scope_all() OR college_id = app_college());
EXCEPTION WHEN duplicate_object THEN null;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON placement_employers TO ciq_app;

COMMIT;
