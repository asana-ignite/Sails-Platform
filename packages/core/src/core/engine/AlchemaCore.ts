// Purpose: Handles the raw execution of Data Definition Language (DDL) statements.
// Safely uses 'pg-format' to construct CREATE TABLE, ALTER TABLE, and CREATE TRIGGER queries.
// Prevents SQL injection by enforcing strict identifier formatting for schema, table, and column names.

import format from 'pg-format';
import { Pool } from 'pg';
import { FieldRegistry } from '../registry/FieldRegistry';
import { ConnectionManager } from './ConnectionManager';
import { SchemaLogger } from './SchemaLogger';
import { getAppSession } from '@/lib/auth/session';

export interface FieldDefinition {
  name: string;
  type: string;
  isRequired?: boolean;
  relationTarget?: string;
}

export class AlchemaCore {
  private pool: Pool;

  constructor(pool?: Pool) {
    // If a raw pool is provided (e.g., in tests), use it directly.
    // Otherwise, resolve the pool from the ConnectionManager.
    this.pool = pool || ConnectionManager.getInstance().getCorePool();
  }

  private async logDdlAction(schemaName: string, tableName: string | null, action: string, sql: string) {
    try {
      const session = await getAppSession();
      const caller = session?.user as any;
      SchemaLogger.logDdl({
        tenantId: caller?.tenantId || null,
        userId: caller?.id || null,
        schemaName,
        tableName,
        action,
        sqlExecuted: sql
      });
    } catch (e) {
      SchemaLogger.logDdl({
        schemaName,
        tableName,
        action,
        sqlExecuted: sql
      });
    }
  }

  /**
   * Creates a dedicated schema for a new tenant.
   */
  async createTenantSchema(schemaName: string) {
    const sql = format('CREATE SCHEMA IF NOT EXISTS %I', schemaName);
    const result = await this.pool.query(sql);
    await this.logDdlAction(schemaName, null, 'CREATE_SCHEMA', sql);
    return result;
  }

