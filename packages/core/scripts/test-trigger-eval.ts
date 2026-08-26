import { db } from '@/lib/db';
import { Pool } from 'pg';

async function testTriggerEvalWithCtx() {
  const tenantId = 'cmrxlaeys001iky2dlttomtrw';
  const tableName = 'leave';
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:mysecretpassword@db:5432/postgres?schema=core'
  });

  try {
    const tableDef = await db.tableDefinition.findUnique({
      where: { tenantId_tableName: { tenantId, tableName } },
      include: { fields: true }
    });

    const wf = await db.workflowDefinition.findFirst({
      where: { tenantId, name: 'Leave Request' }
    });

    const { serializeRecordFilters } = await import('@/core/engine/WorkflowEventPlugins');
    const serialized = serializeRecordFilters((wf?.config as any)?.triggerCondition, tableDef?.fields || []);

    const { QueryLayer } = await import('@/core/engine/QueryLayer');
    const { resolveTenantSchema } = await import('@/core/engine/WorkflowHelpers');
    const schema = await resolveTenantSchema(tenantId);

    const meta = {
      validFields: new Set(tableDef?.fields.map(f => f.fieldName)),
      textFields: ['leave_no', 'reason'],
      jsonbFields: new Set<string>()
    };

    const ses: any = {
      userId: 'cmrxlaeyy001lky2d63a9qnch',
      tenantId,
      role: 'TENANT_ADMIN',
      email: '',
      teams: [],
    };

    console.log('\nTesting listRecords with ses context...');
    const records = await QueryLayer.listRecords(pool, schema!, tableName, {
      filterGroups: serialized,
      limit: 5,
      page: 1,
      validFields: meta.validFields,
      textFields: meta.textFields,
      jsonbFields: meta.jsonbFields,
      ctx: ses
    });
    console.log('Matched records with status=submitted:', records.rows);

  } catch (err: any) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

testTriggerEvalWithCtx();
