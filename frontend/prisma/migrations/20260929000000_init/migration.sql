-- ════════════════════════════════════════════════════════════════════════════════════════════
--  ColossusIQ — PostgreSQL schema  (migration 0001_init)
--  Target: PostgreSQL 15+   ·   Mirrors the app's rules in src/config/*.ts and src/lib/api/mock/*.ts
--
--  Conventions
--  • uuid primary keys; a human `public_id` keeps the ids the UI already uses (COL-1001, ADM-26-1001 …)
--  • every college-owned table has college_id + row-level security (see section 9)
--  • `version` gives optimistic locking (the API updates … WHERE version = $expected)
--  • stream rules (department / programme / term / designation / entrance max) enforced by trigger
-- ════════════════════════════════════════════════════════════════════════════════════════════

SET client_encoding = 'UTF8';   -- files contain non-ASCII text (en dashes, curly quotes)
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- ────────────────────────────────────────────────────────────────────────────────────────────
-- 1. Enums  (values match the labels the app shows, so no mapping layer is needed)
-- ────────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE app_role              AS ENUM ('student','faculty','hod','placement','incubation','institution','recruiter','admin');
CREATE TYPE college_plan          AS ENUM ('Campus Starter','Campus Pro','University Enterprise');
CREATE TYPE college_status        AS ENUM ('Active','Onboarding','Suspended');
CREATE TYPE module_group          AS ENUM ('Career','Communication & Skills','Project & Innovation','Campus Life','Placement','Incubation','Admissions','Recruiter');
CREATE TYPE user_status           AS ENUM ('Invited','Active','Suspended');
CREATE TYPE student_status        AS ENUM ('Active','Graduated','Discontinued');

CREATE TYPE gender                AS ENUM ('Female','Male','Non-binary','Prefer not to say');
CREATE TYPE home_state            AS ENUM ('Tamil Nadu','Kerala','Karnataka','Andhra Pradesh','Telangana','Puducherry','Maharashtra','Other');
CREATE TYPE school_board          AS ENUM ('State Board','CBSE','ICSE','Other');
CREATE TYPE admission_quota       AS ENUM ('Government','Management','NRI');
CREATE TYPE reservation_category  AS ENUM ('OC','BC','MBC','SC','ST','EWS');
CREATE TYPE admission_status      AS ENUM ('Enquiry','Applied','Documents verified','Shortlisted','Offer sent','Fee paid','Enrolled','Rejected','Withdrawn');
CREATE TYPE admission_document    AS ENUM ('10th mark sheet','12th mark sheet','Transfer certificate','Community certificate','Passport photo','Counselling allotment order');

CREATE TYPE staff_type            AS ENUM ('Teaching','Non-teaching','Administrative');
CREATE TYPE employment_type       AS ENUM ('Permanent','Contract','Guest','Visiting');
CREATE TYPE staff_status          AS ENUM ('Active','On leave','Resigned','Retired');

CREATE TYPE course_type           AS ENUM ('Theory','Lab','Theory + Lab','Elective','Project','Clinical posting','Practical / skills lab');
CREATE TYPE course_status         AS ENUM ('Draft','Active','Archived');
CREATE TYPE event_type            AS ENUM ('Seminar','Workshop','Hackathon','Cultural','Sports','Alumni','Social service');
CREATE TYPE event_status          AS ENUM ('Draft','Published','Completed','Cancelled');
CREATE TYPE rotation_phase        AS ENUM ('Phase II','Phase III Part 1','Phase III Part 2','Internship (CRMI)');
CREATE TYPE clinical_department   AS ENUM ('General Medicine','General Surgery','Obstetrics & Gynaecology','Paediatrics','Orthopaedics','Community Medicine','Emergency Medicine','Psychiatry','Dermatology','ENT','Ophthalmology');
CREATE TYPE rotation_status       AS ENUM ('Scheduled','Ongoing','Completed','Extended');
CREATE TYPE gallery_category      AS ENUM ('Campus','Academics','Labs & Library','Hospital & Clinical','Sports','Cultural','Events','Convocation');
CREATE TYPE publish_status        AS ENUM ('Draft','Published');
CREATE TYPE media_type            AS ENUM ('image/png','image/jpeg','image/webp');

CREATE TYPE course_level          AS ENUM ('Foundation (UG Year 1)','Intermediate (UG Year 2–3)','Advanced (UG final / PG)','Certificate / value-added');
CREATE TYPE course_source         AS ENUM ('title','syllabus');
CREATE TYPE lesson_layout         AS ENUM ('overview','concepts','example','practice','revision');
CREATE TYPE bloom_level           AS ENUM ('Remember','Understand','Apply','Analyse','Evaluate','Create');
CREATE TYPE video_kind            AS ENUM ('youtube','link');

CREATE TYPE quiz_purpose          AS ENUM ('department','placement_aptitude','course_final');
CREATE TYPE quiz_status           AS ENUM ('Draft','Published','Closed');
CREATE TYPE certificate_kind      AS ENUM ('course','quiz');
CREATE TYPE certificate_grade     AS ENUM ('O','A+','A','B','C');

CREATE TYPE faculty_event_kind    AS ENUM ('smartboard_session','outline_saved','summary_shared','infographic_shared','video_added','quiz_published','course_published');
CREATE TYPE evaluation_status     AS ENUM ('pending','approved','overridden');
CREATE TYPE interview_mode        AS ENUM ('technical','hr','behavioral');
CREATE TYPE ui_tone               AS ENUM ('brand','gold','teal','rose','amber','sky','neutral');

-- ────────────────────────────────────────────────────────────────────────────────────────────
-- 2. Shared helper functions
-- ────────────────────────────────────────────────────────────────────────────────────────────
CREATE FUNCTION hex_id(prefix text, bytes int DEFAULT 4) RETURNS text
LANGUAGE sql VOLATILE AS $$ SELECT prefix || upper(encode(gen_random_bytes(bytes), 'hex')) $$;

CREATE FUNCTION touch_row() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE FUNCTION bump_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.version := OLD.version + 1;
  RETURN NEW;
END $$;

CREATE FUNCTION forbid_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = 'insufficient_privilege';
END $$;

-- JSON array helper for CHECK constraints: an array with between lo and hi elements.
CREATE FUNCTION json_array_len_between(j jsonb, lo int, hi int) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$ SELECT jsonb_typeof(j) = 'array' AND jsonb_array_length(j) BETWEEN lo AND hi $$;

-- ────────────────────────────────────────────────────────────────────────────────────────────
-- 3. Tenancy and academic lookups  (src/config/tenancy.ts, src/config/streams.ts)
-- ────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE universities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{2,40}$'),
  name        text NOT NULL CHECK (length(name) BETWEEN 3 AND 160),
  short_name  text NOT NULL CHECK (length(short_name) BETWEEN 2 AND 20),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE streams (
  key             text PRIMARY KEY CHECK (key IN ('engineering','medical','artsScience','management','polytechnic')),
  label           text NOT NULL,
  regulator       text NOT NULL,
  term_label      text NOT NULL,
  entrance_label  text NOT NULL,
  entrance_max    int  NOT NULL CHECK (entrance_max BETWEEN 1 AND 1000)
);

CREATE TABLE college_types (
  name        text PRIMARY KEY,
  stream_key  text NOT NULL REFERENCES streams(key)
);

