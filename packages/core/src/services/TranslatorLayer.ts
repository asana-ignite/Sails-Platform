import format from 'pg-format';
import { db } from '../lib/db';
import { AlchemaCore } from '../core/engine/AlchemaCore';
import { FieldRegistry } from '../core/registry/FieldRegistry';

export class TranslatorLayer {
  constructor(private alchemaCore: AlchemaCore) {}

  /**
   * Translates a UI request to create a new Table into DB operations.
   */
  async createTable(tenantId: string, name: string, tableName: string, description?: string, isSystem: boolean = false) {
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
      },
    });

    // 3. Seed system field definitions for columns that exist on every physical table
    const SYSTEM_FIELDS = [
      { name: 'Created Date', fieldName: 'created_at', physicalType: 'timestamp', logicalType: 'date' },
      { name: 'Last Modified Date', fieldName: 'updated_at', physicalType: 'timestamp', logicalType: 'date' },
      { name: 'Owner', fieldName: 'owner_id', physicalType: 'lookup', logicalType: 'lookup' },
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
  async updateTable(tableId: string, name: string, description?: string) {
    return await db.tableDefinition.update({
      where: { id: tableId },
      data: { name, description }
    });
  }

  /**
   * Translates a UI request to add a new Field into DB operations.
   */
  async addFieldDef(tableId: string, name: string, fieldName: string, physicalType: string, logicalType: string, config: any = null, isRequired: boolean = false, description: string | null = null, isSystem: boolean = false) {
    const tableDef = await db.tableDefinition.findUniqueOrThrow({
      where: { id: tableId },
      include: { tenant: true }
    });

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
        config: config ? config : undefined,
        isRequired,
        isSystem,
        description
      },
    });

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

    // 6. Update metadata in Prisma
    const updatedField = await db.fieldDefinition.update({
      where: { id: fieldId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.fieldName !== undefined && { fieldName: data.fieldName }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.isRequired !== undefined && { isRequired: data.isRequired }),
        ...(data.logicalType !== undefined && { 
          logicalType: data.logicalType,
          physicalType: targetPhysicalType
        }),
        ...(data.config !== undefined && { config: data.config })
      }
    });

    return updatedField;
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

    // 1. Drop the physical column (this will also cascade drop constraints in PG)
    await this.alchemaCore.removeColumn(tenantSchema, tableName, fieldName);

    // 2. Delete metadata (Rules connected to this field will be cascade deleted by Prisma)
    await db.fieldDefinition.delete({
      where: { id: fieldId }
    });

    return true;
  }
  
  /**
   * Adds a validation rule to a field and enforces it in the DB.
   */
  async addValidationRule(fieldId: string, ruleType: 'min' | 'max' | 'regex' | 'enum', ruleDefinition: string, errorMessage?: string) {
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
        errorMessage
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
