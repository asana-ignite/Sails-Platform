-- Layout Versioning
-- Additive: new column + version history table. Records keep rendering from
-- the live publishedConfig — no consumer or tenant-schema changes.

-- AlterTable
ALTER TABLE "core"."table_layouts" ADD COLUMN "currentVersion" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "core"."layout_versions" (
    "id" TEXT NOT NULL,
    "layout_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "config" JSONB NOT NULL,
    "notes" TEXT,
    "published_by" TEXT,
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "layout_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "layout_versions_layout_id_idx" ON "core"."layout_versions"("layout_id");

-- CreateIndex
CREATE UNIQUE INDEX "layout_versions_layout_id_version_key" ON "core"."layout_versions"("layout_id", "version");

-- AddForeignKey
ALTER TABLE "core"."layout_versions" ADD CONSTRAINT "layout_versions_layout_id_fkey" FOREIGN KEY ("layout_id") REFERENCES "core"."table_layouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