CREATE TABLE departments (
  id          serial PRIMARY KEY,
  stream_key  text NOT NULL REFERENCES streams(key),
  name        text NOT NULL CHECK (length(name) BETWEEN 2 AND 80),
  UNIQUE (stream_key, name)
);

CREATE TABLE programmes (
  id          serial PRIMARY KEY,
  stream_key  text NOT NULL REFERENCES streams(key),
  name        text NOT NULL CHECK (length(name) BETWEEN 2 AND 80),
  UNIQUE (stream_key, name)
);

CREATE TABLE terms (
  id          serial PRIMARY KEY,
  stream_key  text NOT NULL REFERENCES streams(key),
  name        text NOT NULL CHECK (length(name) BETWEEN 1 AND 30),
  position    smallint NOT NULL,
  UNIQUE (stream_key, name),
  UNIQUE (stream_key, position)
);

-- stream_key NULL = common designation available in every stream (Librarian, Accountant …)
CREATE TABLE designations (
  id          serial PRIMARY KEY,
  stream_key  text REFERENCES streams(key),
  name        text NOT NULL CHECK (length(name) BETWEEN 2 AND 60),
  UNIQUE NULLS NOT DISTINCT (stream_key, name)
);

CREATE SEQUENCE seq_college_public START 1001;
CREATE TABLE colleges (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id         text NOT NULL UNIQUE DEFAULT ('COL-' || nextval('seq_college_public')) CHECK (public_id ~ '^COL-\d{4}$'),
  university_id     uuid NOT NULL REFERENCES universities(id),
  name              text NOT NULL CHECK (length(name) BETWEEN 3 AND 100),
  code              char(4) NOT NULL CHECK (code ~ '^[0-9]{4}$'),
  type              text NOT NULL REFERENCES college_types(name),
  city              text NOT NULL CHECK (length(city) BETWEEN 2 AND 60),
  established       smallint CHECK (established BETWEEN 1850 AND 2030),
  student_capacity  int NOT NULL CHECK (student_capacity BETWEEN 60 AND 50000),
  principal         text NOT NULL CHECK (length(principal) BETWEEN 2 AND 80),
  email             citext NOT NULL CHECK (length(email) <= 120 AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone             text NOT NULL CHECK (phone ~ '^[6-9][0-9]{9}$'),
  plan              college_plan NOT NULL DEFAULT 'Campus Pro',
  status            college_status NOT NULL DEFAULT 'Onboarding',
  admissions_open   boolean NOT NULL DEFAULT true,
  version           int NOT NULL DEFAULT 1,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (university_id, code),
  UNIQUE (university_id, name)
);

-- Module areas switched on for a college (replaces the `modules` checklist). Groups not listed
-- in module_group (Academics, Assessment …) are always on.
CREATE TABLE college_modules (
  college_id  uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  module      module_group NOT NULL,
  PRIMARY KEY (college_id, module)
);

-- The stream a college follows (via its type).
CREATE FUNCTION college_stream(p_college uuid) RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT ct.stream_key FROM colleges c JOIN college_types ct ON ct.name = c.type WHERE c.id = p_college
$$;

-- ────────────────────────────────────────────────────────────────────────────────────────────
-- 4. Identity and access
-- ────────────────────────────────────────────────────────────────────────────────────────────
CREATE SEQUENCE seq_user_public START 1001;
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id     text NOT NULL UNIQUE DEFAULT ('USR-' || nextval('seq_user_public')),
  university_id uuid NOT NULL REFERENCES universities(id),
  email         citext NOT NULL UNIQUE CHECK (length(email) <= 120 AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  full_name     text NOT NULL CHECK (length(full_name) BETWEEN 2 AND 80),
  status        user_status NOT NULL DEFAULT 'Invited',
  mfa_required  boolean NOT NULL DEFAULT true,
  sso_only      boolean NOT NULL DEFAULT false,
  notes         text CHECK (length(notes) <= 500),
  last_login_at timestamptz,
  version       int NOT NULL DEFAULT 1,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- A user may hold several roles. College roles are bound to one college; the University Super
-- Admin and external recruiters are university-wide (college_id NULL).
CREATE TABLE role_assignments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role           app_role NOT NULL,
  college_id     uuid REFERENCES colleges(id) ON DELETE CASCADE,
  department_id  int REFERENCES departments(id),
  granted_by     uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CHECK ((role IN ('admin','recruiter')) = (college_id IS NULL)),
  UNIQUE NULLS NOT DISTINCT (user_id, role, college_id)
);
CREATE INDEX ON role_assignments (college_id, role);

CREATE TABLE user_credentials (
  user_id             uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_hash       text NOT NULL CHECK (password_hash LIKE '$argon2id$%'),
  password_changed_at timestamptz NOT NULL DEFAULT now(),
  failed_attempts     smallint NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  locked_until        timestamptz
);

CREATE TABLE user_mfa (
  user_id               uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  totp_secret_encrypted bytea NOT NULL,           -- encrypted by the app (envelope key), never plain
  recovery_code_hashes  text[] NOT NULL DEFAULT '{}',
  enabled_at            timestamptz NOT NULL DEFAULT now()
);

-- Sessions are stateless signed cookies; this table only supports revocation ("sign out everywhere").
CREATE TABLE user_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        app_role NOT NULL,
  college_id  uuid REFERENCES colleges(id) ON DELETE CASCADE,
  mfa_passed  boolean NOT NULL DEFAULT false,
  ip          inet,
  user_agent  text CHECK (length(user_agent) <= 400),
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz,
  CHECK (expires_at > created_at)
);
CREATE INDEX ON user_sessions (user_id) WHERE revoked_at IS NULL;

-- ────────────────────────────────────────────────────────────────────────────────────────────
-- 5. Media (uploads are signature-checked by the app before insert)
-- ────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE media_assets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id     text NOT NULL UNIQUE DEFAULT ('MED-' || encode(gen_random_bytes(12), 'hex')) CHECK (public_id ~ '^MED-[a-f0-9]{24}$'),
  college_id    uuid REFERENCES colleges(id) ON DELETE CASCADE,
  content_type  media_type NOT NULL,
  byte_size     int NOT NULL CHECK (byte_size BETWEEN 1 AND 2097152),
  sha256        bytea NOT NULL CHECK (length(sha256) = 32),
  storage_key   text CHECK (length(storage_key) <= 300),   -- object-storage key (recommended)
  data          bytea,                                       -- or inline bytes for small deployments
  uploaded_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (storage_key IS NOT NULL OR data IS NOT NULL)
);
CREATE INDEX ON media_assets (college_id, created_at DESC);

-- An image is either an uploaded asset or one of the bundled illustrations in public/campus/.
-- Tables that hold an image use the pair (x_media_id, x_builtin) with this rule:
--   exactly one is set, and x_builtin matches ^/campus/[a-z0-9-]{1,40}\.svg$
CREATE FUNCTION valid_builtin_image(p text) RETURNS boolean LANGUAGE sql IMMUTABLE AS
$$ SELECT p ~ '^/campus/[a-z0-9-]{1,40}\.svg$' $$;

