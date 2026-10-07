-- ════════════════════════════════════════════════════════════════════════════════════════════
--  0018 — University Content Desk, Curriculum Studio and Notice Board
--  university_content: content the University Super Admin prepares (often drafted by AI), verifies and publishes to
--                      colleges: current affairs, question sets and university events. Super Admin only.
--  curricula:          programme curricula (semesters, courses, credits, syllabus units, outcomes) the university
--                      prepares and publishes. Every college reads them; only the Super Admin writes.
--  notices / notice_reads: the Notice Board. A notice belongs to one college, or to every college when college_id
--                      is NULL (posted by the Super Admin). notice_reads records who has read / acknowledged it.
-- ════════════════════════════════════════════════════════════════════════════════════════════
SET client_encoding = 'UTF8';
BEGIN;

CREATE TABLE IF NOT EXISTS university_content (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind          text NOT NULL CHECK (kind IN ('current-affair','question-set','event')),
  status        text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','In review','Published','Rejected','Withdrawn')),
  source        text NOT NULL DEFAULT 'Manual' CHECK (source IN ('AI','Manual')),
  title         text NOT NULL CHECK (length(title) BETWEEN 3 AND 160),
  data          jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object' AND length(data::text) <= 60000),
  targets       text[] NOT NULL DEFAULT '{}',
  copies        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by    text NOT NULL DEFAULT '' CHECK (length(created_by) <= 120),
  verified_by   text NOT NULL DEFAULT '' CHECK (length(verified_by) <= 120),
  review_note   text NOT NULL DEFAULT '' CHECK (length(review_note) <= 500),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  published_at  timestamptz
);
CREATE INDEX IF NOT EXISTS university_content_kind_status_idx ON university_content (kind, status);

CREATE TABLE IF NOT EXISTS curricula (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programme     text NOT NULL CHECK (length(programme) BETWEEN 3 AND 120),
  regulation    text NOT NULL CHECK (length(regulation) BETWEEN 2 AND 40),
  status        text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Published','Archived')),
  version       integer NOT NULL DEFAULT 1 CHECK (version BETWEEN 1 AND 999),
  data          jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object' AND length(data::text) <= 400000),
  updated_by    text NOT NULL DEFAULT '' CHECK (length(updated_by) <= 120),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  published_at  timestamptz,
  UNIQUE (programme, regulation)
);

CREATE TABLE IF NOT EXISTS notices (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id     uuid REFERENCES colleges(id) ON DELETE CASCADE,
  author_sub     text NOT NULL CHECK (length(author_sub) <= 120),
  author_name    text NOT NULL CHECK (length(author_name) <= 120),
  author_role    text NOT NULL CHECK (length(author_role) <= 20),
  title          text NOT NULL CHECK (length(title) BETWEEN 3 AND 140),
  body           text NOT NULL CHECK (length(body) BETWEEN 3 AND 3000),
  category       text NOT NULL CHECK (category IN ('Academic','Examination','Event','Placement','Holiday','Fees','Hostel & Transport','General')),
  priority       text NOT NULL DEFAULT 'Normal' CHECK (priority IN ('Normal','Important','Urgent')),
  audience       text NOT NULL DEFAULT 'students' CHECK (audience IN ('everyone','students','staff')),
  department     text NOT NULL DEFAULT '' CHECK (length(department) <= 80),
  year           integer NOT NULL DEFAULT 0 CHECK (year BETWEEN 0 AND 6),
  pinned         boolean NOT NULL DEFAULT false,
  requires_ack   boolean NOT NULL DEFAULT false,
  link_url       text NOT NULL DEFAULT '' CHECK (link_url = '' OR (link_url ~ '^https://' AND length(link_url) <= 300)),
  expires_on     text CHECK (expires_on IS NULL OR expires_on ~ '^\d{4}-\d{2}-\d{2}$'),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notices_college_created_idx ON notices (college_id, created_at DESC);

CREATE TABLE IF NOT EXISTS notice_reads (
  notice_id       uuid NOT NULL REFERENCES notices(id) ON DELETE CASCADE,
  user_sub        text NOT NULL CHECK (length(user_sub) <= 120),
  college_id      uuid REFERENCES colleges(id) ON DELETE CASCADE,
  read_at         timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  PRIMARY KEY (notice_id, user_sub)
);
CREATE INDEX IF NOT EXISTS notice_reads_user_idx ON notice_reads (user_sub);

ALTER TABLE university_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE university_content FORCE ROW LEVEL SECURITY;
ALTER TABLE curricula ENABLE ROW LEVEL SECURITY;
ALTER TABLE curricula FORCE ROW LEVEL SECURITY;
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE notices FORCE ROW LEVEL SECURITY;
ALTER TABLE notice_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE notice_reads FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY platform_admin ON university_content USING (app_scope_all()) WITH CHECK (app_scope_all());
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY read_all ON curricula FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE POLICY platform_admin_write ON curricula FOR ALL USING (app_scope_all()) WITH CHECK (app_scope_all());
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- University-wide notices (college_id NULL) are readable in every college but written only at "All colleges".
DO $$ BEGIN
  CREATE POLICY college_or_university ON notices
    USING (app_scope_all() OR college_id IS NULL OR college_id = app_college())
    WITH CHECK (app_scope_all() OR college_id = app_college());
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY college_isolation ON notice_reads
    USING (app_scope_all() OR college_id = app_college())
    WITH CHECK (app_scope_all() OR college_id = app_college());
EXCEPTION WHEN duplicate_object THEN null;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON university_content, curricula, notices, notice_reads TO ciq_app;

COMMIT;
