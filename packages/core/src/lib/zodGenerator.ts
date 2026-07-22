import { z } from 'zod';
import { FieldRegistry } from '../core/registry/FieldRegistry';

export function generateZodSchema(fields: any[]) {
  const schemaFields: Record<string, any> = {};
  const registry = FieldRegistry.getInstance();

  fields.forEach((field) => {
    // 1. Base Type mapping via Plugin Registry
    const plugin = registry.getPlugin(field.logicalType || field.physicalType || field.type);
    let fieldSchema = plugin.getZodSchema ? plugin.getZodSchema(field.isRequired) : z.any();

    // 2. Handle Optionality
    if (!field.isRequired) {
      fieldSchema = fieldSchema.optional().nullable();
    }

    // 3. Apply Rules (if they exist)
    if (field.rules && Array.isArray(field.rules)) {
      field.rules.forEach((rule: any) => {
        if (rule.ruleType === 'min') {
          fieldSchema = (fieldSchema as any).min(Number(rule.ruleDefinition), rule.errorMessage || undefined);
        } else if (rule.ruleType === 'max') {
          fieldSchema = (fieldSchema as any).max(Number(rule.ruleDefinition), rule.errorMessage || undefined);
        } else if (rule.ruleType === 'regex') {
          fieldSchema = (fieldSchema as any).regex(new RegExp(rule.ruleDefinition), rule.errorMessage || undefined);
        } else if (rule.ruleType === 'enum') {
          try {
            const values = JSON.parse(rule.ruleDefinition);
            if (Array.isArray(values)) {
                fieldSchema = z.enum(values as [string, ...string[]], {
                    errorMap: () => ({ message: rule.errorMessage || `Value must be one of: ${values.join(', ')}` })
                });
            }
          } catch (e) {
            console.warn('Invalid enum definition in metadata:', rule.ruleDefinition);
          }
        }
      });
    }

    schemaFields[field.fieldName] = fieldSchema;
  });

  return z.object(schemaFields);
}