-- ────────────────────────────────────────────────────────────────────────────────────────────
-- 6. Admissions, students and staff
-- ────────────────────────────────────────────────────────────────────────────────────────────
CREATE SEQUENCE seq_admission_public START 1001;
CREATE TABLE admissions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id           text NOT NULL UNIQUE DEFAULT ('ADM-' || to_char(now(), 'YY') || '-' || nextval('seq_admission_public')),
  college_id          uuid NOT NULL REFERENCES colleges(id) ON DELETE RESTRICT,
  full_name           text NOT NULL CHECK (length(full_name) BETWEEN 2 AND 80),
  dob                 date NOT NULL CHECK (dob BETWEEN '1990-01-01' AND '2011-12-31'),
  gender              gender NOT NULL,
  email               citext NOT NULL CHECK (length(email) <= 120 AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone               text NOT NULL CHECK (phone ~ '^[6-9][0-9]{9}$'),
  city                text CHECK (length(city) <= 60),
  state               home_state NOT NULL DEFAULT 'Tamil Nadu',
  board               school_board NOT NULL,
  hsc_percent         numeric(5,2) NOT NULL CHECK (hsc_percent BETWEEN 35 AND 100),
  entrance_score      numeric(6,2) CHECK (entrance_score BETWEEN 0 AND 720),   -- per-stream max by trigger
  programme_id        int NOT NULL REFERENCES programmes(id),
  quota               admission_quota NOT NULL,
  category            reservation_category NOT NULL,
  scholarship         boolean NOT NULL DEFAULT false,
  hostel              boolean NOT NULL DEFAULT false,
  guardian_name       text NOT NULL CHECK (length(guardian_name) BETWEEN 2 AND 80),
  guardian_phone      text NOT NULL CHECK (guardian_phone ~ '^[6-9][0-9]{9}$'),
  guardian_occupation text CHECK (length(guardian_occupation) <= 60),
  status              admission_status NOT NULL DEFAULT 'Enquiry',
  source              text NOT NULL DEFAULT 'office' CHECK (source IN ('office','online')),
  notes               text CHECK (length(notes) <= 1000),
  version             int NOT NULL DEFAULT 1,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON admissions (college_id, status);
CREATE INDEX ON admissions (college_id, created_at DESC);

CREATE TABLE admission_documents (
  admission_id  uuid NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
  document      admission_document NOT NULL,
  verified_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (admission_id, document)
);

CREATE TABLE admission_status_history (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admission_id  uuid NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
  from_status   admission_status,
  to_status     admission_status NOT NULL,
  changed_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  changed_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON admission_status_history (admission_id, changed_at);

-- A student profile: links an account to a college, an enrolment and a programme.
CREATE TABLE students (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  college_id     uuid NOT NULL REFERENCES colleges(id) ON DELETE RESTRICT,
  admission_id   uuid UNIQUE REFERENCES admissions(id) ON DELETE SET NULL,
  roll_no        text NOT NULL CHECK (roll_no ~ '^[A-Z0-9]{4,16}$'),
  department_id  int NOT NULL REFERENCES departments(id),
  programme_id   int NOT NULL REFERENCES programmes(id),
  term_id        int REFERENCES terms(id),
  batch_year     smallint NOT NULL CHECK (batch_year BETWEEN 2000 AND 2100),
  status         student_status NOT NULL DEFAULT 'Active',
  version        int NOT NULL DEFAULT 1,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (college_id, roll_no)
);
CREATE INDEX ON students (college_id, department_id);

CREATE SEQUENCE seq_staff_public START 1001;
CREATE TABLE staff (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id        text NOT NULL UNIQUE DEFAULT ('EMP-' || nextval('seq_staff_public')),
  college_id       uuid NOT NULL REFERENCES colleges(id) ON DELETE RESTRICT,
  user_id          uuid UNIQUE REFERENCES users(id) ON DELETE SET NULL,     -- set when platformAccess is on
  full_name        text NOT NULL CHECK (length(full_name) BETWEEN 2 AND 80),
  email            citext NOT NULL UNIQUE CHECK (length(email) <= 120 AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone            text NOT NULL CHECK (phone ~ '^[6-9][0-9]{9}$'),
  qualification    text CHECK (length(qualification) <= 80),
  department_id    int NOT NULL REFERENCES departments(id),
  designation_id   int NOT NULL REFERENCES designations(id),
  staff_type       staff_type NOT NULL,
  employment       employment_type NOT NULL,
  joining_date     date NOT NULL CHECK (joining_date BETWEEN '1970-01-01' AND '2030-12-31'),
  experience_years smallint CHECK (experience_years BETWEEN 0 AND 50),
  status           staff_status NOT NULL DEFAULT 'Active',
  platform_access  boolean NOT NULL DEFAULT true,
  notes            text CHECK (length(notes) <= 1000),
  version          int NOT NULL DEFAULT 1,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON staff (college_id, department_id);

-- ────────────────────────────────────────────────────────────────────────────────────────────
-- 7. Academics and campus
-- ────────────────────────────────────────────────────────────────────────────────────────────
CREATE SEQUENCE seq_course_public START 1001;
CREATE TABLE courses (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id         text NOT NULL UNIQUE DEFAULT ('CRS-' || nextval('seq_course_public')),
  college_id        uuid NOT NULL REFERENCES colleges(id) ON DELETE RESTRICT,
  code              text NOT NULL CHECK (code ~ '^[A-Z]{2,4}[0-9]{3,4}$'),
  title             text NOT NULL CHECK (length(title) BETWEEN 2 AND 100),
  department_id     int NOT NULL REFERENCES departments(id),
  term_id           int NOT NULL REFERENCES terms(id),
  credits           smallint NOT NULL CHECK (credits BETWEEN 1 AND 6),
  course_type       course_type NOT NULL,
  faculty_staff_id  uuid REFERENCES staff(id) ON DELETE SET NULL,
  faculty_name      text NOT NULL CHECK (length(faculty_name) BETWEEN 2 AND 80),
  status            course_status NOT NULL DEFAULT 'Draft',
  description       text CHECK (length(description) <= 1500),
  version           int NOT NULL DEFAULT 1,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (college_id, code)
);

CREATE SEQUENCE seq_event_public START 1001;
CREATE TABLE events (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id          text NOT NULL UNIQUE DEFAULT ('EVT-' || nextval('seq_event_public')),
  college_id         uuid NOT NULL REFERENCES colleges(id) ON DELETE RESTRICT,
  title              text NOT NULL CHECK (length(title) BETWEEN 2 AND 100),
  type               event_type NOT NULL,
  event_date         date NOT NULL CHECK (event_date BETWEEN '2024-01-01' AND '2030-12-31'),
  start_time         time NOT NULL,
  venue              text NOT NULL CHECK (length(venue) BETWEEN 2 AND 80),
  organiser          text NOT NULL CHECK (length(organiser) BETWEEN 2 AND 80),
  capacity           int NOT NULL CHECK (capacity BETWEEN 1 AND 20000),
  registration_open  boolean NOT NULL DEFAULT true,
  status             event_status NOT NULL DEFAULT 'Draft',
  description        text CHECK (length(description) <= 1500),
  version            int NOT NULL DEFAULT 1,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON events (college_id, event_date);

CREATE TABLE event_registrations (
  event_id       uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  student_id     uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  registered_at  timestamptz NOT NULL DEFAULT now(),
  attended       boolean,
  PRIMARY KEY (event_id, student_id)
);

CREATE SEQUENCE seq_rotation_public START 1001;
CREATE TABLE clinical_rotations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id             text NOT NULL UNIQUE DEFAULT ('ROT-' || nextval('seq_rotation_public')),
  college_id            uuid NOT NULL REFERENCES colleges(id) ON DELETE RESTRICT,
  student_id            uuid REFERENCES students(id) ON DELETE SET NULL,
  student_name          text NOT NULL CHECK (length(student_name) BETWEEN 2 AND 80),
  reg_no                text NOT NULL CHECK (reg_no ~ '^[A-Z0-9]{6,12}$'),
  phase                 rotation_phase NOT NULL,
  department            clinical_department NOT NULL,
  unit                  text NOT NULL CHECK (length(unit) BETWEEN 1 AND 60),
  start_date            date NOT NULL CHECK (start_date BETWEEN '2024-01-01' AND '2030-12-31'),
  end_date              date NOT NULL CHECK (end_date BETWEEN '2024-01-01' AND '2030-12-31'),
  supervisor_staff_id   uuid REFERENCES staff(id) ON DELETE SET NULL,
  supervisor_name       text NOT NULL CHECK (length(supervisor_name) BETWEEN 2 AND 80),
  attendance            smallint CHECK (attendance BETWEEN 0 AND 100),
  competencies_signed   smallint CHECK (competencies_signed BETWEEN 0 AND 200),
  status                rotation_status NOT NULL DEFAULT 'Scheduled',
  remarks               text CHECK (length(remarks) <= 800),
  version               int NOT NULL DEFAULT 1,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);
CREATE INDEX ON clinical_rotations (college_id, start_date);

CREATE SEQUENCE seq_gallery_public START 1001;
CREATE TABLE gallery_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id       text NOT NULL UNIQUE DEFAULT ('GAL-' || nextval('seq_gallery_public')),
  college_id      uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  image_media_id  uuid REFERENCES media_assets(id) ON DELETE RESTRICT,
  image_builtin   text,
  title           text NOT NULL CHECK (length(title) BETWEEN 2 AND 80),
  category        gallery_category NOT NULL,
  caption         text CHECK (length(caption) <= 300),
  featured        boolean NOT NULL DEFAULT false,
  status          publish_status NOT NULL DEFAULT 'Draft',
  version         int NOT NULL DEFAULT 1,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CHECK ((image_media_id IS NULL) <> (image_builtin IS NULL)),
  CHECK (image_builtin IS NULL OR valid_builtin_image(image_builtin))
);
CREATE INDEX ON gallery_items (college_id, status);

CREATE TABLE college_websites (
  college_id          uuid PRIMARY KEY REFERENCES colleges(id) ON DELETE CASCADE,
  tagline             text NOT NULL CHECK (length(tagline) BETWEEN 2 AND 120),
  hero_media_id       uuid REFERENCES media_assets(id) ON DELETE RESTRICT,
  hero_builtin        text,
  announcement        text CHECK (length(announcement) <= 140),
  about               text NOT NULL CHECK (length(about) BETWEEN 10 AND 1500),
  principal_message   text CHECK (length(principal_message) <= 1000),
  highlights          text CHECK (length(highlights) <= 600),      -- one per line, first 8 shown
  address             text NOT NULL CHECK (length(address) BETWEEN 5 AND 300),
  phone               text NOT NULL CHECK (phone ~ '^[6-9][0-9]{9}$'),
  email               citext NOT NULL CHECK (length(email) <= 120 AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  office_hours        text CHECK (length(office_hours) <= 80),
  show_events         boolean NOT NULL DEFAULT true,
  show_gallery        boolean NOT NULL DEFAULT true,
  version             int NOT NULL DEFAULT 1,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CHECK ((hero_media_id IS NULL) <> (hero_builtin IS NULL)),
  CHECK (hero_builtin IS NULL OR valid_builtin_image(hero_builtin))
);

-- ────────────────────────────────────────────────────────────────────────────────────────────
-- 8. Learning: AI Course Studio courses, lessons, progress; quizzes and certificates
-- ────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE learning_courses (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id         text NOT NULL UNIQUE DEFAULT hex_id('LC-') CHECK (public_id ~ '^LC-[A-F0-9]{8}$'),
  college_id        uuid NOT NULL REFERENCES colleges(id) ON DELETE RESTRICT,
  department_id     int NOT NULL REFERENCES departments(id),
  term_id           int NOT NULL REFERENCES terms(id),
  code              text NOT NULL CHECK (code ~ '^[A-Z]{2,4}[0-9]{3,4}$'),
  title             text NOT NULL CHECK (length(title) BETWEEN 3 AND 100),
  level             course_level NOT NULL,
  credits           smallint NOT NULL CHECK (credits BETWEEN 1 AND 6),
  faculty_name      text NOT NULL CHECK (length(faculty_name) BETWEEN 2 AND 80),
  source            course_source NOT NULL,
  syllabus          text NOT NULL DEFAULT '' CHECK (length(syllabus) <= 6000),
  summary           text NOT NULL CHECK (length(summary) BETWEEN 10 AND 600),
  status            publish_status NOT NULL DEFAULT 'Draft',
  course_record_id  uuid UNIQUE REFERENCES courses(id) ON DELETE SET NULL,  -- listed in Course Management on publish
  created_by        uuid REFERENCES users(id) ON DELETE SET NULL,
  created_by_name   text NOT NULL,
  published_at      timestamptz,
  version           int NOT NULL DEFAULT 1,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (college_id, code),
  CHECK ((status = 'Published') = (published_at IS NOT NULL))
);
CREATE INDEX ON learning_courses (college_id, status);

CREATE TABLE course_outcomes (
  course_id  uuid NOT NULL REFERENCES learning_courses(id) ON DELETE CASCADE,
  code       text NOT NULL CHECK (code ~ '^CO[1-9]$'),
  bloom      bloom_level NOT NULL,
  text       text NOT NULL CHECK (length(text) BETWEEN 5 AND 400),
  PRIMARY KEY (course_id, code)
);

-- Chapters. Position 0 is "Getting started", the last is "Course revision" (lessons with those layouts).
CREATE TABLE course_units (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id  uuid NOT NULL REFERENCES learning_courses(id) ON DELETE CASCADE,
  position   smallint NOT NULL CHECK (position BETWEEN 0 AND 23),
  title      text NOT NULL CHECK (length(title) BETWEEN 2 AND 100),
  part       text CHECK (length(part) <= 100),
  UNIQUE (course_id, position) DEFERRABLE INITIALLY IMMEDIATE
);

CREATE TABLE lessons (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id     uuid NOT NULL REFERENCES course_units(id) ON DELETE CASCADE,
  course_id   uuid NOT NULL REFERENCES learning_courses(id) ON DELETE CASCADE,
  code        text NOT NULL CHECK (code ~ '^L\d{1,3}$'),            -- reading order: L1, L2 …
  position    smallint NOT NULL CHECK (position BETWEEN 0 AND 14),  -- within the chapter
  title       text NOT NULL CHECK (length(title) BETWEEN 2 AND 120),
  minutes     smallint NOT NULL CHECK (minutes BETWEEN 5 AND 180),
  layout      lesson_layout NOT NULL DEFAULT 'concepts',
  body        text NOT NULL CHECK (length(body) BETWEEN 20 AND 8000),
  objectives  jsonb NOT NULL DEFAULT '[]' CHECK (json_array_len_between(objectives, 0, 6)),
  key_points  jsonb NOT NULL CHECK (json_array_len_between(key_points, 1, 6)),
  terms       jsonb NOT NULL DEFAULT '[]' CHECK (json_array_len_between(terms, 0, 8)),      -- [{term, meaning}]
  practice    jsonb NOT NULL DEFAULT '[]' CHECK (json_array_len_between(practice, 0, 6)),   -- [{q, a}]
  links       jsonb NOT NULL DEFAULT '[]' CHECK (json_array_len_between(links, 0, 6)),      -- [{label, url}]
  UNIQUE (course_id, code) DEFERRABLE INITIALLY IMMEDIATE,
  UNIQUE (unit_id, position) DEFERRABLE INITIALLY IMMEDIATE
);
CREATE INDEX ON lessons (course_id);

CREATE TABLE lesson_videos (
  lesson_id   uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  position    smallint NOT NULL CHECK (position BETWEEN 0 AND 5),   -- at most 6 per lesson
  title       text NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  url         text NOT NULL CHECK (url ~ '^https://' AND length(url) <= 300),
  kind        video_kind NOT NULL,
  youtube_id  text CHECK (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  PRIMARY KEY (lesson_id, position),
  CHECK ((kind = 'youtube') = (youtube_id IS NOT NULL))
);

CREATE TABLE lesson_images (
  lesson_id       uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  position        smallint NOT NULL CHECK (position BETWEEN 0 AND 5),
  image_media_id  uuid REFERENCES media_assets(id) ON DELETE RESTRICT,
  image_builtin   text,
  caption         text NOT NULL DEFAULT '' CHECK (length(caption) <= 160),
  PRIMARY KEY (lesson_id, position),
  CHECK ((image_media_id IS NULL) <> (image_builtin IS NULL)),
  CHECK (image_builtin IS NULL OR valid_builtin_image(image_builtin))
);

CREATE TABLE lesson_progress (
  student_id    uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  lesson_id     uuid NOT NULL REFERENCES lessons(id) ON DELETE RESTRICT,   -- keep history: courses with learners are not deleted
  completed_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, lesson_id)
);
CREATE INDEX ON lesson_progress (lesson_id);

CREATE TABLE quizzes (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id            text NOT NULL UNIQUE DEFAULT hex_id('QZ-') CHECK (public_id ~ '^QZ-[A-F0-9]{8}$'),
  college_id           uuid NOT NULL REFERENCES colleges(id) ON DELETE RESTRICT,
  purpose              quiz_purpose NOT NULL DEFAULT 'department',
  learning_course_id   uuid UNIQUE REFERENCES learning_courses(id) ON DELETE CASCADE,  -- the course's final assessment
  department_id        int REFERENCES departments(id),
  title                text NOT NULL CHECK (length(title) BETWEEN 3 AND 140),
  subject              text NOT NULL CHECK (length(subject) BETWEEN 2 AND 120),
  pass_mark            smallint NOT NULL CHECK (pass_mark BETWEEN 30 AND 90),
  duration_min         smallint NOT NULL CHECK (duration_min BETWEEN 5 AND 180),
  certificate_enabled  boolean NOT NULL DEFAULT true,
  status               quiz_status NOT NULL DEFAULT 'Draft',
  created_by           uuid REFERENCES users(id) ON DELETE SET NULL,
  created_by_name      text NOT NULL,
  version              int NOT NULL DEFAULT 1,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CHECK ((purpose = 'course_final') = (learning_course_id IS NOT NULL)),
  CHECK (purpose <> 'department' OR department_id IS NOT NULL)
);
CREATE INDEX ON quizzes (college_id, status);

CREATE TABLE quiz_questions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id       uuid NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  position      smallint NOT NULL CHECK (position BETWEEN 0 AND 49),
  prompt        text NOT NULL CHECK (length(prompt) BETWEEN 5 AND 400),
  options       text[] NOT NULL CHECK (cardinality(options) = 4 AND array_position(options, '') IS NULL AND array_position(options, NULL) IS NULL),
  answer        smallint NOT NULL CHECK (answer BETWEEN 0 AND 3),
  explanation   text NOT NULL DEFAULT '' CHECK (length(explanation) <= 400),
  needs_review  boolean NOT NULL DEFAULT false,
  UNIQUE (quiz_id, position) DEFERRABLE INITIALLY IMMEDIATE
);

CREATE TABLE quiz_attempts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id       uuid NOT NULL REFERENCES quizzes(id) ON DELETE RESTRICT,   -- a quiz with attempts cannot be deleted
  student_id    uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  college_id    uuid NOT NULL REFERENCES colleges(id) ON DELETE RESTRICT,
  attempt_no    smallint NOT NULL DEFAULT 1 CHECK (attempt_no BETWEEN 1 AND 3),   -- set by limit_quiz_attempts()
  started_at    timestamptz NOT NULL DEFAULT now(),
  submitted_at  timestamptz,
  score         smallint CHECK (score >= 0),
  total         smallint CHECK (total > 0),
  percentage    numeric(5,2) CHECK (percentage BETWEEN 0 AND 100),
  CHECK (submitted_at IS NULL OR (score IS NOT NULL AND total IS NOT NULL AND percentage IS NOT NULL AND score <= total)),
  UNIQUE (quiz_id, student_id, attempt_no)   -- makes the 3-attempt limit race-proof
);
CREATE INDEX ON quiz_attempts (student_id, quiz_id);
CREATE INDEX ON quiz_attempts (quiz_id);

CREATE TABLE quiz_attempt_answers (
  attempt_id   uuid NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  question_id  uuid NOT NULL REFERENCES quiz_questions(id) ON DELETE RESTRICT,
  chosen       smallint CHECK (chosen BETWEEN 0 AND 3),     -- NULL = not answered
  correct      boolean NOT NULL,
  PRIMARY KEY (attempt_id, question_id)
);

CREATE TABLE certificates (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id        text NOT NULL UNIQUE DEFAULT ('CIQ-' || to_char(now(), 'YYYY') || '-' || upper(encode(gen_random_bytes(4), 'hex'))) CHECK (public_id ~ '^CIQ-\d{4}-[A-F0-9]{8}$'),
  kind             certificate_kind NOT NULL,
  quiz_id          uuid NOT NULL REFERENCES quizzes(id) ON DELETE RESTRICT,
  attempt_id       uuid NOT NULL UNIQUE REFERENCES quiz_attempts(id) ON DELETE RESTRICT,
  student_id       uuid NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  college_id       uuid NOT NULL REFERENCES colleges(id) ON DELETE RESTRICT,
  -- snapshot printed on the certificate (and covered by the signature)
  student_name     text NOT NULL,
  title            text NOT NULL,
  course           text NOT NULL,
  department_name  text NOT NULL,
  marks            smallint NOT NULL CHECK (marks >= 0),
  total            smallint NOT NULL CHECK (total > 0 AND marks <= total),
  percentage       numeric(5,2) NOT NULL CHECK (percentage BETWEEN 0 AND 100),
  grade            certificate_grade NOT NULL,
  grade_label      text NOT NULL,
  issued_at        timestamptz NOT NULL DEFAULT now(),
  signature        text NOT NULL CHECK (signature ~ '^[A-Za-z0-9_-]{43}$'),   -- base64url HMAC-SHA256
  superseded_at    timestamptz,
  superseded_by_id uuid REFERENCES certificates(id) DEFERRABLE INITIALLY DEFERRED,   -- re-issue: old row points at the new one before it is inserted
  CHECK ((superseded_at IS NULL) = (superseded_by_id IS NULL))
);
-- One valid certificate per student per quiz; a higher mark supersedes it (history is kept).
CREATE UNIQUE INDEX certificates_one_active ON certificates (quiz_id, student_id) WHERE superseded_at IS NULL;
CREATE INDEX ON certificates (college_id, issued_at DESC);

-- ────────────────────────────────────────────────────────────────────────────────────────────
-- 9. Teaching tools: outlines, class summaries, skill booster, activity log
-- ────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE lesson_outlines (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id    text NOT NULL UNIQUE DEFAULT hex_id('LO-') CHECK (public_id ~ '^LO-[A-F0-9]{8}$'),
  college_id   uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  author_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic        text NOT NULL CHECK (length(topic) BETWEEN 2 AND 120),
  course_title text CHECK (length(course_title) <= 120),
  minutes      smallint NOT NULL CHECK (minutes BETWEEN 30 AND 180),
  blocks       jsonb NOT NULL CHECK (json_array_len_between(blocks, 1, 12)),   -- [{start, minutes, title, teacher, students, icon}]
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON lesson_outlines (author_id, created_at DESC);

CREATE TABLE class_summaries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id     text NOT NULL UNIQUE DEFAULT hex_id('CS-') CHECK (public_id ~ '^CS-[A-F0-9]{8}$'),
  college_id    uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  author_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  author_name   text NOT NULL,
  department_id int NOT NULL REFERENCES departments(id),
  course_title  text CHECK (length(course_title) <= 120),
  topic         text NOT NULL CHECK (length(topic) BETWEEN 2 AND 120),
  title         text NOT NULL CHECK (length(title) BETWEEN 3 AND 140),
  class_date    date NOT NULL,
  points        jsonb NOT NULL CHECK (json_array_len_between(points, 1, 10)),
  homework      text NOT NULL DEFAULT '' CHECK (length(homework) <= 600),
  next_class    text NOT NULL DEFAULT '' CHECK (length(next_class) <= 200),
  resources     jsonb NOT NULL DEFAULT '[]' CHECK (json_array_len_between(resources, 0, 8)),  -- [{label, url}]
  infographic   jsonb CHECK (infographic IS NULL OR jsonb_typeof(infographic) = 'object'),  -- {what, keyPoints, terms, mistakes, illustration, question}
  shared_at     timestamptz NOT NULL DEFAULT now(),
  withdrawn_at  timestamptz
);
CREATE INDEX ON class_summaries (college_id, shared_at DESC) WHERE withdrawn_at IS NULL;

CREATE TABLE class_summary_reads (
  summary_id  uuid NOT NULL REFERENCES class_summaries(id) ON DELETE CASCADE,
  student_id  uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  read_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (summary_id, student_id)
);

CREATE TABLE booster_step_completions (
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  track         text NOT NULL CHECK (track ~ '^[a-z-]{2,40}$'),
  step          text NOT NULL CHECK (step ~ '^[a-z0-9]{1,10}$'),
  completed_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, track, step)
);

-- Real teaching activity; the Skill Booster reads it (append-only).
CREATE TABLE faculty_activity_events (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  college_id  uuid REFERENCES colleges(id) ON DELETE CASCADE,
  kind        faculty_event_kind NOT NULL,
  at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON faculty_activity_events (user_id, kind);

-- ────────────────────────────────────────────────────────────────────────────────────────────
-- 10. Evaluation, interviews, resumes, notifications, audit
-- ────────────────────────────────────────────────────────────────────────────────────────────
-- AI-assisted evaluation of written answers; faculty approve or override every mark.
CREATE TABLE evaluation_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id    uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  student_id    uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  assigned_to   uuid REFERENCES users(id) ON DELETE SET NULL,        -- reviewing faculty
  assessment    text NOT NULL CHECK (length(assessment) <= 140),
  question      text NOT NULL CHECK (length(question) <= 2000),
  answer        text NOT NULL CHECK (length(answer) <= 8000),
  ai_result     jsonb NOT NULL CHECK (jsonb_typeof(ai_result) = 'object'),   -- {score, max, confidence, rubric, evidence, missing, feedback}
  ai_score      numeric(5,2) NOT NULL CHECK (ai_score >= 0),
  max_score     numeric(5,2) NOT NULL CHECK (max_score > 0 AND ai_score <= max_score),
  confidence    numeric(3,2) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  status        evaluation_status NOT NULL DEFAULT 'pending',
  final_score   numeric(5,2) CHECK (final_score BETWEEN 0 AND 100),
  reviewed_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'pending') = (final_score IS NULL)),
  CHECK (final_score IS NULL OR final_score <= max_score)
);
CREATE INDEX ON evaluation_items (assigned_to, status);

