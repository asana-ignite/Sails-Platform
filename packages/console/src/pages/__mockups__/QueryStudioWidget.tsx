import React, { useState } from 'react';
import { Plus, Trash2, Filter, Check } from 'lucide-react';
import CustomSelect from '../../components/common/CustomSelect';
import FieldPathPicker from '../../components/common/FieldPathPicker';
import './QueryStudioWidget.css';

// ─── Interfaces ───────────────────────────────────────────────────

export interface FieldDefinition {
  id: string;
  name: string;
  fieldName: string;
  logicalType: 'short_text' | 'number' | 'currency' | 'select' | 'date' | 'boolean' | 'relation';
  targetModel?: string;
  options?: { label: string; value: string }[];
}

export type ValueSourceType = 'value' | 'field' | 'record' | 'context';

export interface SimpleFilterRule {
  id: string;
  lhsChain: string[];
  operator: string;
  rhsSource: ValueSourceType;
  rhsValue: any;
  rhsChain?: string[];
  rhsNumberParam?: number;
  logic: 'and' | 'or';
}

export interface TabFilterGroup {
  id: string;
  name: string;
  groupLogic: 'and' | 'or'; // Logic joining this tab to previous tabs
  rules: SimpleFilterRule[];
}

export interface QueryStudioWidgetProps {
  fields?: FieldDefinition[];
  initialGroups?: TabFilterGroup[];
  onApply?: (groups: TabFilterGroup[]) => void;
  title?: string;
  showHeader?: boolean;
}

// ─── Mock Multi-Model Schemas ─────────────────────────────────────

export const MODEL_SCHEMAS: Record<string, FieldDefinition[]> = {
  Leads: [
    { id: 'f1', name: 'Lead Name', fieldName: 'lead_name', logicalType: 'short_text' },
    { id: 'f2', name: 'Company', fieldName: 'company_id', logicalType: 'relation', targetModel: 'Companies' },
    { id: 'f3', name: 'Status', fieldName: 'status', logicalType: 'select', options: [{ label: 'Qualified', value: 'qualified' }, { label: 'Proposal', value: 'proposal' }] },
    { id: 'f4', name: 'Budget (THB)', fieldName: 'budget', logicalType: 'currency' },
    { id: 'f5', name: 'Expected Revenue', fieldName: 'expected_revenue', logicalType: 'currency' },
    { id: 'f7', name: 'Created Date', fieldName: 'created_at', logicalType: 'date' },
    { id: 'f9', name: 'Assigned Owner', fieldName: 'assigned_to', logicalType: 'relation', targetModel: 'Users' }
  ],
  Companies: [
    { id: 'c1', name: 'Company Name', fieldName: 'company_name', logicalType: 'short_text' },
    { id: 'c2', name: 'Industry', fieldName: 'industry', logicalType: 'short_text' },
    { id: 'c3', name: 'Account Manager', fieldName: 'account_manager_id', logicalType: 'relation', targetModel: 'Users' },
    { id: 'c4', name: 'Annual Revenue', fieldName: 'annual_revenue', logicalType: 'currency' }
  ],
  Users: [
    { id: 'u1', name: 'Full Name', fieldName: 'full_name', logicalType: 'short_text' },
    { id: 'u2', name: 'Email Address', fieldName: 'email', logicalType: 'short_text' },
    { id: 'u3', name: 'Department', fieldName: 'department_id', logicalType: 'relation', targetModel: 'Departments' },
    { id: 'u4', name: 'Role', fieldName: 'role', logicalType: 'short_text' }
  ],
  Departments: [
    { id: 'd1', name: 'Department Name', fieldName: 'dept_name', logicalType: 'short_text' },
    { id: 'd2', name: 'Cost Center', fieldName: 'cost_center', logicalType: 'short_text' },
    { id: 'd3', name: 'Head of Dept', fieldName: 'head_user_id', logicalType: 'relation', targetModel: 'Users' }
  ]
};

