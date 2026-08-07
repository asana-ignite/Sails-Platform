import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Filter, Check, ChevronDown } from 'lucide-react';
import CustomSelect from './CustomSelect';
import RecordPicker from './RecordPicker';
import FieldPathPicker from './FieldPathPicker';
import type { FieldDefinition as PickerField } from './FieldPathPicker';
import type { FilterGroup, FilterRule, SailsFieldDefinition, FilterValueSource } from '@sails/shared';
import { CONTEXT_FLAT_OPTIONS, isNPeriodMacro } from '@sails/shared';
import { useDateTimePrefs, resolveControlDisplayText } from '../../utils/systemDateTime';
import { SailsDatePicker } from '../../features/controls/plugins/DateControl';
import { SailsDateTimePicker } from '../../features/controls/plugins/DateTimeControl';
import { SailsTimePicker } from '../../features/controls/plugins/TimeControl';
import './FilterBuilder.css';

export const FILTER_OPERATOR_OPTIONS = [
  { value: 'eq', label: '= Equals' },
  { value: 'neq', label: '\u2260 Not Equal' },
  { value: 'gt', label: '> Greater Than' },
  { value: 'gte', label: '\u2265 Greater or Equal' },
  { value: 'lt', label: '< Less Than' },
  { value: 'lte', label: '\u2264 Less or Equal' },
  { value: 'contains', label: 'Contains' },
  { value: 'is_empty', label: 'Is Empty' },
  { value: 'is_not_empty', label: 'Is Not Empty' },
];

export const RHS_SOURCE_OPTIONS: { value: FilterValueSource; label: string }[] = [
  { value: 'value', label: 'Value' },
  { value: 'field', label: 'Field' },
  { value: 'record', label: 'Record' },
  { value: 'context', label: 'Context' },
];

export function filterOperatorLabel(op: string): string {
  const found = FILTER_OPERATOR_OPTIONS.find((o) => o.value === op);
  return found ? found.label.split(' ')[0] : op;
}

const NULL_OPS = new Set(['is_empty', 'is_not_empty']);

/** Maps a Sails field definition onto the FieldPathPicker's field shape. */
function toPickerField(f: SailsFieldDefinition): PickerField {
  const cfg = (f.config || {}) as any;
  const isRelation = f.logicalType === 'relation' || f.logicalType === 'lookup';
  return {
    id: f.id,
    name: f.name,
    fieldName: f.fieldName,
    logicalType: f.logicalType as PickerField['logicalType'],
    targetModel: isRelation ? cfg.targetTable || undefined : undefined,
    options: Array.isArray(cfg.options) ? cfg.options : undefined,
  };
}

/** Per-root-table cache of all model schemas for the drill picker. */
const modelSchemasCache: Record<string, Record<string, PickerField[]>> = {};

/**
 * Builds the FieldPathPicker schema map: the root model from `rootFields` plus
 * every related model from /api/metadata/objects (cached per root table).
 */
function useModelSchemas(rootFields: SailsFieldDefinition[], rootTableName: string): Record<string, PickerField[]> {
  const [schemas, setSchemas] = useState<Record<string, PickerField[]>>({});

  useEffect(() => {
    let mounted = true;
    const rootMap = rootFields.map(toPickerField);
    const apply = (map: Record<string, PickerField[]>) => {
      if (mounted) setSchemas({ ...map, [rootTableName]: rootMap });
    };

    const cached = modelSchemasCache[rootTableName];
    if (cached) {
      apply(cached);
      return;
    }

    fetch('/api/metadata/objects')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!mounted) return;
        const rows = Array.isArray(data) ? data : (data?.rows || data?.data || []);
        const map: Record<string, PickerField[]> = { [rootTableName]: rootMap };
        for (const t of rows) {
          if (t.tableName && Array.isArray(t.fields)) {
            map[t.tableName] = t.fields.map(toPickerField);
          }
        }
        modelSchemasCache[rootTableName] = map;
        apply(map);
      })
      .catch(() => { if (mounted) apply({ [rootTableName]: rootMap }); });

    return () => { mounted = false; };
  }, [rootFields, rootTableName]);

  return schemas;
}