-- Every override keeps its reason (append-only).
CREATE TABLE evaluation_overrides (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  item_id         uuid NOT NULL REFERENCES evaluation_items(id) ON DELETE CASCADE,
  overridden_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  previous_score  numeric(5,2),
  final_score     numeric(5,2) NOT NULL CHECK (final_score BETWEEN 0 AND 100),
  reason          text NOT NULL CHECK (length(reason) BETWEEN 5 AND 500),
  at              timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE interview_sessions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id     uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  college_id     uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  mode           interview_mode NOT NULL,
  started_at     timestamptz NOT NULL DEFAULT now(),
  completed_at   timestamptz,
  overall_score  smallint CHECK (overall_score BETWEEN 0 AND 100),
  scorecard      jsonb CHECK (scorecard IS NULL OR jsonb_typeof(scorecard) = 'object'),   -- {dimensions, strengths, improvements}
  turns          jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(turns) = 'array'),
  CHECK ((completed_at IS NULL) = (overall_score IS NULL))
);
CREATE INDEX ON interview_sessions (student_id, completed_at DESC);

CREATE TABLE resume_analyses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  college_id   uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  target_role  text NOT NULL CHECK (length(target_role) <= 60),
  ats_score    smallint NOT NULL CHECK (ats_score BETWEEN 0 AND 100),
  result       jsonb NOT NULL CHECK (jsonb_typeof(result) = 'object'),   -- {keywordsFound, keywordsMissing, sections, suggestions}
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON resume_analyses (student_id, created_at DESC);

