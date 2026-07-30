-- Add draft/active lifecycle columns to table_layouts
ALTER TABLE "core"."table_layouts"
  ADD COLUMN "status"         VARCHAR(20) NOT NULL DEFAULT 'draft',
  ADD COLUMN "published_config" JSONB;

-- Existing layouts were effectively "live" — backfill as active with a published copy
UPDATE "core"."table_layouts"
SET "status" = 'active', "published_config" = "config";
