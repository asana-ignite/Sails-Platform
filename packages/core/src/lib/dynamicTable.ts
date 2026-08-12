/**
 * dynamicTable — resolves a dynamic table name to its metadata + tenant
 * schema for the active session. Returns null (→ 404) when the table does
 * not exist for the session's tenant, so cross-tenant access is impossible.
 */
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth/session';

/**
 * Shared helper: look up the physical table definition and validate tenant ownership.
 * Returns the schemaName for the active session's tenant, or null when the table
 * does not exist for that tenant.
 */
export async function resolveTable(tableName: string) {
  const { tenantId } = await requireSession();

  const table = await db.tableDefinition.findFirst({
    where: {
      tableName,
      tenantId,
    },
    include: {
      tenant: true,
      fields: {
        include: { rules: true },
      },
      rules: true,
    },
  });

  if (!table) {
    return null;
  }

  return { table, schemaName: table.tenant.schemaName };
}
