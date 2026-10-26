-- Teaching hospital: the college's own wards/departments, the dated census entries staff record for them, and the
-- hospital's facility figures (lab, blood bank). Occupancy, monthly surgeries/deliveries, trends and NMC norm status
-- are never stored: they are worked out from the census entries.
BEGIN;

CREATE TABLE IF NOT EXISTS hospital_departments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id        uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  name              text NOT NULL CHECK (length(name) BETWEEN 2 AND 120),
  category          text NOT NULL CHECK (category IN ('Medicine & Allied','Surgery & Allied','OBG & Paediatrics','Emergency & Critical Care')),
  hod               text NOT NULL DEFAULT '' CHECK (length(hod) <= 120),
  teaching_beds     integer NOT NULL CHECK (teaching_beds BETWEEN 0 AND 2000),
  icu_beds          integer NOT NULL DEFAULT 0 CHECK (icu_beds BETWEEN 0 AND 500),
  cbme_target_cases numeric NOT NULL DEFAULT 0 CHECK (cbme_target_cases >= 0),
  units             jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS hospital_departments_name_key ON hospital_departments (college_id, lower(name));

CREATE TABLE IF NOT EXISTS hospital_census (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id         uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  department_id      uuid NOT NULL REFERENCES hospital_departments(id) ON DELETE CASCADE,
  occupied_beds      integer NOT NULL CHECK (occupied_beds >= 0),
  icu_occupied       integer NOT NULL DEFAULT 0 CHECK (icu_occupied >= 0),
  opd                integer NOT NULL DEFAULT 0 CHECK (opd >= 0),
  ipd_admissions     integer NOT NULL DEFAULT 0 CHECK (ipd_admissions >= 0),
  discharges         integer NOT NULL DEFAULT 0 CHECK (discharges >= 0),
  surgeries          integer NOT NULL DEFAULT 0 CHECK (surgeries >= 0),
  deliveries         integer NOT NULL DEFAULT 0 CHECK (deliveries >= 0),
  cases_per_student  numeric CHECK (cases_per_student IS NULL OR cases_per_student >= 0),
  notes              text NOT NULL DEFAULT '' CHECK (length(notes) <= 500),
  actor              text NOT NULL DEFAULT '',
  actor_sub          text NOT NULL DEFAULT '',
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hospital_census_dept_idx ON hospital_census (department_id, created_at DESC);
CREATE INDEX IF NOT EXISTS hospital_census_college_idx ON hospital_census (college_id, created_at DESC);

CREATE TABLE IF NOT EXISTS hospital_profile (
  college_id           uuid PRIMARY KEY REFERENCES colleges(id) ON DELETE CASCADE,
  hospital_name        text NOT NULL DEFAULT '' CHECK (length(hospital_name) <= 160),
  lab_tests_daily      integer CHECK (lab_tests_daily IS NULL OR lab_tests_daily >= 0),
  blood_whole_units    integer CHECK (blood_whole_units IS NULL OR blood_whole_units >= 0),
  blood_component_units integer CHECK (blood_component_units IS NULL OR blood_component_units >= 0),
  blood_bank_licensed  boolean NOT NULL DEFAULT false,
  updated_at           timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['hospital_departments','hospital_census','hospital_profile'] LOOP
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
