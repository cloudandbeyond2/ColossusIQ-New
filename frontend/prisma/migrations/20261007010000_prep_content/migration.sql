-- ════════════════════════════════════════════════════════════════════════════════════════════
--  0013 — exam prep content
--  prep_content: what a college's staff add to the Competitive Exam Prep Hub. kind 'set' is a question set for a
--  syllabus topic (an existing topic, or a new college topic attached to an exam section); kind 'note' is a topic's
--  study notes (written by faculty, or AI notes cached for the college). The content itself is JSON, validated by
--  the application before it is stored.
-- ════════════════════════════════════════════════════════════════════════════════════════════
SET client_encoding = 'UTF8';
BEGIN;

CREATE TABLE IF NOT EXISTS prep_content (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id   uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  kind         text NOT NULL CHECK (kind IN ('note','set')),
  topic_id     text NOT NULL CHECK (topic_id ~ '^[a-z0-9-]{2,60}$'),
  topic_title  text NOT NULL CHECK (length(topic_title) BETWEEN 2 AND 80),
  exam_ids     text[] NOT NULL DEFAULT '{}',
  section      text NOT NULL DEFAULT '' CHECK (length(section) <= 120),
  title        text NOT NULL DEFAULT '' CHECK (length(title) <= 120),
  body         jsonb NOT NULL CHECK (jsonb_typeof(body) = 'object' AND length(body::text) <= 200000),
  source       text NOT NULL DEFAULT 'faculty' CHECK (source IN ('faculty','ai')),
  status       text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Published')),
  author_name  text NOT NULL DEFAULT '' CHECK (length(author_name) <= 120),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS prep_content_college_kind_topic_idx ON prep_content (college_id, kind, topic_id);

ALTER TABLE prep_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE prep_content FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY college_isolation ON prep_content
    USING (app_scope_all() OR college_id = app_college())
    WITH CHECK (app_scope_all() OR college_id = app_college());
EXCEPTION WHEN duplicate_object THEN null;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON prep_content TO ciq_app;

COMMIT;