let fbCounter = 0;
function newRuleId(): string { fbCounter++; return `fb_rule_${Date.now()}_${fbCounter}`; }
function newGroupId(): string { fbCounter++; return `fb_grp_${Date.now()}_${fbCounter}`; }

function emptyRule(fields: SailsFieldDefinition[]): FilterRule {
  return { id: newRuleId(), fieldId: fields[0]?.id || '', operator: 'eq', value: '', logic: 'and', valueSource: 'value' };
}

function emptyGroup(fields: SailsFieldDefinition[], name: string): FilterGroup {
  return { id: newGroupId(), name, groupLogic: 'and', rules: [emptyRule(fields)] };
}

interface FilterBuilderProps {
  fields: SailsFieldDefinition[];
  /** Physical table name of the model being filtered (root of drill paths). */
  rootTableName: string;
  initialGroups?: FilterGroup[];
  onApply: (groups: FilterGroup[]) => void;
  onCancel?: () => void;
  showHeader?: boolean;
  title?: string;
  /**
   * Extra options appended to the Context source dropdown (category headers
   * must use the `cat_` prefix and disabled: true, like CONTEXT_FLAT_OPTIONS).
   * Used by Workflow Studio to expose workflow context macros and workflow
   * variables; other QueryStudio hosts leave this unset.
   */
  extraContextOptions?: { value: string; label: string; disabled?: boolean }[];
}

