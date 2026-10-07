-- ════════════════════════════════════════════════════════════════════════════════════════════
--  0016 — certificate authority
--  certificate_profiles: each college's certificate design, set by its Principal (header, address, accreditation,
--                        logo, college seal, Principal's signature, theme). The content is JSON validated by the app.
--  certificate_awards:   certificates the Principal issues (appreciation, merit, participation, excellence, internship,
--                        workshop), including requests raised by faculty and HODs that wait for the Principal.
--                        Issued awards get a public id (CIQ-YYYY-XXXXXXXX) and an HMAC signature, and can be revoked.
-- ════════════════════════════════════════════════════════════════════════════════════════════
SET client_encoding = 'UTF8';
BEGIN;

CREATE TABLE IF NOT EXISTS certificate_profiles (
  college_id  uuid PRIMARY KEY REFERENCES colleges(id) ON DELETE CASCADE,
  data        jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object' AND length(data::text) <= 20000),
  updated_by  text NOT NULL DEFAULT '' CHECK (length(updated_by) <= 120),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS certificate_awards (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id     uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  public_id      text UNIQUE CHECK (public_id IS NULL OR public_id ~ '^CIQ-\d{4}-[A-F0-9]{8}$'),
  recipient_sub  text CHECK (recipient_sub IS NULL OR length(recipient_sub) <= 80),
  status         text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Issued','Rejected','Revoked')),
  data           jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object' AND length(data::text) <= 8000),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (status NOT IN ('Issued','Revoked') OR public_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS certificate_awards_college_status_idx ON certificate_awards (college_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS certificate_awards_recipient_idx ON certificate_awards (recipient_sub);

ALTER TABLE certificate_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificate_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE certificate_awards ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificate_awards FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY college_isolation ON certificate_profiles
    USING (app_scope_all() OR college_id = app_college())
    WITH CHECK (app_scope_all() OR college_id = app_college());
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY college_isolation ON certificate_awards
    USING (app_scope_all() OR college_id = app_college())
    WITH CHECK (app_scope_all() OR college_id = app_college());
EXCEPTION WHEN duplicate_object THEN null;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON certificate_profiles TO ciq_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON certificate_awards TO ciq_app;

COMMIT;
