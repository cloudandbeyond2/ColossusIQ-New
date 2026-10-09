-- ----------------------------------------------------------------------------------------------------------------
--  0023 - AICTE compliance records
--  aicte_compliance: one row per college holding what the Principal records on the AICTE Compliance page: the
--                    AICTE permanent id, the status of each statutory committee (chairperson, members, last meeting,
--                    minutes) and the compliance action plan. The content is JSON validated by the application;
--                    everything else on the page (faculty-student ratio, cadre, labs ...) is computed live from the
--                    college's own staff, student and course records.
-- ----------------------------------------------------------------------------------------------------------------
SET client_encoding = 'UTF8';
BEGIN;

CREATE TABLE IF NOT EXISTS aicte_compliance (
  college_id  uuid PRIMARY KEY REFERENCES colleges(id) ON DELETE CASCADE,
  data        jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object' AND length(data::text) <= 120000),
  updated_by  text NOT NULL DEFAULT '' CHECK (length(updated_by) <= 120),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE aicte_compliance ENABLE ROW LEVEL SECURITY;
ALTER TABLE aicte_compliance FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY college_isolation ON aicte_compliance
    USING (app_scope_all() OR college_id = app_college())
    WITH CHECK (app_scope_all() OR college_id = app_college());
EXCEPTION WHEN duplicate_object THEN null;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON aicte_compliance TO ciq_app;

COMMIT;
