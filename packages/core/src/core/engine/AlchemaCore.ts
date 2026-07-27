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

  public getPool(): Pool {
    return this.pool;
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
             SELECT 1 FROM core.object_permissions p
             WHERE p.object_name = %L
             AND (
               p.team_id IN (SELECT team_id FROM core.user_teams WHERE user_id = NULLIF(current_setting('app.current_user_id', true), ''))
               OR p.team_id IN (SELECT tp.team_id FROM core.position_slots ps JOIN core.team_positions tp ON ps.position_id = tp.position_id WHERE ps.user_id = NULLIF(current_setting('app.current_user_id', true), ''))
               OR p.user_id = NULLIF(current_setting('app.current_user_id', true), '')
               OR p.position_id IN (SELECT position_id FROM core.position_slots WHERE user_id = NULLIF(current_setting('app.current_user_id', true), ''))
             )
             AND (
               p.read_scope = 'TEAM' OR p.read_scope = 'HIERARCHY'
             )
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

  /**
   * Alters an existing column's data type using an explicit USING cast expression.
   */
  async alterColumnType(schemaName: string, tableName: string, columnName: string, newPgDataType: string) {
    const rawType = newPgDataType.replace(/\s+NOT\s+NULL/gi, '').replace(/\s+NULL/gi, '').trim();
    const sql = format(
      'ALTER TABLE %I.%I ALTER COLUMN %I TYPE %s USING %I::%s',
      schemaName,
      tableName,
      columnName,
      rawType,
      columnName,
      rawType
    );
    const result = await this.pool.query(sql);
    await this.logDdlAction(schemaName, tableName, 'ALTER_COLUMN_TYPE', sql);
    return result;
  }

  /**
   * Helper to create a sequence and set dynamic DEFAULT expression on an auto_number column.
   */
  async setupAutoNumberColumn(schemaName: string, tableName: string, fieldName: string, config?: any) {
    const seqName = `${tableName}_${fieldName}_seq`;
    const startingNumber = Math.max(Number(config?.startingNumber) || 1, 1);

    // 1. Create sequence
    const createSeqSql = format(
      'CREATE SEQUENCE IF NOT EXISTS %I.%I START WITH %s',
      schemaName,
      seqName,
      startingNumber
    );
    await this.pool.query(createSeqSql);
    await this.logDdlAction(schemaName, tableName, 'CREATE_SEQUENCE', createSeqSql);

    // 2. Build DEFAULT expression with date tokens support
    const defaultExpr = buildAutoNumberSqlExpression(schemaName, seqName, config);

    // 3. Apply DEFAULT expression to column
    const setDefaultSql = format(
      'ALTER TABLE %I.%I ALTER COLUMN %I SET DEFAULT %s',
      schemaName,
      tableName,
      fieldName,
      defaultExpr
    );
    await this.pool.query(setDefaultSql);
    await this.logDdlAction(schemaName, tableName, 'SET_COLUMN_DEFAULT', setDefaultSql);
  }

  /**
   * Resets an auto_number sequence counter to a specified value.
   */
  async resetSequence(schemaName: string, tableName: string, fieldName: string, nextValue: number = 1) {
    const seqName = `${tableName}_${fieldName}_seq`;
    const targetValue = Math.max(Number(nextValue) || 1, 1);

    const resetSql = format(
      'ALTER SEQUENCE %I.%I RESTART WITH %s',
      schemaName,
      seqName,
      targetValue
    );
    await this.pool.query(resetSql);
    await this.logDdlAction(schemaName, tableName, 'RESET_SEQUENCE', resetSql);
  }
}

/**
 * Parses pattern string like "INV-0000" or "INV-{yyyy}{mm}00000" or "REQ-{YYYY}-000-US"
 * into prefix, zero-padding digits, and suffix.
 */
export function parseAutoNumberPattern(patternStr: string, fallbackDigits: number = 5): { prefix: string; digits: number; suffix: string } {
  if (!patternStr) {
    return { prefix: '', digits: fallbackDigits, suffix: '' };
  }

  // Normalize casing for date tokens
  let normalized = patternStr
    .replace(/\{yyyy\}/gi, '{YYYY}')
    .replace(/\{yy\}/gi, '{YY}')
    .replace(/\{mm\}/gi, '{MM}')
    .replace(/\{dd\}/gi, '{DD}');

  // Find zero placeholder sequence (0+)
  const zeroMatch = normalized.match(/(0+)/);

  if (zeroMatch && zeroMatch.index !== undefined) {
    const zeroIndex = zeroMatch.index;
    const zeroLen = zeroMatch[0].length;
    const prefix = normalized.substring(0, zeroIndex);
    const suffix = normalized.substring(zeroIndex + zeroLen);
    return {
      prefix,
      digits: Math.min(Math.max(zeroLen, 1), 10),
      suffix
    };
  }

  return {
    prefix: normalized,
    digits: Math.min(Math.max(fallbackDigits, 1), 10),
    suffix: ''
  };
}

/**
 * Builds PostgreSQL DEFAULT SQL string expression for auto_number columns.
 * Supports date tokens: {YYYY}, {YY}, {MM}, {DD} and auto-detects zero padding from pattern.
 */
export function buildAutoNumberSqlExpression(schemaName: string, seqName: string, config?: any): string {
  const patternInput = config?.pattern || config?.format || config?.prefix || '';
  const explicitDigits = config?.digits ? Number(config.digits) : undefined;

  let prefix = config?.prefix || '';
  let suffix = config?.suffix || '';
  let digits = explicitDigits || 5;

  if (patternInput && (patternInput.includes('0') || patternInput.includes('{'))) {
    const parsed = parseAutoNumberPattern(patternInput, digits);
    prefix = parsed.prefix;
    digits = explicitDigits || parsed.digits;
    suffix = parsed.suffix || (config?.suffix || '');
  }

  function parsePatternToSql(pattern: string): string[] {
    if (!pattern) return [];
    
    const normalized = pattern
      .replace(/\{yyyy\}/gi, '{YYYY}')
      .replace(/\{yy\}/gi, '{YY}')
      .replace(/\{mm\}/gi, '{MM}')
      .replace(/\{dd\}/gi, '{DD}');

    const regex = /(\{YYYY\}|\{YY\}|\{MM\}|\{DD\})/g;
    const parts: string[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(normalized)) !== null) {
      if (match.index > lastIndex) {
        const literal = normalized.substring(lastIndex, match.index);
        parts.push(format('%L', literal));
      }
      const token = match[0];
      if (token === '{YYYY}') parts.push("TO_CHAR(CURRENT_DATE, 'YYYY')");
      else if (token === '{YY}') parts.push("TO_CHAR(CURRENT_DATE, 'YY')");
      else if (token === '{MM}') parts.push("TO_CHAR(CURRENT_DATE, 'MM')");
      else if (token === '{DD}') parts.push("TO_CHAR(CURRENT_DATE, 'DD')");
      
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < normalized.length) {
      const literal = normalized.substring(lastIndex);
      parts.push(format('%L', literal));
    }

    return parts;
  }

  const prefixSqlParts = parsePatternToSql(prefix);
  const suffixSqlParts = parsePatternToSql(suffix);

  const seqSqlPart = format("LPAD(nextval(%L)::text, %s, '0')", `${schemaName}.${seqName}`, digits);

  const allParts = [...prefixSqlParts, seqSqlPart, ...suffixSqlParts];
  return `(${allParts.join(' || ')})`;
}
