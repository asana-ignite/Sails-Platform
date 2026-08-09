import { db } from '@/lib/db';
import type { SessionContext } from '@/lib/auth/session';
import { FilterGroupRule } from './QueryLayer';
import { resolveContextMacro, WorkflowMacroCtx } from './contextMacros';

/**
 * Resolve a workflow value reference (from QueryStudio's 'Workflow' source,
 * e.g. `{{requestor.name}}`, `{{record.customer}}`, `{{list_invoices.0.amount}}`,
 * `{{request_date}}`) against the workflow context. Returns null when the ref
 * can't be resolved — the caller drops the rule.
 */
export function resolveWorkflowRef(ref: string, wfCtx?: WorkflowMacroCtx | null): string | null {
  if (!wfCtx || !ref) return null;
  const inner = String(ref).trim().replace(/^\{\{/, '').replace(/\}\}$/, '');
  const segs = inner.split('.').filter(Boolean);
  if (segs.length === 0) return null;
  let val: any;
  const head = segs[0];
  if (head === 'record') val = wfCtx.record ?? null;
  else if (head === 'oldRecord') val = wfCtx.oldRecord ?? null;
  else if (head === 'requestor') val = wfCtx.requestor ?? null;
  else if (head === 'request_date') return wfCtx.requestDate ?? null;
  else val = wfCtx.variables?.[head];
  for (const s of segs.slice(1)) {
    if (val == null) return null;
    if (Array.isArray(val)) val = val[parseInt(s, 10) || 0];
    else val = val[s];
  }
  return val == null ? null : String(val);
}

/**
 * Validates and enriches a payload of Query Studio filter groups before SQL
 * generation. Shared by `GET /api/dynamic/[tableName]` (record lists) and
 * `GET /api/dynamic/[tableName]/options` (distinct dropdown values), plus the
 * Record Event workflow execution path (which supplies `workflowCtx`).
 *
 * Mutates the rules in place:
 *  - drops rules whose LHS/refField columns are not real fields of the model
 *  - resolves LHS/RHS drill chains into per-hop table names (`chainTables`/`refChainTables`)
 *  - resolves the record-source subquery table (`targetTable`) from the relation field config
 *  - expands session context macros (`@me`, `@today`, `@last_n_days`, …) into concrete values
 *  - expands workflow macros (`@wf.requestor`, `@wf.request_date`, `@var.<name>`, …)
 *    when `workflowCtx` is provided (Record Event filters)
 */
export async function preprocessFilterGroups(params: {
  session: SessionContext;
  tableName: string;
  tableFields: any[];
  filterGroups: { groupLogic: 'and' | 'or'; rules: FilterGroupRule[] }[];
  workflowCtx?: WorkflowMacroCtx;
}): Promise<void> {
  const { session, tableName, tableFields, filterGroups, workflowCtx } = params;
  if (!Array.isArray(filterGroups) || filterGroups.length === 0) return;

  const validFields = new Set<string>(tableFields.map((f: any) => f.fieldName));
  // The record's ID (UUID) is a real column on every table — metadata excludes it.
  validFields.add('id');
  const fieldByName = new Map(tableFields.map((f: any) => [f.fieldName, f]));

  // Related-table metadata cache for drill-chain resolution (per request).
  // Every table's list is augmented with the virtual `id` (UUID) column so
  // `customer.id = …` chains resolve — metadata excludes it.
  const withId = (flds: any[]): any[] => flds.some((f: any) => f.fieldName === 'id') ? flds : [...flds, { fieldName: 'id' }];
  const tableCache = new Map<string, any[]>();
  tableCache.set(tableName, withId(tableFields));
  const loadTableFields = async (tName: string): Promise<any[] | null> => {
    if (tableCache.has(tName)) return tableCache.get(tName) || null;
    const t = await db.tableDefinition.findFirst({
      where: { tenantId: session.tenantId, tableName: tName },
      include: { fields: true },
    });
    const flds = (t?.fields || []) as any[];
    const withIdFields = withId(flds);
    tableCache.set(tName, withIdFields);
    return flds.length > 0 ? withIdFields : null;
  };

  // Resolve a drill chain [c0, c1, ...] into per-hop table names.
  // chain[0] lives on the root table; chain[i] (i>0) must be a field of the
  // table targeted by relation field chain[i-1].
  const resolveChain = async (chain: string[]): Promise<string[] | null> => {
    if (!Array.isArray(chain) || chain.length === 0) return null;
    const tables: string[] = [tableName];
    let curFields = withId(tableFields);
    if (!curFields.some((f: any) => f.fieldName === chain[0])) return null;
    for (let i = 1; i < chain.length; i++) {
      const relField = curFields.find((f: any) => f.fieldName === chain[i - 1]);
      const lt = relField?.logicalType;
      const target = relField && (lt === 'relation' || lt === 'lookup') ? (relField.config as any)?.targetTable : null;
      if (!target) return null;
      const nextFields = await loadTableFields(target);
      if (!nextFields || !nextFields.some((f: any) => f.fieldName === chain[i])) return null;
      tables.push(target);
      curFields = nextFields;
    }
    return tables;
  };

  for (const grp of filterGroups) {
    if (!grp || !Array.isArray(grp.rules)) continue;
    for (const rule of grp.rules) {
      if (!rule) continue;
      const isChainRule = Array.isArray(rule.chain) && rule.chain.length > 0;

      if (isChainRule) {
        const tables = await resolveChain(rule.chain);
        if (!tables) { rule.value = ''; continue; }
        rule.chainTables = tables;
      } else if (!validFields.has(rule.field)) {
        rule.value = '';
        continue;
      }

      // RHS field-source drill chain (drilled deeper than one hop).
      if (Array.isArray(rule.refChain) && rule.refChain.length > 1) {
        const refTables = await resolveChain(rule.refChain);
        if (!refTables) { rule.value = ''; continue; }
        rule.refChainTables = refTables;
      }

      // Field-to-field (single hop): refField must be a valid root column.
      if (rule.refField && !rule.refRecordId && !Array.isArray(rule.refChain) && !validFields.has(rule.refField) && rule.refField !== 'id') {
        rule.value = '';
        continue;
      }

      // Record source: resolve the related table from the LHS relation field.
      if (rule.refField && rule.refRecordId) {
        const lhsCol = isChainRule && rule.chain ? rule.chain[0] : rule.field;
        const lhsFieldMeta = fieldByName.get(lhsCol) || tableFields.find((f: any) => f.fieldName === lhsCol);
        const targetTable = (lhsFieldMeta?.config as any)?.targetTable || '';
        if (!targetTable) {
          rule.value = '';
          continue;
        }
        rule.targetTable = targetTable;
      }

      // Context macros resolve to concrete values before SQL generation.
      if (typeof rule.value === 'string' && rule.value.startsWith('@')) {
        rule.value = resolveContextMacro(rule.value, rule.contextN, {
          userId: session.userId,
          teams: session.teams,
          role: session.role,
        }, workflowCtx);
      }

      // Workflow value source: resolve the moustache reference against the
      // workflow context (variables / record / oldRecord / requestor / date).
      if (rule.workflowRef) {
        const resolved = resolveWorkflowRef(rule.workflowRef, workflowCtx);
        if (resolved == null) { rule.value = ''; continue; }
        rule.value = resolved;
        delete rule.workflowRef;
      }
    }
  }
}
