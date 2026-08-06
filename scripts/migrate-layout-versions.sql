-- migrate-layout-versions.sql
-- Run ONCE per environment (NOT from a GET handler — golden rule #1).
--
-- Backfills LayoutVersion v1 snapshots for every existing layout so all
-- deployed layouts become "version 1". publishedConfig/config are untouched —
-- records keep rendering exactly as before (consumers read the live row).
--
-- Usage:
--   docker exec sails-db psql -U postgres -d postgres -f - < scripts/migrate-layout-versions.sql

BEGIN;

INSERT INTO core.layout_versions (id, layout_id, version, config, notes, published_by, published_at)
SELECT
  'lvv_' || replace(lower(gen_random_uuid()::text), '-', ''),
  id,
  1,
  COALESCE(published_config, config),
  'Initial version (auto-migrated)',
  NULL,
  now()
FROM core.table_layouts
WHERE NOT EXISTS (
  SELECT 1 FROM core.layout_versions v WHERE v.layout_id = core.table_layouts.id
);

COMMIT;

-- Verify:
-- SELECT d.name, d.status, d."currentVersion", count(v.id) AS versions
-- FROM core.table_layouts d
-- LEFT JOIN core.layout_versions v ON v.layout_id = d.id
-- GROUP BY d.id, d.name, d.status, d."currentVersion"
-- ORDER BY d.name;
