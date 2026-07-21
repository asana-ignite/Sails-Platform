/*
  Warnings:

  - You are about to drop the `audit_logs` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_user_id_fkey";

-- DropTable
DROP TABLE "audit_logs";

-- CreateTable
CREATE TABLE "data_audit_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT,
    "ip_address" TEXT,
    "action" TEXT NOT NULL,
    "object_name" TEXT NOT NULL,
    "record_id" TEXT,
    "old_values" JSONB,
    "new_values" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_event_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT,
    "ip_address" TEXT,
    "category" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "event_name" TEXT NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ddl_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "user_id" TEXT,
    "schema_name" TEXT NOT NULL,
    "table_name" TEXT,
    "action" TEXT NOT NULL,
    "sql_executed" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ddl_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "data_audit_logs_tenant_id_object_name_record_id_idx" ON "data_audit_logs"("tenant_id", "object_name", "record_id");

-- CreateIndex
CREATE INDEX "data_audit_logs_user_id_idx" ON "data_audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "data_audit_logs_created_at_idx" ON "data_audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "system_event_logs_tenant_id_category_idx" ON "system_event_logs"("tenant_id", "category");

-- CreateIndex
CREATE INDEX "system_event_logs_user_id_idx" ON "system_event_logs"("user_id");

-- CreateIndex
CREATE INDEX "system_event_logs_created_at_idx" ON "system_event_logs"("created_at");

-- CreateIndex
CREATE INDEX "ddl_logs_schema_name_idx" ON "ddl_logs"("schema_name");

-- CreateIndex
CREATE INDEX "ddl_logs_created_at_idx" ON "ddl_logs"("created_at");

-- AddForeignKey
ALTER TABLE "data_audit_logs" ADD CONSTRAINT "data_audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_audit_logs" ADD CONSTRAINT "data_audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_event_logs" ADD CONSTRAINT "system_event_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_event_logs" ADD CONSTRAINT "system_event_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ddl_logs" ADD CONSTRAINT "ddl_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ddl_logs" ADD CONSTRAINT "ddl_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
