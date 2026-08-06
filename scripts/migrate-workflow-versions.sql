-- migrate-workflow-versions.sql
-- Run ONCE per environment (NOT from a GET handler — golden rule #1).
--
-- Backfills WorkflowVersion rows for workflow definitions that existed before
-- versioning was introduced. For every active definition with a published
-- config, insert a synthetic v1 snapshot so new instances can pin to it.
--
-- Usage:
--   docker exec sails-db psql -U postgres -d postgres -f - < scripts/migrate-workflow-versions.sql

BEGIN;

INSERT INTO core.workflow_versions (def_id, version, config, notes, published_by, published_at)
SELECT
  id,
  1,
  published_config,
  'Initial version (auto-migrated)',
  NULL,
  now()
FROM core.workflow_definitions
WHERE status = 'active'
  AND published_config IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM core.workflow_versions v WHERE v.def_id = core.workflow_definitions.id
  );

-- Definitions that are only drafts get a v1 snapshot of their current config
-- so the designer's version history is consistent from the start.
INSERT INTO core.workflow_versions (def_id, version, config, notes, published_by, published_at)
SELECT
  id,
  1,
  config,
  'Draft baseline (auto-migrated)',
  NULL,
  now()
FROM core.workflow_definitions
WHERE status = 'draft'
  AND NOT EXISTS (
    SELECT 1 FROM core.workflow_versions v WHERE v.def_id = core.workflow_definitions.id
  );

COMMIT;

-- Verify:
-- SELECT d.name, d.status, d."currentVersion", count(v.id) AS versions
-- FROM core.workflow_definitions d
-- LEFT JOIN core.workflow_versions v ON v.def_id = d.id
-- GROUP BY d.id, d.name, d.status, d."currentVersion"
-- ORDER BY d.name;