export const MOCK_LEAD_FIELDS = MODEL_SCHEMAS.Leads;

export const CONTEXT_CATEGORIES = [
  {
    category: 'User Context',
    items: [
      { label: 'Current User', value: '@me' },
      { label: 'Current User Team', value: '@my_team' },
      { label: 'Current User Role', value: '@user.role' },
      { label: 'My Subordinates', value: '@my_subordinates' }
    ]
  },
  {
    category: 'Fixed Date Macros',
    items: [
      { label: 'Today', value: '@today' },
      { label: 'Yesterday', value: '@yesterday' },
      { label: 'Tomorrow', value: '@tomorrow' },
      { label: 'This Week', value: '@this_week' },
      { label: 'This Month', value: '@this_month' },
      { label: 'This Quarter', value: '@this_quarter' },
      { label: 'This Year', value: '@this_year' },
      { label: 'This Fiscal Quarter', value: '@this_fiscal_quarter' },
      { label: 'This Fiscal Year', value: '@this_fiscal_year' }
    ]
  },
  {
    category: 'Dynamic Relative N-Period Macros',
    items: [
      { label: 'Next N Days', value: '@next_n_days' },
      { label: 'Last N Days', value: '@last_n_days' },
      { label: 'Next N Weeks', value: '@next_n_weeks' },
      { label: 'Last N Weeks', value: '@last_n_weeks' },
      { label: 'Next N Months', value: '@next_n_months' },
      { label: 'Last N Months', value: '@last_n_months' },
      { label: 'Next N Years', value: '@next_n_years' },
      { label: 'Last N Years', value: '@last_n_years' },
      { label: 'Next N Fiscal Quarters', value: '@next_n_fiscal_quarters' },
      { label: 'Last N Fiscal Quarters', value: '@last_n_fiscal_quarters' },
      { label: 'Next N Fiscal Years', value: '@next_n_fiscal_years' },
      { label: 'Last N Fiscal Years', value: '@last_n_fiscal_years' }
    ]
  }
];

export const CONTEXT_FLAT_OPTIONS = CONTEXT_CATEGORIES.flatMap((cat) => [
  { value: `cat_${cat.category}`, label: `── ${cat.category} ──`, disabled: true },
  ...cat.items.map((item) => ({ value: item.value, label: item.label }))
]);

export const RHS_SOURCE_OPTIONS = [
  { value: 'value', label: 'Value' },
  { value: 'field', label: 'Field' },
  { value: 'record', label: 'Record' },
  { value: 'context', label: 'Context' }
];

export const OPERATOR_OPTIONS = [
  { value: 'eq', label: '= Equals' },
  { value: 'neq', label: '≠ Not Equal' },
  { value: 'gt', label: '> Greater Than' },
  { value: 'gte', label: '≥ Greater or Equal' },
  { value: 'lt', label: '< Less Than' },
  { value: 'lte', label: '≤ Less or Equal' },
  { value: 'contains', label: 'Contains' },
  { value: 'is_empty', label: 'Is Empty' },
  { value: 'is_not_empty', label: 'Is Not Empty' }
];

export function isNPeriodMacro(macroValue: string): boolean {
  return [
    '@next_n_days',
    '@last_n_days',
    '@next_n_weeks',
    '@last_n_weeks',
    '@next_n_months',
    '@last_n_months',
    '@next_n_years',
    '@last_n_years',
    '@next_n_fiscal_quarters',
    '@last_n_fiscal_quarters',
    '@next_n_fiscal_years',
    '@last_n_fiscal_years'
  ].includes(macroValue);
}