  /**
   * Creates a physical table within a tenant's schema.
   * Includes standard columns like id, created_at, and updated_at.
   */
  async createTable(schemaName: string, tableName: string, fields: FieldDefinition[] = []) {
    const registry = FieldRegistry.getInstance();
    
    // Base columns
    const columns = [
      'id VARCHAR(30) PRIMARY KEY',
      `tenant_id VARCHAR(30) DEFAULT NULLIF(current_setting('app.current_tenant_id', true), '') NOT NULL`,
      'created_at TIMESTAMPTZ DEFAULT NOW()',
      'updated_at TIMESTAMPTZ DEFAULT NOW()',
      `owner_id VARCHAR(30) DEFAULT NULLIF(current_setting('app.current_user_id', true), '') NOT NULL`,
      `owner_team_id VARCHAR(30) DEFAULT NULLIF(current_setting('app.current_team_id', true), '')`,
      'created_by VARCHAR(30) NULL',
      'updated_by VARCHAR(30) NULL'
    ];

    const constraints: string[] = [];

    // Map through fields using Registry
    for (const field of fields) {
      const plugin = registry.getPlugin(field.type);
      const pgDef = plugin.getPostgresColumnDefinition(field.isRequired);
      // Safe quoting for column name, definition is constructed by plugin
      columns.push(format('%I %s', field.name, pgDef));

      if (field.type === 'relation' && field.relationTarget) {
        const fkName = `fk_${tableName}_${field.name}`;
        constraints.push(format('CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I.%I(id) ON DELETE SET NULL', fkName, field.name, schemaName, field.relationTarget));
      }
    }

    const allDefinitions = [...columns, ...constraints];

    const sql = format(
      `CREATE TABLE %I.%I (
        ${allDefinitions.join(',\n        ')}
      )`,
      schemaName,
      tableName
    );
    await this.pool.query(sql);
    await this.logDdlAction(schemaName, tableName, 'CREATE_TABLE', sql);
 
    // Enable and Force RLS
    await this.pool.query(format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', schemaName, tableName));
    await this.pool.query(format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY', schemaName, tableName));
 
    // Create the Advanced Enterprise RLS policy
    const policySql = format(
      `CREATE POLICY %I ON %I.%I 
       FOR ALL 
       USING (
         tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
         AND (
           owner_id = NULLIF(current_setting('app.current_user_id', true), '')
           OR owner_team_id = NULLIF(current_setting('app.current_team_id', true), '')
           OR EXISTS (
             SELECT 1 FROM core.user_teams ut
             LEFT JOIN core.object_permissions p ON ut.team_id = p.team_id AND p.object_name = %L
             LEFT JOIN core.teams t ON ut.team_id = t.id
             WHERE ut.user_id = NULLIF(current_setting('app.current_user_id', true), '')
             AND t.tenant_id = tenant_id
             AND (p.view_all_data = true OR t.is_system_admin = true)
           )
           OR owner_id IN (
             SELECT user_id FROM core.user_teams ut
             JOIN core.teams t ON ut.team_id = t.id
             WHERE t.parent_id IN (
               SELECT team_id FROM core.user_teams WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')
             )
             AND t.tenant_id = tenant_id
           )
           OR owner_team_id IN (
             SELECT id FROM core.teams 
             WHERE parent_id IN (
               SELECT team_id FROM core.user_teams WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')
             )
             AND tenant_id = tenant_id
           )
         )
       )`,
      `${tableName}_owner_policy`,
      schemaName,
      tableName,
      tableName
    );
    const policyResult = await this.pool.query(policySql);
    await this.logDdlAction(schemaName, tableName, 'CREATE_POLICY', policySql);
    return policyResult;
  }

  /**
   * Adds a new column to an existing table.
   * Maps internal user-friendly data types to native PostgreSQL types via FieldRegistry.
   */
  async addColumn(schemaName: string, tableName: string, field: FieldDefinition) {
    const registry = FieldRegistry.getInstance();
    const plugin = registry.getPlugin(field.type);
    const pgDef = plugin.getPostgresColumnDefinition(field.isRequired);

    // %s is safe here ONLY because it's sourced from a registered plugin
    let sql = format('ALTER TABLE %I.%I ADD COLUMN %I %s', schemaName, tableName, field.name, pgDef);
 
    if (field.type === 'relation' && field.relationTarget) {
      const fkName = `fk_${tableName}_${field.name}`;
      sql += format(', ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I.%I(id) ON DELETE SET NULL', fkName, field.name, schemaName, field.relationTarget);
    }
 
    const result = await this.pool.query(sql);
    await this.logDdlAction(schemaName, tableName, 'ADD_COLUMN', sql);
    return result;
  }

  /**
   * Adds a basic check constraint (e.g., Min, Max, Regex, Enum) to a column.
   */
  async addCheckConstraint(schemaName: string, tableName: string, constraintName: string, columnName: string, ruleType: 'min' | 'max' | 'regex' | 'enum', value: any) {
    let checkCondition = '';
    
    // Construct the condition safely
    if (ruleType === 'min') {
      checkCondition = format('%I >= %L', columnName, value);
    } else if (ruleType === 'max') {
      checkCondition = format('%I <= %L', columnName, value);
    } else if (ruleType === 'regex') {
      checkCondition = format('%I ~ %L', columnName, value);
    } else if (ruleType === 'enum') {
      // Expecting value to be an array for enum
      if (!Array.isArray(value)) {
        throw new Error('Enum validation rule requires an array of values');
      }
      checkCondition = format('%I IN (%L)', columnName, value);
    } else {
      throw new Error(`Unsupported rule type: ${ruleType}`);
    }
    
    const sql = format(
      'ALTER TABLE %I.%I ADD CONSTRAINT %I CHECK (%s)',
      schemaName, 
      tableName, 
      constraintName, 
      checkCondition
    );
    
    const result = await this.pool.query(sql);
    await this.logDdlAction(schemaName, tableName, 'ADD_CONSTRAINT', sql);
    return result;
  }

  /**
   * Removes a column from a table (and cascades to drop any dependent constraints).
   */
  async removeColumn(schemaName: string, tableName: string, columnName: string) {
    const sql = format('ALTER TABLE %I.%I DROP COLUMN %I CASCADE', schemaName, tableName, columnName);
    const result = await this.pool.query(sql);
    await this.logDdlAction(schemaName, tableName, 'DROP_COLUMN', sql);
    return result;
  }

  /**
   * Drops a physical table from a tenant's schema.
   */
  async dropTable(schemaName: string, tableName: string) {
    const sql = format('DROP TABLE IF EXISTS %I.%I CASCADE', schemaName, tableName);
    const result = await this.pool.query(sql);
    await this.logDdlAction(schemaName, tableName, 'DROP_TABLE', sql);
    return result;
  }

  /**
   * Renames an existing column in a table.
   */
  async renameColumn(schemaName: string, tableName: string, oldColumnName: string, newColumnName: string) {
    const sql = format('ALTER TABLE %I.%I RENAME COLUMN %I TO %I', schemaName, tableName, oldColumnName, newColumnName);
    const result = await this.pool.query(sql);
    await this.logDdlAction(schemaName, tableName, 'RENAME_COLUMN', sql);
    return result;
  }
}
