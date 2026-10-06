-- ════════════════════════════════════════════════════════════════════════════════════════════
--  0010 — lesson figures
--  Labelled diagrams (process, cycle, layers, hierarchy, comparison, timeline, components) attached to a lesson, stored as
--  a JSON array and drawn by the lesson viewer. Up to 4 per lesson.
-- ════════════════════════════════════════════════════════════════════════════════════════════
SET client_encoding = 'UTF8';
BEGIN;

ALTER TABLE lessons ADD COLUMN IF NOT EXISTS figures jsonb NOT NULL DEFAULT '[]';

DO $$ BEGIN
  ALTER TABLE lessons ADD CONSTRAINT lessons_figures_check CHECK (json_array_len_between(figures, 0, 4));
EXCEPTION WHEN duplicate_object THEN null;
END $$;

COMMIT;
