import { db } from '@/lib/db';
import { startInstance } from '@/core/engine/WorkflowEngine';

async function testLeaveWorkflow() {
  const tenantId = 'cmrxlaeys001iky2dlttomtrw';
  const def = await db.workflowDefinition.findFirst({
    where: { tenantId, name: 'Leave Request' }
  });
  if (!def) throw new Error('Leave Request workflow not found');

  console.log('Testing startInstance for workflow:', def.id, def.name);

  // Fetch or mock a leave record
  const schema = 'tenant_sails_default';
  const res = await startInstance(
    tenantId,
    { defId: def.id },
    'cmrxlaeyy001lky2d63a9qnch', // admin user
    {
      operation: 'update',
      recordId: 'mtab0o7c85f232dc5b6ade41',
      values: {
        id: 'mtab0o7c85f232dc5b6ade41',
        status: 'submitted',
        leave_no: 'LEV-0002',
        reason: 'Testing workflow fix',
      }
    }
  );

  console.log('startInstance result:', JSON.stringify(res, null, 2));
}

testLeaveWorkflow()
  .catch(err => console.error('Test execution error:', err))
  .finally(() => process.exit(0));
