-- Workflow Definition & Versioning
-- Versioned approval-workflow definitions. Instances pin to WorkflowVersion snapshots.

-- CreateTable
CREATE TABLE "core"."workflow_definitions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "system_name" TEXT NOT NULL,
    "description" TEXT,
    "table_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "config" JSONB NOT NULL,
    "published_config" JSONB,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "deactivated_at" TIMESTAMP(3),
    "deactivated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core"."workflow_versions" (
    "id" TEXT NOT NULL,
    "def_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "config" JSONB NOT NULL,
    "notes" TEXT,
    "published_by" TEXT,
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workflow_definitions_system_name_key" ON "core"."workflow_definitions"("system_name");

-- CreateIndex
CREATE INDEX "workflow_definitions_tenant_id_status_idx" ON "core"."workflow_definitions"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "workflow_definitions_tenant_id_table_id_idx" ON "core"."workflow_definitions"("tenant_id", "table_id");

-- CreateIndex
CREATE INDEX "workflow_versions_def_id_idx" ON "core"."workflow_versions"("def_id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_versions_def_id_version_key" ON "core"."workflow_versions"("def_id", "version");

-- AddForeignKey
ALTER TABLE "core"."workflow_definitions" ADD CONSTRAINT "workflow_definitions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "core"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core"."workflow_versions" ADD CONSTRAINT "workflow_versions_def_id_fkey" FOREIGN KEY ("def_id") REFERENCES "core"."workflow_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