CREATE TABLE notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  college_id  uuid REFERENCES colleges(id) ON DELETE CASCADE,
  title       text NOT NULL CHECK (length(title) BETWEEN 2 AND 120),
  body        text NOT NULL CHECK (length(body) <= 600),
  tone        ui_tone NOT NULL DEFAULT 'brand',
  link        text CHECK (link ~ '^/[A-Za-z0-9/_?=&.-]*$'),     -- same-origin paths only
  created_at  timestamptz NOT NULL DEFAULT now(),
  read_at     timestamptz
);
CREATE INDEX ON notifications (user_id, created_at DESC) WHERE read_at IS NULL;

-- Security audit trail (append-only; retention handled by partition/archival, not deletes).
CREATE TABLE audit_log (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at             timestamptz NOT NULL DEFAULT now(),
  college_id     uuid REFERENCES colleges(id) ON DELETE SET NULL,
  actor_user_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_name     text NOT NULL,
  action         text NOT NULL CHECK (length(action) BETWEEN 2 AND 160),
  target_type    text CHECK (length(target_type) <= 40),
  target_id      text CHECK (length(target_id) <= 80),
  ip             inet
);
CREATE INDEX ON audit_log (college_id, at DESC);

-- ────────────────────────────────────────────────────────────────────────────────────────────
-- 11. Triggers
-- ────────────────────────────────────────────────────────────────────────────────────────────
-- updated_at + version on every editable table
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['colleges','users','admissions','students','staff','courses','events','clinical_rotations','gallery_items','learning_courses','quizzes']
  LOOP
    EXECUTE format('CREATE TRIGGER %1$s_touch BEFORE UPDATE ON %1$I FOR EACH ROW EXECUTE FUNCTION touch_row()', t);
    EXECUTE format('CREATE TRIGGER %1$s_version BEFORE UPDATE ON %1$I FOR EACH ROW WHEN (OLD.version = NEW.version) EXECUTE FUNCTION bump_version()', t);
  END LOOP;
