-- system_name must be globally unique across ALL layouts, regardless of
-- whether the layout is bound to a table (table_id NOT NULL) or custom
-- (table_id NULL).
--
-- 1. Drop the per-table unique index (table_id, system_name) — superseded by
--    the global index below.
-- 2. Drop the partial index on custom layouts only (20260802 manual DDL) —
--    also superseded.
-- 3. system_name is NOT NULL, so a plain unique index enforces global
--    uniqueness while leaving table_id nullable.
--
-- NOTE: Prisma schema cannot express partial indexes; this migration only
-- uses constructs expressible in schema.prisma (@@unique([systemName])),
-- so `migrate diff` stays clean.
DROP INDEX IF EXISTS "core"."table_layouts_table_id_system_name_key";
DROP INDEX IF EXISTS "core"."table_layouts_system_name_custom_key";
CREATE UNIQUE INDEX "table_layouts_system_name_key"
  ON "core"."table_layouts"("system_name");
