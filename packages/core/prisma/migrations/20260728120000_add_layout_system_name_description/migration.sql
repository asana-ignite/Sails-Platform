-- AlterTable
ALTER TABLE "core"."table_layouts" ADD COLUMN     "description" TEXT,
ADD COLUMN     "system_name" TEXT NOT NULL DEFAULT '';

-- Set system_name to the existing name for any existing rows
UPDATE "core"."table_layouts" SET "system_name" = "name" WHERE "system_name" = '';

-- Drop the default since we want it to be required going forward
ALTER TABLE "core"."table_layouts" ALTER COLUMN "system_name" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "table_layouts_table_id_system_name_key" ON "core"."table_layouts"("table_id", "system_name");
