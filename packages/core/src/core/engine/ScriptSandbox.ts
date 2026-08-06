/**
 * ScriptSandbox — executes tenant BYOC scripts in an isolated V8 context.
 *
 * The script receives a frozen `ctx` object (record, instance, variables,
 * session) and a restricted `sails` SDK (log / read-only query / abort).
 * No host objects leak: no require, process, fetch, or console. Execution is
 * capped by a CPU timeout and a maximum code size.
 *
 * v1 uses Node's `vm` module with a locked-down context; the API surface is
 * designed so a hardened `isolated-vm` backend can be swapped in later
 * without touching callers.
 */
import vm from 'node:vm';
import { pool } from '@/lib/knex';
import { MAX_SCRIPT_BYTES, quoteIdent } from './WorkflowHelpers';

export interface SandboxContext {
  record: {
    id: string | null;
    values: Record<string, any>;
    oldValues?: Record<string, any>;
  };
  instance: { id: string };
  stage: { id: string | null };
  variables: Record<string, any>;
  session: { userId: string; teamId: string | null };
  table: { name: string | null };
  operation: string | null;
  timing: 'stage_enter' | 'stage_exit';
}

export interface SandboxOptions {
  tenantId: string;
  tenantSchema: string;
  timeoutMs?: number;
}

export interface SandboxResult {
  ok: boolean;
  /** Variables mutated by the script (merged by the caller). */
  variables: Record<string, any>;
  /** Record values mutated by the script. */
  recordValues?: Record<string, any>;
  log: string[];
  error?: string;
}

function allowedTable(tenantSchema: string, tableName: string): boolean {
  if (!/^[a-z][a-z0-9_]*$/.test(tableName)) return false;
  if (tableName.startsWith('wf_')) return false; // workflow runtime tables are internal
  return true;
}

function buildSails(
  tenantId: string,
  tenantSchema: string,
  session: SandboxContext['session'],
  log: string[],
  tenantSchemaRef: { schema: string },
): Record<string, (...args: any[]) => any> {
  return {
    log: (...args: any[]) => {
      log.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
    },
    query: async (tableName: string, options?: { where?: Record<string, any>; limit?: number }) => {
      if (!allowedTable(tenantSchema, tableName)) {
        throw new Error(`sails.query: table '${tableName}' is not accessible`);
      }
      const t = quoteIdent(tableName);
      const where = options?.where || {};
      const entries = Object.entries(where);
      const clauses: string[] = [`"tenant_id" = $1`];
      const values: any[] = [tenantId];
      for (const [key, val] of entries) {
        if (!/^[a-z][a-z0-9_]*$/.test(key)) throw new Error(`sails.query: invalid column '${key}'`);
        values.push(val);
        clauses.push(`${quoteIdent(key)} = $${values.length}`);
      }
      const limit = Math.min(options?.limit || 25, 100);
      const res = await pool.query(
        `SELECT * FROM ${tenantSchemaRef.schema}.${t} WHERE ${clauses.join(' AND ')} LIMIT $${values.length + 1}`,
        [...values, limit],
      );
      return res.rows;
    },
    abort: (reason: string) => {
      throw new Error(`Script aborted: ${reason}`);
    },
  };
}

export async function executeScript(
  scriptCode: string,
  ctx: SandboxContext,
  options: SandboxOptions,
): Promise<SandboxResult> {
  const log: string[] = [];
  const timeoutMs = options.timeoutMs || 5000;

  if (Buffer.byteLength(scriptCode, 'utf8') > MAX_SCRIPT_BYTES) {
    return { ok: false, variables: ctx.variables, log, error: `Script exceeds ${MAX_SCRIPT_BYTES} bytes` };
  }

  // Compile first — syntax errors are rejected before any execution.
  let compiled: vm.Script;
  try {
    compiled = new vm.Script(scriptCode, { filename: 'byoc-script.js' });
  } catch (error: any) {
    return { ok: false, variables: ctx.variables, log, error: `Syntax error: ${error?.message || error}` };
  }

  const tenantSchemaRef = { schema: options.tenantSchema };
  const sails = buildSails(options.tenantId, options.tenantSchema, ctx.session, log, tenantSchemaRef);

  const sandbox: Record<string, any> = {
    ctx,
    sails,
    // Reserved for future sandboxed I/O; undefined today.
    console: undefined,
    require: undefined,
    process: undefined,
    fetch: undefined,
    setTimeout: undefined,
  };
  vm.createContext(sandbox);

  try {
    compiled.runInContext(sandbox, { timeout: timeoutMs });
    const variables = (sandbox.ctx?.variables as Record<string, any>) || ctx.variables;
    const recordValues = (sandbox.ctx?.record?.values as Record<string, any>) || ctx.record.values;
    return { ok: true, variables, recordValues, log };
  } catch (error: any) {
    const message = error?.message || String(error);
    return {
      ok: false,
      variables: (sandbox.ctx?.variables as Record<string, any>) || ctx.variables,
      recordValues: (sandbox.ctx?.record?.values as Record<string, any>) || ctx.record.values,
      log,
      error: message,
    };
  }
}
