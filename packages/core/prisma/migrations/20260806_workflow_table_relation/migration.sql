-- Workflow Definition → Table relation
-- Links workflow definitions to their data model (soft: table deletion nulls the link).

ALTER TABLE "core"."workflow_definitions" ADD CONSTRAINT "workflow_definitions_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "core"."tables"("id") ON DELETE SET NULL ON UPDATE CASCADE;