// Initial Tab Setup
export const DEFAULT_TAB_GROUPS: TabFilterGroup[] = [
  {
    id: 'grp_tab_1',
    name: '1',
    groupLogic: 'and',
    rules: [
      {
        id: 'flt_1',
        lhsChain: ['f3'], // Status
        operator: 'eq',
        rhsSource: 'value',
        rhsValue: 'qualified',
        logic: 'and'
      },
      {
        id: 'flt_2',
        lhsChain: ['f4'], // Budget
        operator: 'gt',
        rhsSource: 'value',
        rhsValue: '100000',
        logic: 'and'
      }
    ]
  },
  {
    id: 'grp_tab_2',
    name: '2',
    groupLogic: 'or',
    rules: [
      {
        id: 'flt_3',
        lhsChain: ['f7'], // Created Date
        operator: 'gte',
        rhsSource: 'context',
        rhsValue: '@next_n_days',
        rhsNumberParam: 30,
        logic: 'and'
      },
      {
        id: 'flt_4',
        lhsChain: ['f9'], // Assigned Owner
        operator: 'eq',
        rhsSource: 'context',
        rhsValue: '@me',
        logic: 'and'
      }
    ]
  }
];

// ─── Query Studio Widget ──────────────────────────────────────────

export const QueryStudioWidget: React.FC<QueryStudioWidgetProps> = ({
  fields = MODEL_SCHEMAS.Leads,
  initialGroups = DEFAULT_TAB_GROUPS,
  onApply,
  title = 'Edit View Filters',
  showHeader = true
}) => {
  const [groups, setGroups] = useState<TabFilterGroup[]>(initialGroups);
  const [activeTabId, setActiveTabId] = useState<string>(initialGroups[0]?.id || '');

  const activeGroupIndex = groups.findIndex((g) => g.id === activeTabId);
  const activeGroup = groups[activeGroupIndex >= 0 ? activeGroupIndex : 0] || groups[0];

  const addGroupTab = () => {
    const newGroupId = `grp_tab_${Date.now()}`;
    const newGroup: TabFilterGroup = {
      id: newGroupId,
      name: `${groups.length + 1}`,
      groupLogic: 'or',
      rules: [
        {
          id: `flt_${Date.now()}`,
          lhsChain: [fields[0]?.id || 'f1'],
          operator: 'eq',
          rhsSource: 'value',
          rhsValue: '',
          logic: 'and'
        }
      ]
    };
    setGroups([...groups, newGroup]);
    setActiveTabId(newGroupId);
  };

  const removeGroupTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (groups.length <= 1) return;
    const nextGroups = groups.filter((g) => g.id !== id);
    setGroups(nextGroups);
    if (activeTabId === id) {
      setActiveTabId(nextGroups[0].id);
    }
  };

  const updateActiveGroupRules = (newRules: SimpleFilterRule[]) => {
    setGroups(
      groups.map((g) => (g.id === activeGroup.id ? { ...g, rules: newRules } : g))
    );
  };

  const updateGroupLogic = (id: string, logic: 'and' | 'or') => {
    setGroups(
      groups.map((g) => (g.id === id ? { ...g, groupLogic: logic } : g))
    );
  };

  const addRuleToActiveGroup = () => {
    if (!activeGroup) return;
    const newRule: SimpleFilterRule = {
      id: `flt_${Date.now()}`,
      lhsChain: [fields[0]?.id || 'f1'],
      operator: 'eq',
      rhsSource: 'value',
      rhsValue: '',
      logic: 'and'
    };
    updateActiveGroupRules([...activeGroup.rules, newRule]);
  };

  const removeRuleFromActiveGroup = (ruleId: string) => {
    if (!activeGroup) return;
    updateActiveGroupRules(activeGroup.rules.filter((r) => r.id !== ruleId));
  };

  const updateRuleInActiveGroup = (ruleId: string, patch: Partial<SimpleFilterRule>) => {
    if (!activeGroup) return;
    updateActiveGroupRules(
      activeGroup.rules.map((r) => (r.id === ruleId ? { ...r, ...patch } : r))
    );
  };

  const totalRuleCount = groups.reduce((acc, g) => acc + g.rules.length, 0);

  return (
    <div className="qs-simple-widget">
      {showHeader && (
        <div className="qs-simple-header">
          <div className="qs-simple-title">
            <Filter size={15} className="qs-title-icon" />
            <span>{title}</span>
          </div>
          <span className="qs-rule-count-badge">
            {totalRuleCount} {totalRuleCount === 1 ? 'Rule' : 'Rules'} Active
          </span>
        </div>
      )}

      {/* ── Tab Bar (1 Tab = 1 Condition Block) ── */}
      <div className="qs-tab-bar">
        {groups.map((grp, idx) => {
          const isActive = grp.id === activeTabId;

          return (
            <div
              key={grp.id}
              className={`qs-tab-item ${isActive ? 'qs-tab-item--active' : ''}`}
              onClick={() => setActiveTabId(grp.id)}
            >
              {idx > 0 && (
                <button
                  type="button"
                  className={`qs-tab-logic-chip ${grp.groupLogic === 'and' ? 'qs-tab-logic-chip--and' : 'qs-tab-logic-chip--or'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    updateGroupLogic(grp.id, grp.groupLogic === 'and' ? 'or' : 'and');
                  }}
                  title="Toggle logic joining with previous tab"
                >
                  {grp.groupLogic.toUpperCase()}
                </button>
              )}
              <span className="qs-tab-name">{grp.name}</span>
              <span className="qs-tab-count">({grp.rules.length})</span>

              {groups.length > 1 && (
                <button
                  type="button"
                  className="qs-tab-close-btn"
                  onClick={(e) => removeGroupTab(grp.id, e)}
                  title="Remove Tab"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}

        <button type="button" className="qs-tab-add-btn" onClick={addGroupTab} title="Add New Filter Tab">
          <Plus size={13} /> Add Tab
        </button>
      </div>

      <div className="qs-simple-body">
        {!activeGroup || activeGroup.rules.length === 0 ? (
          <div className="qs-simple-empty">
            No rules in this block. Click <strong>+ Add Filter Rule</strong> below.
          </div>
        ) : (
          activeGroup.rules.map((rule, idx) => {
            const lastLhsId = rule.lhsChain[rule.lhsChain.length - 1];
            const selectedLhsField = fields.find((f) => f.id === lastLhsId) || fields[0];
            const fieldOptions = selectedLhsField?.options || [];
            const isNullOperator = ['is_empty', 'is_not_empty'].includes(rule.operator);
            const needsNParam = rule.rhsSource === 'context' && isNPeriodMacro(rule.rhsValue);

            return (
              <div key={rule.id} className="qs-simple-row">
                {/* 1. Logic Switcher (WHERE / AND / OR) */}
                <div className="qs-col-logic">
                  {idx === 0 ? (
                    <span className="qs-where-badge">WHERE</span>
                  ) : (
                    <button
                      type="button"
                      className={`qs-logic-btn ${rule.logic === 'and' ? 'qs-logic-btn--and' : 'qs-logic-btn--or'}`}
                      onClick={() => updateRuleInActiveGroup(rule.id, { logic: rule.logic === 'and' ? 'or' : 'and' })}
                    >
                      {rule.logic.toUpperCase()}
                    </button>
                  )}
                </div>

                {/* 2. Left-Hand Side (FieldPathPicker) */}
                <div className="qs-col-lhs-container">
                  <FieldPathPicker
                    rootModel="Leads"
                    modelsSchemas={MODEL_SCHEMAS}
                    value={rule.lhsChain}
                    onChange={(newChain) => updateRuleInActiveGroup(rule.id, { lhsChain: newChain, rhsValue: '' })}
                    size="sm"
                  />
                </div>

                {/* 3. Operator Selection */}
                <div className="qs-col-op">
                  <CustomSelect
                    value={rule.operator}
                    options={OPERATOR_OPTIONS}
                    onChange={(v) => updateRuleInActiveGroup(rule.id, { operator: String(v) })}
                    size="sm"
                  />
                </div>

                {/* 4. Source Type Dropdown */}
                <div className="qs-col-source-type">
                  {!isNullOperator ? (
                    <CustomSelect
                      value={rule.rhsSource}
                      options={RHS_SOURCE_OPTIONS}
                      onChange={(v) => {
                        const src = String(v) as ValueSourceType;
                        const defaultChain = src === 'field' || src === 'record' ? ['f4'] : undefined;
                        const defaultValue = src === 'context' ? '@me' : '';
                        updateRuleInActiveGroup(rule.id, { rhsSource: src, rhsChain: defaultChain, rhsValue: defaultValue, rhsNumberParam: 30 });
                      }}
                      size="sm"
                    />
                  ) : (
                    <div className="qs-source-placeholder" />
                  )}
                </div>

                {/* 5. 2nd Argument Target Input / Picker */}
                <div className="qs-col-target-arg">
                  {!isNullOperator && (
                    <div className="qs-target-arg-inner">
                      {['field', 'record'].includes(rule.rhsSource) ? (
                        <FieldPathPicker
                          rootModel="Leads"
                          modelsSchemas={MODEL_SCHEMAS}
                          value={rule.rhsChain || ['f4']}
                          onChange={(newChain) => updateRuleInActiveGroup(rule.id, { rhsChain: newChain })}
                          size="sm"
                          align="right"
                        />
                      ) : rule.rhsSource === 'context' ? (
                        <div className="qs-context-macro-wrap">
                          <CustomSelect
                            value={rule.rhsValue || '@me'}
                            options={CONTEXT_FLAT_OPTIONS}
                            onChange={(v) => {
                              const valStr = String(v);
                              if (valStr.startsWith('cat_')) return;
                              updateRuleInActiveGroup(rule.id, {
                                rhsValue: valStr,
                                rhsNumberParam: isNPeriodMacro(valStr) ? (rule.rhsNumberParam || 30) : undefined
                              });
                            }}
                            size="sm"
                            searchable
                          />
                          {needsNParam && (
                            <input
                              type="number"
                              className="sails-input qs-n-param-input"
                              value={rule.rhsNumberParam ?? 30}
                              onChange={(e) => updateRuleInActiveGroup(rule.id, { rhsNumberParam: parseInt(e.target.value, 10) || 1 })}
                              placeholder="N"
                              min={1}
                              max={999}
                              title="Enter N period duration"
                            />
                          )}
                        </div>
                      ) : fieldOptions.length > 0 ? (
                        <CustomSelect
                          value={rule.rhsValue}
                          options={fieldOptions}
                          onChange={(v) => updateRuleInActiveGroup(rule.id, { rhsValue: String(v) })}
                          size="sm"
                          searchable
                          placeholder="Select value..."
                        />
                      ) : (
                        <input
                          type={selectedLhsField?.logicalType === 'date' ? 'date' : 'text'}
                          className="sails-input qs-simple-input"
                          value={rule.rhsValue || ''}
                          onChange={(e) => updateRuleInActiveGroup(rule.id, { rhsValue: e.target.value })}
                          placeholder="Enter value..."
                        />
                      )}
                    </div>
                  )}
                </div>

                {/* 6. Remove Action */}
                <button
                  type="button"
                  className="qs-delete-btn"
                  onClick={() => removeRuleFromActiveGroup(rule.id)}
                  title="Remove filter"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })
        )}

        {/* Add Rule Action */}
        <div className="qs-add-bar">
          <button type="button" className="sails-btn sails-btn--ghost sails-btn--sm" onClick={addRuleToActiveGroup}>
            <Plus size={13} /> Add Filter Rule
          </button>
        </div>
      </div>

      {/* Footer Controls */}
      <div className="qs-simple-footer">
        <button type="button" className="sails-btn sails-btn--ghost sails-btn--sm" onClick={() => setGroups([initialGroups[0]])}>
          Reset Tabs
        </button>
        {onApply && (
          <button type="button" className="sails-btn sails-btn--primary sails-btn--sm" onClick={() => onApply(groups)}>
            <Check size={14} /> Apply Filters
          </button>
        )}
      </div>
    </div>
  );
};

export default QueryStudioWidget;