END $$;
CREATE TRIGGER college_websites_touch BEFORE UPDATE ON college_websites FOR EACH ROW EXECUTE FUNCTION touch_row();
CREATE TRIGGER college_websites_version BEFORE UPDATE ON college_websites FOR EACH ROW WHEN (OLD.version = NEW.version) EXECUTE FUNCTION bump_version();

-- Stream rules: a record's department / programme / term / designation must belong to its
-- college's stream, and entrance scores cannot exceed the stream's maximum.
CREATE FUNCTION enforce_stream_match() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v jsonb := to_jsonb(NEW);
  s text := college_stream(NEW.college_id);
  other text;
BEGIN
  IF s IS NULL THEN
    RAISE EXCEPTION 'unknown college %', NEW.college_id USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF v ? 'department_id' AND v->>'department_id' IS NOT NULL THEN
    SELECT stream_key INTO other FROM departments WHERE id = (v->>'department_id')::int;
    IF other IS DISTINCT FROM s THEN
      RAISE EXCEPTION 'department does not belong to the % stream', s USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  IF v ? 'programme_id' AND v->>'programme_id' IS NOT NULL THEN
    SELECT stream_key INTO other FROM programmes WHERE id = (v->>'programme_id')::int;
    IF other IS DISTINCT FROM s THEN
      RAISE EXCEPTION 'programme does not belong to the % stream', s USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  IF v ? 'term_id' AND v->>'term_id' IS NOT NULL THEN
    SELECT stream_key INTO other FROM terms WHERE id = (v->>'term_id')::int;
    IF other IS DISTINCT FROM s THEN
      RAISE EXCEPTION 'term does not belong to the % stream', s USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  IF v ? 'designation_id' AND v->>'designation_id' IS NOT NULL THEN
    SELECT stream_key INTO other FROM designations WHERE id = (v->>'designation_id')::int;
    IF other IS NOT NULL AND other <> s THEN
      RAISE EXCEPTION 'designation does not belong to the % stream', s USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  IF v ? 'entrance_score' AND v->>'entrance_score' IS NOT NULL
     AND (v->>'entrance_score')::numeric > (SELECT entrance_max FROM streams WHERE key = s) THEN
    RAISE EXCEPTION 'entrance score exceeds the % stream maximum', s USING ERRCODE = 'check_violation';
  END IF;
  IF TG_TABLE_NAME = 'clinical_rotations' AND s <> 'medical' THEN
    RAISE EXCEPTION 'clinical rotations are only for medical colleges' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['admissions','students','staff','courses','clinical_rotations','learning_courses','quizzes','class_summaries','role_assignments']
  LOOP
    EXECUTE format('CREATE TRIGGER %1$s_stream BEFORE INSERT OR UPDATE ON %1$I FOR EACH ROW WHEN (NEW.college_id IS NOT NULL) EXECUTE FUNCTION enforce_stream_match()', t);
  END LOOP;
