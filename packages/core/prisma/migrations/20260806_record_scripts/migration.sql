-- BYOC Scripts (RecordScript) — tenant-authored scripts executed by the
-- ScriptEventPlugin inside the workflow sandbox. Configurations of the
-- built-in 'script' workflow event type.

-- CreateTable
CREATE TABLE "core"."record_scripts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "script_code" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "record_scripts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "record_scripts_tenant_id_is_active_idx" ON "core"."record_scripts"("tenant_id", "is_active");

-- AddForeignKey
ALTER TABLE "core"."record_scripts" ADD CONSTRAINT "record_scripts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "core"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
