/**
 * TranslatorLayer — the schema/metadata service layer. Every table/field
 * CRUD operation from the admin UI lands here: it translates metadata
 * changes into DDL (via AlchemaCore), keeps Prisma metadata in sync, and
 * manages side-effects such as auto-number sequences, validation CHECK
 * constraints, Expression-field recompute triggers, and layout pruning
 * when a field is deleted.
 */
import format from 'pg-format';
import { db } from '../lib/db';
import { AlchemaCore } from '../core/engine/AlchemaCore';
import { FieldRegistry } from '../core/registry/FieldRegistry';
import {
  analyzeExpression,
  EXPRESSION_RESULT_PG_TYPES,
  expressionResultType,
  type ExpressionResultType,
} from '../core/engine/ComputedFields';

export class TranslatorLayer {
  constructor(private alchemaCore: AlchemaCore) {}

  /**
   * Translates a UI request to create a new Table into DB operations.
   */
  async createTable(
    tenantId: string,
    name: string,
    tableName: string,
    description?: string,
    isSystem: boolean = false,
    nameI18n?: any,
    descriptionI18n?: any,
  ) {
    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: tenantId } });

    // 1. Create the physical table
    // We pass an empty fields array initially. Base columns (id, created_at, updated_at) are added automatically.
    await this.alchemaCore.createTable(tenant.schemaName, tableName, []);

    // 2. Save metadata
    const tableDef = await db.tableDefinition.create({
      data: {
        tenantId,
        name,
        tableName,
        description,
        isSystem,
        ...(nameI18n !== undefined ? { nameI18n } : {}),
        ...(descriptionI18n !== undefined ? { descriptionI18n } : {}),
      },
    });

    // 3. Seed system field definitions for columns that exist on every physical table
    const SYSTEM_FIELDS = [
      { name: 'Created Date', fieldName: 'created_at', physicalType: 'timestamp', logicalType: 'date' },
      { name: 'Last Modified Date', fieldName: 'updated_at', physicalType: 'timestamp', logicalType: 'date' },
      { name: 'Owner', fieldName: 'owner_id', physicalType: 'relation', logicalType: 'user' },
    ];
    for (const sf of SYSTEM_FIELDS) {
      await db.fieldDefinition.create({
        data: {
          tableId: tableDef.id,
          name: sf.name,
          fieldName: sf.fieldName,
          physicalType: sf.physicalType,
          logicalType: sf.logicalType,
          isSystem: true,
          isRequired: false,
        },
      });
    }

    return tableDef;
  }

  /**
   * Removes a Data Model table and its physical table definition.
   */
  async removeTable(tableId: string, bypassSystemGuard: boolean = false) {
    const tableDef = await db.tableDefinition.findUniqueOrThrow({
      where: { id: tableId },
      include: { tenant: true }
    });

    if (tableDef.isSystem && !bypassSystemGuard) {
      throw new Error('Operation Denied: System data models are managed by the platform and cannot be deleted.');
    }

    try {
      await this.alchemaCore.dropTable(tableDef.tenant.schemaName, tableDef.tableName);
    } catch (e) {
      console.warn('Physical table drop skipped or failed:', e);
    }

    await db.tableDefinition.delete({
      where: { id: tableId }
    });

    return true;
  }

  /**
   * Updates a Data Model name and description.
   */
  async updateTable(tableId: string, name: string, description?: string, nameI18n?: any, descriptionI18n?: any) {
    return await db.tableDefinition.update({
      where: { id: tableId },
      data: {
        name,
        description,
        ...(nameI18n !== undefined ? { nameI18n } : {}),
        ...(descriptionI18n !== undefined ? { descriptionI18n } : {}),
      },
    });
  }

  /**
   * Translates a UI request to add a new Field into DB operations.
   */
  async addFieldDef(
    tableId: string,
    name: string,
    fieldName: string,
    physicalType: string,
    logicalType: string,
    config: any = null,
    isRequired: boolean = false,
    description: string | null = null,
    isSystem: boolean = false,
    nameI18n?: any,
    descriptionI18n?: any,
  ) {
    const tableDef = await db.tableDefinition.findUniqueOrThrow({
      where: { id: tableId },
      include: { tenant: true }
    });

    // 0. Expression fields: validate the JSONata formula and derive
    //    cross-model dependencies BEFORE any DDL is executed.
    let expressionDependencies: { targetTable: string; relationField: string; reverse?: boolean }[] = [];
    let expressionReferencedFields: string[] = [];
    let expressionWarnings: string[] = [];
    if (logicalType === 'expression') {
      const existing = await db.fieldDefinition.findMany({ where: { tableId } });
      const analysis = analyzeExpression(
        config?.expression,
        [...existing, { fieldName, logicalType, config, physicalType }] as any[]
      );
      if (!analysis.ok) {
        throw new Error(analysis.error);
      }
      expressionDependencies = analysis.dependencies || [];
      expressionReferencedFields = analysis.referencedFields || [];
      expressionWarnings = analysis.warnings || [];
    }

    // Parse relationTarget if the type is relation
    let relationTarget: string | undefined;
    if (physicalType === 'relation' && config && config.targetTable) {
      relationTarget = config.targetTable;
    }

    // 1. Create the physical column using AlchemaCore and the Registry
    await this.alchemaCore.addColumn(tableDef.tenant.schemaName, tableDef.tableName, {
      name: fieldName,
      type: logicalType || physicalType,
      isRequired: isRequired,
      relationTarget: relationTarget
    });

    // 1a. Expression fields are stored as the configured result type.
    if (logicalType === 'expression') {
      const resultType = (config?.resultType || 'text') as ExpressionResultType;
      const pgDef = EXPRESSION_RESULT_PG_TYPES[resultType];
      if (pgDef) {
        await this.alchemaCore.alterColumnType(tableDef.tenant.schemaName, tableDef.tableName, fieldName, pgDef);
      }
    }

    // 1b. If logicalType is auto_number, setup PostgreSQL sequence and dynamic DEFAULT expression
    if (logicalType === 'auto_number') {
      await this.alchemaCore.setupAutoNumberColumn(tableDef.tenant.schemaName, tableDef.tableName, fieldName, config);
    }

    // 2. Save metadata
    const fieldDef = await db.fieldDefinition.create({
      data: {
        tableId,
        name,
        fieldName,
        physicalType,
        logicalType,
        config: config ? { ...config, dependencies: expressionDependencies, referencedFields: expressionReferencedFields } : undefined,
        isRequired,
        isSystem,
        description,
        ...(nameI18n !== undefined ? { nameI18n } : {}),
        ...(descriptionI18n !== undefined ? { descriptionI18n } : {}),
      },
    });

    // 2a. Expression fields: wire recompute triggers on referenced tables and
    //     queue a full-table recompute so existing records get their values.
    if (logicalType === 'expression') {
      const tenantSchema = tableDef.tenant.schemaName;
      for (const dep of expressionDependencies) {
        if (dep.reverse) {
          // Rollup ($related): the FK lives on the referenced (child) table.
          await this.alchemaCore.ensureComputedReverseTrigger(
            tenantSchema, dep.targetTable, tenantSchema, tableDef.tableName, dep.relationField
          );
        } else {
          await this.alchemaCore.ensureComputedTrigger(
            tenantSchema,
            dep.targetTable,
            tenantSchema,
            tableDef.tableName,
            dep.relationField
          );
        }
      }
      if (expressionWarnings.length > 0) {
        console.warn(`[ExpressionField] ${name}: ${expressionWarnings.join('; ')}`);
      }
      await this.alchemaCore.enqueueFullTableRecompute(tenantSchema, tableDef.tableName);
    }

    // 3. Add CHECK constraints if required
    if (isRequired && (physicalType === 'text' || physicalType === 'short_text')) {
        await this.alchemaCore.addCheckConstraint(
            tableDef.tenant.schemaName, 
            tableDef.tableName, 
            `${fieldName}_required_chk`, 
            fieldName, 
            'min', 
            1 
        );
    }

    return fieldDef;
  }

  /**
   * Translates a UI request to rename a Field into DB operations.
   */
  async renameFieldDef(fieldId: string, newName: string, newFieldName: string) {
    const fieldDef = await db.fieldDefinition.findUniqueOrThrow({
      where: { id: fieldId },
      include: { table: { include: { tenant: true } } }
    });

    const tenantSchema = fieldDef.table.tenant.schemaName;
    const tableName = fieldDef.table.tableName;
    const oldFieldName = fieldDef.fieldName;

    // 1. Rename the physical column if the DB column name is actually changing
    if (oldFieldName !== newFieldName) {
      await this.alchemaCore.renameColumn(tenantSchema, tableName, oldFieldName, newFieldName);
    }

    // 2. Update metadata
    const updatedField = await db.fieldDefinition.update({
      where: { id: fieldId },
      data: {
        name: newName,
        fieldName: newFieldName,
      },
    });

    return updatedField;
  }

  /**
   * Updates field definition metadata, executes pre-save data audits, renames column, and alters column type.
   */
  async updateFieldDef(
    fieldId: string, 
    data: { 
      name?: string;
      fieldName?: string;
      description?: string | null;
      nameI18n?: any;
      descriptionI18n?: any;
      isRequired?: boolean;
      logicalType?: string;
      config?: any
    },
    bypassSystemGuard: boolean = false
  ) {
    const fieldDef = await db.fieldDefinition.findUniqueOrThrow({
      where: { id: fieldId },
      include: { table: { include: { tenant: true } } }
    });

    if (fieldDef.isSystem && !bypassSystemGuard) {
      throw new Error('Operation Denied: System fields are managed by the platform and cannot be modified.');
    }

    const tenantSchema = fieldDef.table.tenant.schemaName;
    const tableName = fieldDef.table.tableName;
    const oldFieldName = fieldDef.fieldName;
    const targetFieldName = data.fieldName || oldFieldName;
    const targetLogicalType = data.logicalType || fieldDef.logicalType;
    const targetIsRequired = data.isRequired !== undefined ? data.isRequired : fieldDef.isRequired;

    const registry = FieldRegistry.getInstance();
    const targetPlugin = registry.getPlugin(targetLogicalType);
    const targetPhysicalType = targetPlugin.physicalType;

    // 1. Audit Table Row Count
    const countResult = await this.alchemaCore.getPool().query(
      format('SELECT COUNT(*)::int as cnt FROM %I.%I', tenantSchema, tableName)
    );
    const rowCount = countResult.rows[0]?.cnt || 0;

    if (rowCount > 0) {
      // 2. Pre-Save Audit A: Nullability Audit (Setting to NOT NULL when NULLs exist)
      if (targetIsRequired && !fieldDef.isRequired) {
        const nullResult = await this.alchemaCore.getPool().query(
          format('SELECT COUNT(*)::int as null_cnt FROM %I.%I WHERE %I IS NULL', tenantSchema, tableName, oldFieldName)
        );
        const nullCount = nullResult.rows[0]?.null_cnt || 0;
        if (nullCount > 0) {
          throw new Error(
            `Cannot set field '${data.name || fieldDef.name}' to Required because ${nullCount} existing record(s) contain NULL values. Please update existing records first.`
          );
        }
      }

      // 3. Pre-Save Audit B: Type Compatibility & Character Regex Audit
      if (targetLogicalType !== fieldDef.logicalType) {
        // Converting text to numeric / currency / percentage
        if (['number', 'currency', 'percentage'].includes(targetLogicalType) || targetPhysicalType === 'number') {
          const invResult = await this.alchemaCore.getPool().query(
            format(
              "SELECT COUNT(*)::int as inv_cnt FROM %I.%I WHERE %I IS NOT NULL AND %I::text !~ '^-?[0-9]+(\\.[0-9]+)?$'",
              tenantSchema,
              tableName,
              oldFieldName,
              oldFieldName
            )
          );
          const invCount = invResult.rows[0]?.inv_cnt || 0;
          if (invCount > 0) {
            throw new Error(
              `Cannot convert field '${fieldDef.name}' to ${targetPlugin.label} because ${invCount} existing record(s) contain non-numeric characters.`
            );
          }
        }

        // Converting text to boolean
        if (targetLogicalType === 'boolean') {
          const invResult = await this.alchemaCore.getPool().query(
            format(
              "SELECT COUNT(*)::int as inv_cnt FROM %I.%I WHERE %I IS NOT NULL AND LOWER(%I::text) NOT IN ('true', 'false', '1', '0', 't', 'f')",
              tenantSchema,
              tableName,
              oldFieldName,
              oldFieldName
            )
          );
          const invCount = invResult.rows[0]?.inv_cnt || 0;
          if (invCount > 0) {
            throw new Error(
              `Cannot convert field '${fieldDef.name}' to Boolean because ${invCount} existing record(s) contain invalid boolean values.`
            );
          }
        }

        // Converting long_text to short_text
        if (targetLogicalType === 'short_text' && fieldDef.logicalType === 'long_text') {
          const lenResult = await this.alchemaCore.getPool().query(
            format('SELECT MAX(LENGTH(%I::text))::int as max_len FROM %I.%I', oldFieldName, tenantSchema, tableName)
          );
          const maxLen = lenResult.rows[0]?.max_len || 0;
          if (maxLen > 255) {
            throw new Error(
              `Cannot convert to Short Text because existing data contains text up to ${maxLen} characters long (exceeds 255 character limit).`
            );
          }
        }
      }
    }

    // 4. Rename physical column if fieldName changed
    if (data.fieldName && data.fieldName !== oldFieldName) {
      await this.alchemaCore.renameColumn(tenantSchema, tableName, oldFieldName, data.fieldName);
    }

    // 5. Alter column type in PostgreSQL if logical type changed
    if (targetLogicalType !== fieldDef.logicalType) {
      const pgDef = targetPlugin.getPostgresColumnDefinition(targetIsRequired);
      await this.alchemaCore.alterColumnType(tenantSchema, tableName, targetFieldName, pgDef);
    }

    // 5b. Expression fields: validate the formula and keep the result-type
    //     physical column in sync when resultType changes.
    const wasExpression = fieldDef.logicalType === 'expression';
    const isExpression = targetLogicalType === 'expression';
    let newExpressionDeps: { targetTable: string; relationField: string }[] =
      ((fieldDef.config as any)?.dependencies) || [];
    let newExpressionRefs: string[] = ((fieldDef.config as any)?.referencedFields) || [];

    if (isExpression) {
      const expression =
        data.config?.expression !== undefined
          ? String(data.config.expression)
          : (fieldDef.config as any)?.expression;
      const tableFields = await db.fieldDefinition.findMany({ where: { tableId: fieldDef.tableId } });
      const analysis = analyzeExpression(expression, tableFields as any[]);
      if (!analysis.ok) {
        throw new Error(analysis.error);
      }
      newExpressionDeps = analysis.dependencies || [];
      newExpressionRefs = analysis.referencedFields || [];
      if (analysis.warnings?.length) {
        console.warn(`[ExpressionField] ${data.name || fieldDef.name}: ${analysis.warnings.join('; ')}`);
      }

      const newResultType = (data.config?.resultType as ExpressionResultType) || expressionResultType(fieldDef);
      const currentResultType = expressionResultType(fieldDef);
      if (newResultType !== currentResultType) {
        const pgDef = EXPRESSION_RESULT_PG_TYPES[newResultType];
        if (pgDef) {
          await this.alchemaCore.alterColumnType(tenantSchema, tableName, targetFieldName, pgDef);
        }
      }
    }

    // 6. Update metadata in Prisma
    const updatedField = await db.fieldDefinition.update({
      where: { id: fieldId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.fieldName !== undefined && { fieldName: data.fieldName }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.nameI18n !== undefined && { nameI18n: data.nameI18n }),
        ...(data.descriptionI18n !== undefined && { descriptionI18n: data.descriptionI18n }),
        ...(data.isRequired !== undefined && { isRequired: data.isRequired }),
        ...(data.logicalType !== undefined && { 
          logicalType: data.logicalType,
          physicalType: targetPhysicalType
        }),
        ...(data.config !== undefined && { config: { ...((fieldDef.config as any) || {}), ...(data.config as any) } }),
        ...(isExpression && { config: { ...((fieldDef.config as any) || {}), ...(data.config as any), dependencies: newExpressionDeps, referencedFields: newExpressionRefs } })
      }
    });

    // 7. Expression fields: sync recompute triggers on referenced tables and
    //    queue a full-table recompute so all rows get fresh values.
    if (wasExpression || isExpression) {
      const oldDeps: { targetTable: string; relationField: string; reverse?: boolean }[] =
        ((fieldDef.config as any)?.dependencies) || [];
      const specKey = (d: { targetTable: string; relationField: string; reverse?: boolean }) =>
        `${d.reverse ? 'rev' : 'fwd'}:${d.relationField}:${d.targetTable}`;
      const oldSpecs = new Set(oldDeps.map(specKey));
      const newSpecs = new Set(newExpressionDeps.map(specKey));

      const ensureDep = async (dep: any) => {
        if (dep.reverse) {
          await this.alchemaCore.ensureComputedReverseTrigger(tenantSchema, dep.targetTable, tenantSchema, tableName, dep.relationField);
        } else {
          await this.alchemaCore.ensureComputedTrigger(tenantSchema, dep.targetTable, tenantSchema, tableName, dep.relationField);
        }
      };
      const dropDep = async (dep: any) => {
        if (dep.reverse) {
          await this.alchemaCore.dropComputedReverseTrigger(tenantSchema, dep.targetTable, tableName, dep.relationField);
        } else {
          await this.alchemaCore.dropComputedTrigger(tenantSchema, dep.targetTable, tableName, dep.relationField);
        }
      };

      if (!isExpression) {
        await this.dropDependencyTriggersIfUnused(fieldDef.table, oldDeps, fieldId);
      } else {
        for (const dep of newExpressionDeps) {
          if (!oldSpecs.has(specKey(dep))) await ensureDep(dep);
        }
        for (const dep of oldDeps) {
          if (!newSpecs.has(specKey(dep))) await dropDep(dep);
        }
        await this.alchemaCore.enqueueFullTableRecompute(tenantSchema, tableName);
      }
    }

    return updatedField;
  }

  /**
   * Drops recompute triggers for dependency specs — but only when no OTHER
   * expression field on the same table still needs the same relationship.
   */
  private async dropDependencyTriggersIfUnused(
    tableDef: any,
    dependencies: { targetTable: string; relationField: string; reverse?: boolean }[],
    excludeFieldId: string
  ) {
    if (!dependencies || dependencies.length === 0) return;
    const others = await db.fieldDefinition.findMany({
      where: { tableId: tableDef.id, id: { not: excludeFieldId } }
    });
    const specKey = (d: { targetTable: string; relationField: string; reverse?: boolean }) =>
      `${d.reverse ? 'rev' : 'fwd'}:${d.relationField}:${d.targetTable}`;
    const stillUsed = new Set<string>();
    for (const f of others) {
      for (const d of ((f.config as any)?.dependencies) || []) {
        stillUsed.add(specKey(d));
      }
    }
    const tenantSchema = tableDef.tenant.schemaName;
    for (const dep of dependencies) {
      if (stillUsed.has(specKey(dep))) continue;
      if (dep.reverse) {
        await this.alchemaCore.dropComputedReverseTrigger(tenantSchema, dep.targetTable, tableDef.tableName, dep.relationField);
      } else {
        await this.alchemaCore.dropComputedTrigger(tenantSchema, dep.targetTable, tableDef.tableName, dep.relationField);
      }
    }
  }

  /**
   * Translates a UI request to remove a Field into DB operations.
   */
  async removeFieldDef(fieldId: string, bypassSystemGuard: boolean = false) {
    const fieldDef = await db.fieldDefinition.findUniqueOrThrow({
      where: { id: fieldId },
      include: { table: { include: { tenant: true } } }
    });

    if (fieldDef.isSystem && !bypassSystemGuard) {
      throw new Error('Operation Denied: System fields are managed by the platform and cannot be deleted.');
    }

    const tenantSchema = fieldDef.table.tenant.schemaName;
    const tableName = fieldDef.table.tableName;
    const fieldName = fieldDef.fieldName;

    // 0. Expression guards:
    //    a) A field referenced by an Expression formula cannot be deleted.
    //    b) Deleting an Expression field drops its recompute triggers.
    const expressionRefs = await db.fieldDefinition.findMany({
      where: { tableId: fieldDef.tableId, logicalType: 'expression', id: { not: fieldId } }
    });

    for (const f of expressionRefs) {
      const refs: string[] = ((f.config as any)?.referencedFields) || [];
      if (refs.includes(fieldName)) {
        throw new Error(
          `Cannot delete field '${fieldDef.name}': it is referenced by the Expression field '${f.name}'. Remove the reference from the formula first.`
        );
      }
    }

    // 1. Drop the physical column (this will also cascade drop constraints in PG)
    await this.alchemaCore.removeColumn(tenantSchema, tableName, fieldName);

    // 2. Delete metadata (Rules connected to this field will be cascade deleted by Prisma)
    await db.fieldDefinition.delete({
      where: { id: fieldId }
    });

    // 2b. Prune every layout of this table so removed fields never leave
    //     orphaned blocks/columns (the cause of blank gaps in forms and lists).
    await this.pruneLayoutsOfDeletedField(fieldDef.tableId, fieldId, fieldName);

    // 3. Expression field deleted — clean up its recompute triggers.
    if (fieldDef.logicalType === 'expression') {
      const oldDeps: { targetTable: string; relationField: string }[] =
        ((fieldDef.config as any)?.dependencies) || [];
      await this.dropDependencyTriggersIfUnused(fieldDef.table, oldDeps, fieldId);
    }

    return true;
  }

  /**
   * Strips every reference to a deleted field from the table's layouts:
   *  - field blocks (top-level and inside tab groups),
   *  - related-list blocks whose FK field matches,
   *  - LIST columns,
   *  - block conditions/validations,
   *  - the recordTitleField setting.
   * Rewrites both `config` and `publishedConfig` (JSON columns).
   */
  private async pruneLayoutsOfDeletedField(tableId: string, fieldId: string, fieldName: string) {
    const layouts = await db.tableLayout.findMany({ where: { tableId } });
    if (layouts.length === 0) return;

    const referencesField = (v: any): boolean => v === fieldId || v === fieldName;

    const pruneBlock = (block: any): any => {
      if (!block || typeof block !== 'object') return null;
      if (block.blockType === 'field') {
        if (block.fieldId && referencesField(block.fieldId)) return null;
      }
      if (block.blockType === 'related_list') {
        if (block.relatedFieldName && referencesField(block.relatedFieldName)) return null;
      }
      if (block.conditions && Array.isArray(block.conditions)) {
        block.conditions = block.conditions.filter((c: any) => !(c.fieldId && referencesField(c.fieldId)));
      }
      if (block.validations && Array.isArray(block.validations)) {
        block.validations = block.validations.filter((v: any) => !(v.fieldId && referencesField(v.fieldId)));
      }
      if (block.blockType === 'tab_group' && Array.isArray(block.tabs)) {
        for (const tab of block.tabs) {
          if (tab && Array.isArray(tab.blocks)) {
            tab.blocks = tab.blocks.map(pruneBlock).filter(Boolean);
          }
        }
      }
      return block;
    };

    const pruneConfig = (raw: any): any => {
      if (!raw || typeof raw !== 'object') return raw;
      const config = Array.isArray(raw) ? { blocks: raw } : { ...raw };

      if (Array.isArray(config.blocks)) {
        config.blocks = config.blocks.map(pruneBlock).filter(Boolean);
      }
      if (Array.isArray(config.columns)) {
        config.columns = config.columns.filter(
          (c: any) => !(c.fieldId && referencesField(c.fieldId))
        );
      }
      if (config.recordTitleField && referencesField(config.recordTitleField)) {
        config.recordTitleField = null;
      }
      return config;
    };

    // Deep-clone before pruning: pruneBlock mutates block objects in place,
    // and the change-detection below compares JSON strings against the
    // untouched original — a shallow copy would "mutate both sides" and make
    // every comparison equal, silently skipping the DB write.
    const deepClone = (raw: any): any => JSON.parse(JSON.stringify(raw));

    for (const layout of layouts) {
      const updates: any = {};
      if (layout.config) {
        const next = pruneConfig(deepClone(layout.config));
        if (JSON.stringify(next) !== JSON.stringify(layout.config)) updates.config = next;
      }
      if (layout.publishedConfig) {
        const next = pruneConfig(deepClone(layout.publishedConfig));
        if (JSON.stringify(next) !== JSON.stringify(layout.publishedConfig)) updates.publishedConfig = next;
      }
      if (Object.keys(updates).length > 0) {
        await db.tableLayout.update({ where: { id: layout.id }, data: updates });
      }
    }
  }
  
  /**
   * Adds a validation rule to a field and enforces it in the DB.
   */
  async addValidationRule(fieldId: string, ruleType: 'min' | 'max' | 'regex' | 'enum', ruleDefinition: string, errorMessage?: string, errorMessageI18n?: any) {
    const fieldDef = await db.fieldDefinition.findUniqueOrThrow({
      where: { id: fieldId },
      include: { table: { include: { tenant: true } } }
    });

    const tenantSchema = fieldDef.table.tenant.schemaName;
    const tableName = fieldDef.table.tableName;
    const fieldName = fieldDef.fieldName;
    const constraintName = `${fieldName}_${ruleType}_${fieldId.slice(0, 8)}_chk`;

    // 1. Save metadata
    const rule = await db.validationRule.create({
      data: {
        tableId: fieldDef.tableId,
        fieldId,
        ruleType,
        ruleDefinition,
        errorMessage,
        ...(errorMessageI18n !== undefined ? { errorMessageI18n } : {}),
      }
    });

    // 2. Parse value for DB engine (Enums are stored as JSON strings)
    let dbValue: any = ruleDefinition;
    if (ruleType === 'enum') {
      try {
        dbValue = JSON.parse(ruleDefinition);
      } catch (e) {
        throw new Error('Enum rule definition must be a valid JSON array');
      }
    }

    // 3. Add physical constraint
    await this.alchemaCore.addCheckConstraint(
      tenantSchema,
      tableName,
      constraintName,
      fieldName,
      ruleType,
      dbValue
    );

    return rule;
  }

  /**
   * Resets sequence counter for an Auto Number field.
   */
  async resetFieldSequence(fieldId: string, nextValue: number = 1) {
    const fieldDef = await db.fieldDefinition.findUniqueOrThrow({
      where: { id: fieldId },
      include: { table: { include: { tenant: true } } }
    });

    if (fieldDef.logicalType !== 'auto_number') {
      throw new Error(`Field '${fieldDef.name}' is not an Auto Number field.`);
    }

    const tenantSchema = fieldDef.table.tenant.schemaName;
    const tableName = fieldDef.table.tableName;
    const fieldName = fieldDef.fieldName;

    await this.alchemaCore.resetSequence(tenantSchema, tableName, fieldName, nextValue);

    const updatedConfig = {
      ...(fieldDef.config as any || {}),
      startingNumber: nextValue
    };

    return await db.fieldDefinition.update({
      where: { id: fieldId },
      data: { config: updatedConfig }
    });
  }
}