END $$;

-- Admission status history
CREATE FUNCTION log_admission_status() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO admission_status_history (admission_id, from_status, to_status, changed_by)
    VALUES (NEW.id, CASE WHEN TG_OP = 'UPDATE' THEN OLD.status END, NEW.status, nullif(current_setting('app.user_id', true), '')::uuid);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER admissions_status_log AFTER INSERT OR UPDATE OF status ON admissions FOR EACH ROW EXECUTE FUNCTION log_admission_status();

-- Rows of the same college: registrations, progress, attempts, reads belong with the parent's college
CREATE FUNCTION same_college_student() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.college_id IS DISTINCT FROM (SELECT college_id FROM students WHERE id = NEW.student_id) THEN
    RAISE EXCEPTION 'student belongs to another college' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER quiz_attempts_same_college BEFORE INSERT ON quiz_attempts FOR EACH ROW EXECUTE FUNCTION same_college_student();
CREATE TRIGGER interview_same_college BEFORE INSERT ON interview_sessions FOR EACH ROW EXECUTE FUNCTION same_college_student();
CREATE TRIGGER resume_same_college BEFORE INSERT ON resume_analyses FOR EACH ROW EXECUTE FUNCTION same_college_student();
CREATE TRIGGER certificates_same_college BEFORE INSERT ON certificates FOR EACH ROW EXECUTE FUNCTION same_college_student();

-- At most 3 attempts per student per quiz
CREATE FUNCTION limit_quiz_attempts() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Number the attempt. Two concurrent transactions can compute the same number; they then collide on
  -- UNIQUE (quiz_id, student_id, attempt_no); a 4th attempt is rejected here (and by the 1–3 CHECK).
  NEW.attempt_no := (SELECT coalesce(max(attempt_no), 0) + 1 FROM quiz_attempts WHERE quiz_id = NEW.quiz_id AND student_id = NEW.student_id);
  IF NEW.attempt_no > 3 THEN
    RAISE EXCEPTION 'all 3 attempts used for this quiz' USING ERRCODE = 'check_violation';
  END IF;
  IF (SELECT college_id FROM quizzes WHERE id = NEW.quiz_id) IS DISTINCT FROM NEW.college_id THEN
    RAISE EXCEPTION 'quiz belongs to another college' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER quiz_attempts_limit BEFORE INSERT ON quiz_attempts FOR EACH ROW EXECUTE FUNCTION limit_quiz_attempts();

-- Event registrations: open, published events with free capacity, same college
CREATE FUNCTION check_event_registration() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE e events%ROWTYPE;
BEGIN
  SELECT * INTO e FROM events WHERE id = NEW.event_id;
  IF NOT e.registration_open OR e.status <> 'Published' THEN
    RAISE EXCEPTION 'registration is closed for this event' USING ERRCODE = 'check_violation';
  END IF;
  IF e.college_id IS DISTINCT FROM (SELECT college_id FROM students WHERE id = NEW.student_id) THEN
    RAISE EXCEPTION 'student belongs to another college' USING ERRCODE = 'check_violation';
  END IF;
  IF (SELECT count(*) FROM event_registrations WHERE event_id = NEW.event_id) >= e.capacity THEN
    RAISE EXCEPTION 'event is full' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER event_registrations_check BEFORE INSERT ON event_registrations FOR EACH ROW EXECUTE FUNCTION check_event_registration();

-- Append-only tables
CREATE TRIGGER audit_log_append_only BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER faculty_events_append_only BEFORE UPDATE OR DELETE ON faculty_activity_events FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER evaluation_overrides_append_only BEFORE UPDATE OR DELETE ON evaluation_overrides FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- ────────────────────────────────────────────────────────────────────────────────────────────
-- 12. Row-level security (college isolation)
--   The API connects as a member of role `ciq_app` and, per transaction, calls
--     SELECT app_set_context('<college uuid>' | NULL, 'college' | 'all', '<user uuid>');
--   Only the University Super Admin may use scope 'all'.
-- ────────────────────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ciq_app') THEN
    CREATE ROLE ciq_app NOLOGIN;
  END IF;
