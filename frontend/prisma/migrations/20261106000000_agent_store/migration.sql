-- Agent Store: AI agents a college has switched off. An agent with no row here is enabled.
BEGIN;

CREATE TABLE IF NOT EXISTS agent_disabled (
  college_id  uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  agent_id    text NOT NULL CHECK (length(agent_id) BETWEEN 2 AND 60),
  updated_by  text NOT NULL DEFAULT '' CHECK (length(updated_by) <= 120),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (college_id, agent_id)
);

ALTER TABLE agent_disabled ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_disabled FORCE ROW LEVEL SECURITY;
DO $$
BEGIN
  CREATE POLICY college_isolation ON agent_disabled
    USING (app_scope_all() OR college_id = app_college())
    WITH CHECK (app_scope_all() OR college_id = app_college());
EXCEPTION WHEN duplicate_object THEN null;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON agent_disabled TO ciq_app;

COMMIT;
