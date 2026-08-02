-- Materialize tenant_id on console_menus so Browser Path uniqueness can be
-- enforced per-tenant (a path is only unique within a tenant's navigation).
ALTER TABLE "core"."console_menus" ADD COLUMN "tenant_id" TEXT;

-- Backfill from the owning app
UPDATE "core"."console_menus" m
SET "tenant_id" = a."tenant_id"
FROM "core"."console_apps" a
WHERE m."app_id" = a."id";

ALTER TABLE "core"."console_menus" ALTER COLUMN "tenant_id" SET NOT NULL;

-- Unique normalized Browser Path per tenant.
-- Normalization mirrors the console resolver (trim, strip trailing slashes,
-- lowercase). Empty paths are exempt (parent/section menus share path '').
--
-- NOTE: Prisma schema cannot express expression/partial indexes, so this
-- index lives only here (raw SQL). The API also validates path uniqueness
-- and format on POST/PATCH for friendly 409 errors.
CREATE UNIQUE INDEX "console_menus_tenant_path_unique"
  ON "core"."console_menus" ("tenant_id", lower(trim(trim(trailing '/' from "path"))))
  WHERE "path" IS NOT NULL AND trim("path") <> '';

-- Plain per-tenant index (matches @@index([tenantId]) in schema.prisma)
CREATE INDEX "console_menus_tenant_id_idx" ON "core"."console_menus"("tenant_id");
