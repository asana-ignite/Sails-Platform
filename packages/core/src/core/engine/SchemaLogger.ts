/**
 * SchemaLogger — fire-and-forget DDL + system-event audit writer.
 * DDL statements executed by AlchemaCore are logged to core.ddl_logs and
 * logical metadata events to core.system_event_logs (both tenant-scoped).
 */
import { Pool } from 'pg';
import { ConnectionManager } from './ConnectionManager';
import format from 'pg-format';
import crypto from 'crypto';

let logPool: Pool | null = null;

/**
 * Returns the pool targeted for logs. 
 * Allows decoupling logs into a completely separate database if LOG_DATABASE_URL is provided.
 */
function getLogPool(): Pool {
  if (process.env.LOG_DATABASE_URL) {
    if (!logPool) {
      logPool = new Pool({
        connectionString: process.env.LOG_DATABASE_URL,
      });
    }
    return logPool;
  }
  return ConnectionManager.getInstance().getCorePool();
}

/**
 * Returns the schema name where logs should be written.
 */
function getLogSchema(): string {
  return process.env.LOG_SCHEMA || 'core';
}

function generateId(): string {
  return Date.now().toString(36) + crypto.randomBytes(8).toString('hex');
}

export class SchemaLogger {
  /**
   * Logs a physical DDL operation asynchronously (fire-and-forget).
   */
  static logDdl(options: {
    tenantId?: string | null;
    userId?: string | null;
    schemaName: string;
    tableName?: string | null;
    action: string;
    sqlExecuted: string;
  }): void {
    const pool = getLogPool();
    const schema = getLogSchema();
    const id = generateId();

    const sql = format(
      `INSERT INTO %I.ddl_logs (id, tenant_id, user_id, schema_name, table_name, action, sql_executed)
       VALUES (%L, %L, %L, %L, %L, %L, %L)`,
      schema,
      id,
      options.tenantId || null,
      options.userId || null,
      options.schemaName,
      options.tableName || null,
      options.action,
      options.sqlExecuted
    );

    pool.query(sql).catch(err => {
      console.error('[SchemaLogger] Failed to write DDL log:', err);
    });
  }

  /**
   * Logs a logical system event asynchronously (fire-and-forget).
   */
  static logSystemEvent(options: {
    tenantId: string;
    userId?: string | null;
    ipAddress?: string | null;
    category: 'METADATA' | 'USER_MANAGEMENT' | 'SETTINGS';
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT';
    eventName: string;
    details?: any;
  }): void {
    const pool = getLogPool();
    const schema = getLogSchema();
    const id = generateId();

    const sql = format(
      `INSERT INTO %I.system_event_logs (id, tenant_id, user_id, ip_address, category, action, event_name, details)
       VALUES (%L, %L, %L, %L, %L, %L, %L, %L)`,
      schema,
      id,
      options.tenantId,
      options.userId || null,
      options.ipAddress || null,
      options.category,
      options.action,
      options.eventName,
      options.details ? JSON.stringify(options.details) : null
    );

    pool.query(sql).catch(err => {
      console.error('[SchemaLogger] Failed to write System Event log:', err);
    });
  }
}