END $$;

CREATE FUNCTION app_college() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('app.college_id', true), '')::uuid $$;
CREATE FUNCTION app_scope_all() RETURNS boolean LANGUAGE sql STABLE AS
$$ SELECT coalesce(current_setting('app.scope', true), '') = 'all' $$;

CREATE FUNCTION app_set_context(p_college uuid, p_scope text, p_user uuid DEFAULT NULL) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF p_scope NOT IN ('college', 'all') THEN RAISE EXCEPTION 'scope must be college or all'; END IF;
  IF p_scope = 'college' AND p_college IS NULL THEN RAISE EXCEPTION 'college scope needs a college'; END IF;
  PERFORM set_config('app.college_id', coalesce(p_college::text, ''), true);
  PERFORM set_config('app.scope', p_scope, true);
  PERFORM set_config('app.user_id', coalesce(p_user::text, ''), true);
END $$;

-- Tables that carry college_id directly
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'college_modules','admissions','students','staff','courses','events','clinical_rotations','gallery_items',
    'college_websites','learning_courses','quizzes','quiz_attempts','certificates','lesson_outlines','class_summaries',
    'evaluation_items','interview_sessions','resume_analyses']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY college_isolation ON %I USING (app_scope_all() OR college_id = app_college()) WITH CHECK (app_scope_all() OR college_id = app_college())$p$, t);
  END LOOP;
END $$;

-- Media: university-level assets (college_id NULL) are readable by everyone; writes stay college-scoped.
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets FORCE ROW LEVEL SECURITY;
CREATE POLICY media_read ON media_assets FOR SELECT USING (app_scope_all() OR college_id IS NULL OR college_id = app_college());
CREATE POLICY media_write ON media_assets FOR INSERT WITH CHECK (app_scope_all() OR college_id = app_college());
CREATE POLICY media_delete ON media_assets FOR DELETE USING (app_scope_all() OR college_id = app_college());

-- Child tables inherit visibility from their parent (the parent's own policy filters the EXISTS).
ALTER TABLE admission_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY via_parent ON admission_documents USING (EXISTS (SELECT 1 FROM admissions a WHERE a.id = admission_id));
ALTER TABLE admission_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY via_parent ON admission_status_history USING (EXISTS (SELECT 1 FROM admissions a WHERE a.id = admission_id));
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY via_parent ON event_registrations USING (EXISTS (SELECT 1 FROM events e WHERE e.id = event_id));
ALTER TABLE course_outcomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY via_parent ON course_outcomes USING (EXISTS (SELECT 1 FROM learning_courses c WHERE c.id = course_id));
ALTER TABLE course_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY via_parent ON course_units USING (EXISTS (SELECT 1 FROM learning_courses c WHERE c.id = course_id));
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY via_parent ON lessons USING (EXISTS (SELECT 1 FROM learning_courses c WHERE c.id = course_id));
ALTER TABLE lesson_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY via_parent ON lesson_videos USING (EXISTS (SELECT 1 FROM lessons l WHERE l.id = lesson_id));
ALTER TABLE lesson_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY via_parent ON lesson_images USING (EXISTS (SELECT 1 FROM lessons l WHERE l.id = lesson_id));
ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY via_parent ON lesson_progress USING (EXISTS (SELECT 1 FROM students s WHERE s.id = student_id));
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY via_parent ON quiz_questions USING (EXISTS (SELECT 1 FROM quizzes q WHERE q.id = quiz_id));
ALTER TABLE quiz_attempt_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY via_parent ON quiz_attempt_answers USING (EXISTS (SELECT 1 FROM quiz_attempts a WHERE a.id = attempt_id));
ALTER TABLE class_summary_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY via_parent ON class_summary_reads USING (EXISTS (SELECT 1 FROM class_summaries s WHERE s.id = summary_id));
ALTER TABLE evaluation_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY via_parent ON evaluation_overrides USING (EXISTS (SELECT 1 FROM evaluation_items i WHERE i.id = item_id));

GRANT USAGE ON SCHEMA public TO ciq_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ciq_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ciq_app;
REVOKE UPDATE, DELETE ON audit_log, faculty_activity_events, evaluation_overrides FROM ciq_app;
-- Lookup data is managed by migrations only
REVOKE INSERT, UPDATE, DELETE ON universities, streams, college_types, departments, programmes, terms, designations FROM ciq_app;

-- ────────────────────────────────────────────────────────────────────────────────────────────
-- 13. Placement readiness (replaces the hard-coded aptitude / interview / resume values)
--   total = quizAvg×0.35 + min(certs,4)/4×20 + aptitude×0.15 + interview×0.15 + resume×0.15
--   ready = total ≥ 70 AND quizAvg ≥ 60 AND certs ≥ 2 AND interview ≥ 50
-- ────────────────────────────────────────────────────────────────────────────────────────────
CREATE VIEW v_placement_readiness WITH (security_invoker = true) AS
WITH best AS (
  SELECT a.student_id, q.purpose, a.quiz_id, max(a.percentage) AS pct
  FROM quiz_attempts a JOIN quizzes q ON q.id = a.quiz_id
  WHERE a.submitted_at IS NOT NULL
  GROUP BY a.student_id, q.purpose, a.quiz_id
),
scores AS (
  SELECT
    s.id AS student_id, s.college_id, s.roll_no, u.full_name AS name, d.name AS department,
    coalesce((SELECT round(avg(b.pct)) FROM best b WHERE b.student_id = s.id AND b.purpose <> 'placement_aptitude'), 0) AS quiz_average,
    (SELECT count(*) FROM certificates c WHERE c.student_id = s.id AND c.superseded_at IS NULL) AS certificates,
    coalesce((SELECT round(max(b.pct)) FROM best b WHERE b.student_id = s.id AND b.purpose = 'placement_aptitude'), 0) AS aptitude,
    coalesce((SELECT i.overall_score FROM interview_sessions i WHERE i.student_id = s.id AND i.completed_at IS NOT NULL ORDER BY i.completed_at DESC LIMIT 1), 0) AS interview,
    coalesce((SELECT r.ats_score FROM resume_analyses r WHERE r.student_id = s.id ORDER BY r.created_at DESC LIMIT 1), 0) AS resume
  FROM students s
  JOIN users u ON u.id = s.user_id
  JOIN departments d ON d.id = s.department_id
  WHERE s.status = 'Active'
)
SELECT
  sc.*,
  round(sc.quiz_average * 0.35 + least(sc.certificates, 4) / 4.0 * 20 + sc.aptitude * 0.15 + sc.interview * 0.15 + sc.resume * 0.15)::int AS total,
  CASE
    WHEN round(sc.quiz_average * 0.35 + least(sc.certificates, 4) / 4.0 * 20 + sc.aptitude * 0.15 + sc.interview * 0.15 + sc.resume * 0.15) >= 70
         AND sc.quiz_average >= 60 AND sc.certificates >= 2 AND sc.interview >= 50 THEN 'Placement ready'
    WHEN round(sc.quiz_average * 0.35 + least(sc.certificates, 4) / 4.0 * 20 + sc.aptitude * 0.15 + sc.interview * 0.15 + sc.resume * 0.15) >= 55 THEN 'Almost ready'
    ELSE 'Needs work'
  END AS status
FROM scores sc;

GRANT SELECT ON v_placement_readiness TO ciq_app;

COMMIT;
