import { db } from '../lib/db';
import { AlchemaCore } from '../core/engine/AlchemaCore';

export class TranslatorLayer {
  constructor(private alchemaCore: AlchemaCore) {}

  /**
   * Translates a UI request to create a new Table into DB operations.
   */
  async createTable(tenantId: string, name: string, tableName: string, description?: string) {
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
      },
    });

    return tableDef;
  }

  /**
   * Removes a Data Model table and its physical table definition.
   */
  async removeTable(tableId: string) {
    const tableDef = await db.tableDefinition.findUniqueOrThrow({
      where: { id: tableId },
      include: { tenant: true }
    });

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
  async addFieldDef(tableId: string, name: string, fieldName: string, physicalType: string, logicalType: string, config: any = null, isRequired: boolean = false, description: string | null = null) {
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
      type: physicalType,
      isRequired: isRequired,
      relationTarget: relationTarget
    });

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
   * Translates a UI request to remove a Field into DB operations.
   */
  async removeFieldDef(fieldId: string) {
    const fieldDef = await db.fieldDefinition.findUniqueOrThrow({
      where: { id: fieldId },
      include: { table: { include: { tenant: true } } }
    });

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
}