export const FilterBuilder: React.FC<FilterBuilderProps> = ({
  fields,
  rootTableName,
  initialGroups = [],
  onApply,
  onCancel,
  showHeader = true,
  title = 'Edit View Filters',
  extraContextOptions,
}) => {
  const dateTimePrefs = useDateTimePrefs();
  const modelSchemas = useModelSchemas(fields, rootTableName);
  const contextOptions = extraContextOptions && extraContextOptions.length > 0
    ? [...CONTEXT_FLAT_OPTIONS, ...extraContextOptions]
    : CONTEXT_FLAT_OPTIONS;
  const [groups, setGroups] = useState<FilterGroup[]>(
    initialGroups.length > 0 ? initialGroups : [emptyGroup(fields, '1')]
  );
  const [activeTabId, setActiveTabId] = useState<string>(groups[0]?.id || '');

  const activeIdx = groups.findIndex((g) => g.id === activeTabId);
  const activeGroup = groups[activeIdx >= 0 ? activeIdx : 0] || groups[0];

  const updateGroups = (next: FilterGroup[]) => setGroups(next);

  /** Attach display paths before handing groups to the parent. */
  const applyGroups = (groupsToApply: FilterGroup[]) => {
    const withPaths = groupsToApply.map((g) => ({
      ...g,
      rules: g.rules.map((r) => {
        const chainIds = r.fieldChain && r.fieldChain.length > 0 ? r.fieldChain : (r.fieldId ? [r.fieldId] : []);
        const names = chainIds.map((id) => findFieldAnywhere(id)?.name || id).filter(Boolean);
        const refChainIds = r.refFieldChain && r.refFieldChain.length > 0 ? r.refFieldChain : (r.refFieldId ? [r.refFieldId] : []);
        const refNames = refChainIds.map((id) => findFieldAnywhere(id)?.name || id).filter(Boolean);
        return {
          ...r,
          fieldPath: names.length > 0 ? names.join(' \u2192 ') : undefined,
          refFieldPath: refNames.length > 0 ? refNames.join(' \u2192 ') : undefined,
        };
      }),
    }));
    onApply(withPaths);
  };

  const addGroupTab = () => {
    const g = emptyGroup(fields, String(groups.length + 1));
    setGroups([...groups, g]);
    setActiveTabId(g.id);
  };

  const removeGroupTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (groups.length <= 1) return;
    const next = groups.filter((g) => g.id !== id);
    setGroups(next);
    if (activeTabId === id) setActiveTabId(next[0].id);
  };

  const updateGroupLogic = (id: string, logic: 'and' | 'or') => {
    setGroups(groups.map((g) => (g.id === id ? { ...g, groupLogic: logic } : g)));
  };

  const updateActiveRules = (rules: FilterRule[]) => {
    if (!activeGroup) return;
    setGroups(groups.map((g) => (g.id === activeGroup.id ? { ...g, rules } : g)));
  };

  const addRuleToActiveGroup = () => {
    if (!activeGroup) return;
    updateActiveRules([...activeGroup.rules, emptyRule(fields)]);
  };

  const removeRule = (ruleId: string) => {
    if (!activeGroup) return;
    updateActiveRules(activeGroup.rules.filter((r) => r.id !== ruleId));
  };

  const updateRule = (ruleId: string, patch: Partial<FilterRule>) => {
    if (!activeGroup) return;
    updateActiveRules(activeGroup.rules.map((r) => (r.id === ruleId ? { ...r, ...patch } : r)));
  };

  /** Find a field across every model in the schema map (root + related). */
  const findFieldAnywhere = (fieldId: string): PickerField | null => {
    if (!fieldId) return null;
    for (const list of Object.values(modelSchemas)) {
      const hit = list.find((f) => f.id === fieldId);
      if (hit) return hit;
    }
    return null;
  };

  const totalRules = groups.reduce((acc, g) => acc + g.rules.length, 0);
  const ruleCountLabel = `${totalRules} ${totalRules === 1 ? 'Rule' : 'Rules'}`;

  const literalValueEditor = (rule: FilterRule) => {
    const field = findFieldAnywhere(rule.fieldId);
    const lt = String(field?.logicalType || '');
    const options = field?.options;

    if (Array.isArray(options) && options.length > 0) {
      return (
        <CustomSelect
          value={rule.value}
          options={options}
          onChange={(v) => updateRule(rule.id, { value: String(v) })}
          size="sm"
          searchable
          placeholder="Select value..."
        />
      );
    }
    if (lt === 'boolean') {
      return (
        <CustomSelect
          value={rule.value}
          options={[
            { value: 'true', label: 'Yes' },
            { value: 'false', label: 'No' },
          ]}
          onChange={(v) => updateRule(rule.id, { value: String(v) })}
          size="sm"
          placeholder="Select..."
        />
      );
    }
    // Date-like fields reuse the same themed pickers as the record detail
    // form (SailsDatePicker / SailsDateTimePicker / SailsTimePicker) instead
    // of the browser-native calendar, which cannot be themed.
    if (lt === 'date') {
      return (
        <SailsDatePicker
          value={rule.value || ''}
          displayText={resolveControlDisplayText(undefined, rule.value, dateTimePrefs, 'date')}
          onChange={(v) => updateRule(rule.id, { value: v })}
          placeholder="Select date..."
        />
      );
    }
    if (lt === 'datetime' || lt === 'timestamp') {
      return (
        <SailsDateTimePicker
          value={rule.value || ''}
          displayText={resolveControlDisplayText(undefined, rule.value, dateTimePrefs, 'datetime')}
          onChange={(v) => updateRule(rule.id, { value: v })}
          placeholder="Select date & time..."
        />
      );
    }
    if (lt === 'time') {
      return (
        <SailsTimePicker
          value={rule.value || ''}
          displayText={resolveControlDisplayText(undefined, rule.value, dateTimePrefs, 'time')}
          onChange={(v) => updateRule(rule.id, { value: v })}
          placeholder="Select time..."
        />
      );
    }
    return (
      <input
        type="text"
        className="sails-input fb-value-input"
        value={rule.value || ''}
        onChange={(e) => updateRule(rule.id, { value: e.target.value })}
        placeholder="Enter value..."
      />
    );
  };

  const sourceEditor = (rule: FilterRule) => {
    const source = rule.valueSource || 'value';
    const field = findFieldAnywhere(rule.fieldId);

    if (source === 'field') {
      return (
        <FieldPathPicker
          rootModel={rootTableName}
          modelsSchemas={modelSchemas}
          value={rule.refFieldChain && rule.refFieldChain.length > 0 ? rule.refFieldChain : rule.refFieldId ? [rule.refFieldId] : []}
          onChange={(chain) => {
            const terminal = chain[chain.length - 1];
            updateRule(rule.id, { refFieldChain: chain, refFieldId: terminal || '' });
          }}
          size="sm"
          placeholder="Select field..."
        />
      );
    }

    if (source === 'record') {
      const targetTable = field?.targetModel || '';
      const targetFields = modelSchemas[targetTable] || [];
      const hasTarget = !!targetTable;
      return (
        <div className="fb-record-wrap">
          {hasTarget ? (
            <>
              <RecordPicker
                targetTableName={targetTable}
                targetTableLabel={field?.name || targetTable}
                value={rule.refRecordId || ''}
                onChange={(recordId) => updateRule(rule.id, { refRecordId: recordId })}
              />
              <CustomSelect
                value={rule.refFieldId || ''}
                options={targetFields.map((f) => ({ value: f.fieldName, label: f.name }))}
                onChange={(v) => updateRule(rule.id, { refFieldId: String(v) })}
                size="sm"
                searchable
                placeholder="Select field..."
              />
            </>
          ) : (
            <span className="fb-inline-hint">LHS field is not a relation — pick a relation field first.</span>
          )}
        </div>
      );
    }

    if (source === 'context') {
      const needsN = isNPeriodMacro(rule.contextMacro || '');
      return (
        <div className="fb-context-wrap">
          <CustomSelect
            value={rule.contextMacro || '@me'}
            options={contextOptions}
            onChange={(v) => {
              const valStr = String(v);
              if (valStr.startsWith('cat_')) return;
              updateRule(rule.id, {
                contextMacro: valStr,
                contextN: isNPeriodMacro(valStr) ? (rule.contextN || 30) : undefined,
              });
            }}
            size="sm"
            searchable
            placeholder="Select macro..."
          />
          {needsN && (
            <input
              type="number"
              className="sails-input fb-n-input"
              value={rule.contextN ?? 30}
              onChange={(e) => updateRule(rule.id, { contextN: parseInt(e.target.value, 10) || 1 })}
              placeholder="N"
              min={1}
              max={999}
              title="Enter N period duration"
            />
          )}
        </div>
      );
    }

    return literalValueEditor(rule);
  };

  const [showSummary, setShowSummary] = useState(true);

  /** Human-readable field label for the read-only summary. */
  const summaryFieldLabel = (rule: FilterRule): string => {
    if (rule.fieldPath) return rule.fieldPath;
    return findFieldAnywhere(rule.fieldId)?.name || rule.fieldId || '(field)';
  };

  /** Human-readable RHS label for the read-only summary (no SQL is ever shown). */
  const summaryValueLabel = (rule: FilterRule): string => {
    const source = rule.valueSource || 'value';
    if (source === 'context') {
      const macro = rule.contextMacro || '@me';
      const opt = contextOptions.find((o) => o.value === macro);
      return isNPeriodMacro(macro) ? `${opt?.label || macro} (${rule.contextN ?? 30})` : (opt?.label || macro);
    }
    if (source === 'field') {
      const ref = rule.refFieldPath || findFieldAnywhere(rule.refFieldId || '')?.name || rule.refFieldId;
      return ref ? `Field \u2192 ${ref}` : '(field)';
    }
    if (source === 'record') {
      const ref = rule.refFieldPath || findFieldAnywhere(rule.refFieldId || '')?.name || rule.refFieldId || 'field';
      const rec = rule.refRecordId ? `\u2026${rule.refRecordId.slice(-8)}` : '(record)';
      return `${ref} of record ${rec}`;
    }
    const field = findFieldAnywhere(rule.fieldId);
    const raw = rule.value ?? '';
    if (field?.logicalType === 'boolean') return raw === 'true' ? 'Yes' : raw === 'false' ? 'No' : (raw === '' ? '(empty)' : raw);
    if (Array.isArray(field?.options) && (field.options as { label: string; value: string }[]).length > 0) {
      const hit = (field.options as { label: string; value: string }[]).find((o) => o.value === raw);
      if (hit) return hit.label;
    }
    return raw === '' ? '(empty)' : String(raw);
  };

  return (
    <div className="fb-widget">
      {showHeader && (
        <div className="fb-header">
          <div className="fb-title">
            <Filter size={15} className="fb-title-icon" />
            <span>{title}</span>
          </div>
          <span className="fb-count-badge">{ruleCountLabel} Active</span>
        </div>
      )}

      <div className="fb-tab-bar">
        {groups.map((grp, idx) => {
          const isActive = grp.id === activeTabId;
          return (
            <div
              key={grp.id}
              className={`fb-tab-item ${isActive ? 'fb-tab-item--active' : ''}`}
              onClick={() => setActiveTabId(grp.id)}
            >
              {idx > 0 && (
                <button
                  type="button"
                  className={`fb-tab-logic-chip ${grp.groupLogic === 'and' ? 'fb-tab-logic-chip--and' : 'fb-tab-logic-chip--or'}`}
                  onClick={(e) => { e.stopPropagation(); updateGroupLogic(grp.id, grp.groupLogic === 'and' ? 'or' : 'and'); }}
                  title="Toggle logic joining with previous tab"
                >
                  {grp.groupLogic.toUpperCase()}
                </button>
              )}
              <span className="fb-tab-name">{grp.name}</span>
              <span className="fb-tab-count">({grp.rules.length})</span>
              {groups.length > 1 && (
                <button type="button" className="fb-tab-close-btn" onClick={(e) => removeGroupTab(grp.id, e)} title="Remove Tab">
                  {'\u00d7'}
                </button>
              )}
            </div>
          );
        })}
        <button type="button" className="fb-tab-add-btn" onClick={addGroupTab} title="Add New Filter Tab">
          <Plus size={13} /> Add Tab
        </button>
      </div>

      <div className="fb-body">
        {!activeGroup || activeGroup.rules.length === 0 ? (
          <div className="fb-empty">
            No rules in this block. Click <strong>+ Add Filter Rule</strong> below.
          </div>
        ) : (
          activeGroup.rules.map((rule, idx) => {
            const isNullOp = NULL_OPS.has(rule.operator);
            return (
              <div key={rule.id} className="fb-row">
                <div className="fb-col-logic">
                  {idx === 0 ? (
                    <span className="fb-where-badge">WHERE</span>
                  ) : (
                    <button
                      type="button"
                      className={`fb-logic-btn ${rule.logic === 'and' ? 'fb-logic-btn--and' : 'fb-logic-btn--or'}`}
                      onClick={() => updateRule(rule.id, { logic: rule.logic === 'and' ? 'or' : 'and' })}
                      title={rule.logic === 'and' ? 'AND with previous rule' : 'OR with previous rule'}
                    >
                      {rule.logic.toUpperCase()}
                    </button>
                  )}
                </div>

                <div className="fb-col-field">
                  <FieldPathPicker
                    rootModel={rootTableName}
                    modelsSchemas={modelSchemas}
                    value={rule.fieldChain && rule.fieldChain.length > 0 ? rule.fieldChain : rule.fieldId ? [rule.fieldId] : []}
                    onChange={(chain) => {
                      const terminal = chain[chain.length - 1];
                      updateRule(rule.id, {
                        fieldChain: chain,
                        fieldId: terminal || '',
                        value: '',
                        refFieldId: undefined,
                        refFieldChain: undefined,
                        refRecordId: undefined,
                        contextMacro: undefined,
                        contextN: undefined,
                      });
                    }}
                    size="sm"
                    placeholder="Select field..."
                  />
                </div>

                <div className="fb-col-op">
                  <CustomSelect
                    value={rule.operator}
                    options={FILTER_OPERATOR_OPTIONS}
                    onChange={(v) => updateRule(rule.id, { operator: String(v) })}
                    size="sm"
                  />
                </div>

                <div className="fb-col-source">
                  {!isNullOp ? (
                    <CustomSelect
                      value={rule.valueSource || 'value'}
                      options={RHS_SOURCE_OPTIONS}
                      onChange={(v) => {
                        const src = String(v) as FilterValueSource;
                        updateRule(rule.id, {
                          valueSource: src,
                          value: src === 'value' ? rule.value : '',
                          refFieldId: src === 'field' || src === 'record' ? rule.refFieldId : undefined,
                          refRecordId: src === 'record' ? rule.refRecordId : undefined,
                          contextMacro: src === 'context' ? (rule.contextMacro || '@me') : undefined,
                          contextN: src === 'context' ? (rule.contextN ?? 30) : undefined,
                        });
                      }}
                      size="sm"
                    />
                  ) : (
                    <div className="fb-source-placeholder" />
                  )}
                </div>

                <div className="fb-col-value">
                  {!isNullOp && sourceEditor(rule)}
                </div>

                <button
                  type="button"
                  className="fb-delete-btn"
                  onClick={() => removeRule(rule.id)}
                  title="Remove filter"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })
        )}

        <div className="fb-add-bar">
          <button type="button" className="sails-btn sails-btn--ghost sails-btn--sm" onClick={addRuleToActiveGroup}>
            <Plus size={13} /> Add Filter Rule
          </button>
        </div>
      </div>

      <div className="fb-summary">
        <button type="button" className="fb-summary-head" onClick={() => setShowSummary((v) => !v)}>
          <span className="fb-summary-title">
            <ChevronDown size={13} className={`fb-summary-chev ${showSummary ? '' : 'fb-summary-chev--closed'}`} />
            Where Summary
          </span>
          <span className="fb-count-badge">{ruleCountLabel}</span>
        </button>
        {showSummary && (
          <div className="fb-summary-body">
            {groups.filter((g) => g.rules.some((r) => r.fieldId)).length === 0 ? (
              <p className="fb-summary-empty">No filter rules configured.</p>
            ) : (
              groups.map((grp, gi) => {
                const rules = grp.rules.filter((r) => r.fieldId);
                if (rules.length === 0) return null;
                return (
                  <div key={grp.id} className="fb-summary-group">
                    <div className="fb-summary-group-head">
                      <span className="fb-summary-group-name">Group {grp.name}</span>
                      {gi > 0 && (
                        <span className={`fb-tab-logic-chip ${grp.groupLogic === 'and' ? 'fb-tab-logic-chip--and' : 'fb-tab-logic-chip--or'}`}>
                          {grp.groupLogic.toUpperCase()}
                        </span>
                      )}
                    </div>
                    {rules.map((r, ri) => (
                      <div key={r.id} className="fb-summary-row">
                        <span className={`fb-summary-logic ${r.logic === 'or' ? 'fb-summary-logic--or' : ''}`}>
                          {ri > 0 ? r.logic.toUpperCase() : '\u00a0'}
                        </span>
                        <span className="fb-summary-field">{summaryFieldLabel(r)}</span>
                        <span className="fb-summary-op">{filterOperatorLabel(r.operator)}</span>
                        {!NULL_OPS.has(r.operator) && <span className="fb-summary-value">{summaryValueLabel(r)}</span>}
                      </div>
                    ))}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      <div className="fb-footer">
        <button
          type="button"
          className="sails-btn sails-btn--ghost sails-btn--sm"
          onClick={() => setGroups([emptyGroup(fields, '1')])}
        >
          Reset
        </button>
        <div className="fb-footer-right">
          {onCancel && (
            <button type="button" className="sails-btn sails-btn--ghost sails-btn--sm" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button type="button" className="sails-btn sails-btn--primary sails-btn--sm" onClick={() => applyGroups(groups)}>
            <Check size={14} /> Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilterBuilder;
