/**
 * ObjectManager — Schema Studio: data models (tables) CRUD, field CRUD
 * with the metadata-driven type wizard (incl. Expression formulas with
 * JSONata editor), layouts list and permissions surface.
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useDateTimePrefs, formatSystemDateTimeValue, formatGlobalPrefsValue } from '../../utils/systemDateTime';
import { createPortal } from 'react-dom';
import { SailsTableDefinition, FieldTypeMetadata, FieldParameterDefinition, toSnakeCase, isSystemField } from '@sails/shared';
import { useConsole } from '../../contexts/ConsoleContext';
import { clearCache } from '../../api/client';
import { 
  Database, 
  Plus, 
  ArrowLeft, 
  Search, 
  Layers, 
  Settings, 
  Calendar, 
  ShieldAlert, 
  Trash2, 
  Info,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Eye,
  MoreHorizontal,
  Edit2,
  CheckCircle2,
  XCircle,
  X,
  Type,
  AlignLeft,
  Hash,
  DollarSign,
  ToggleLeft,
  List,
  Link,
  Mail,
  Phone,
  Sliders,
  Table,
  Sparkles,
  RefreshCw,
  MapPin,
  Save,
  LayoutTemplate,
  ShieldCheck,
  ExternalLink,
  AlertCircle,
  ClipboardList,
  FileText,
  Filter
} from 'lucide-react';
import { TableLayout, LayoutType, ViewType, FIELD_TYPE_REGISTRY, FilterGroup } from '@sails/shared';
import { CustomSelect, SelectOption } from '../../components/common/CustomSelect';
import { DynamicIcon } from '../../components/common/DynamicIcon';
import { FilterBuilder } from '../../components/common/FilterBuilder';
import { UiTableCard, UiTable, UiTh, UiTr, UiTd, UiNameCell, UiBadge, UiDateCell, UiActionsMenu, UiActionsItem, UiActionsDivider, UiPagination, UiConfirmDialog } from '../../components/ui';
import { ExpressionEditor } from '../../components/workflow/ExpressionEditor';
import type { SuggestionVariable, RecordSchemaMap } from '../../components/workflow/jsonataSuggest';
import './ObjectManager.css';

/**
 * Builds the intellisense schema for the Expression editor from the model
 * being configured: the model's own fields as suggestion variables, plus the
 * columns of every related model (for `relField.childField` drill-downs).
 */
function buildExpressionEditorSchema(tables: SailsTableDefinition[], table: SailsTableDefinition | null): {
  variables: SuggestionVariable[];
  recordSchemas: RecordSchemaMap;
} {
  const recordSchemas: RecordSchemaMap = {};
  for (const t of tables) {
    recordSchemas[t.tableName] = (t.fields || []).map((f) => ({
      fieldName: f.fieldName,
      label: f.name || f.fieldName,
      logicalType: f.logicalType || 'text',
      targetModel: (f.config as any)?.targetTable || undefined,
    }));
  }

  const variables: SuggestionVariable[] = (table?.fields || []).map((f) => ({
    id: f.id,
    name: f.fieldName,
    fieldType: f.logicalType || 'text',
    targetModel: (f.config as any)?.targetTable || undefined,
  }));

  return { variables, recordSchemas };
}

/** Sample record for the expression Test runner (same-record fields only). */
function buildSampleRecord(fields: any[]): Record<string, any> {
  const rec: Record<string, any> = {};
  for (const f of fields || []) {
    const lt = f.logicalType || 'text';
    if (['number', 'decimal', 'currency', 'percentage', 'auto_number'].includes(lt)) rec[f.fieldName] = 100;
    else if (lt === 'boolean') rec[f.fieldName] = true;
    else if (lt === 'date' || lt === 'datetime') rec[f.fieldName] = new Date().toISOString();
    else if (lt === 'relation' || lt === 'lookup') rec[f.fieldName] = null;
    else rec[f.fieldName] = `Sample ${f.name || f.fieldName}`;
  }
  return rec;
}

/** Expression (JSONata) editor block used in the field wizard. */
const ExpressionParam: React.FC<{
  tables: SailsTableDefinition[];
  table: SailsTableDefinition | null;
  value: string;
  onChange: (v: string) => void;
  label: string;
  description?: string;
  compact?: boolean;
}> = ({ tables, table, value, onChange, label, description, compact }) => {
  const { variables, recordSchemas } = useMemo(
    () => buildExpressionEditorSchema(tables, table),
    [tables, table]
  );
  // The `record.` drill branch — the familiar workflow-style way to pick the
  // model's own fields (and drill into related records) inside the formula.
  const recordColumns = useMemo(
    () =>
      (table?.fields || []).map((f) => ({
        fieldName: f.fieldName,
        label: f.name || f.fieldName,
        logicalType: f.logicalType || 'text',
        targetModel: (f.config as any)?.targetTable || undefined,
      })),
    [table]
  );
  const sample = useMemo(() => buildSampleRecord(table?.fields || []), [table]);
  return (
    <div className="om-field-group om-field-group--full">
      <label className="om-field-label">{label}</label>
      <ExpressionEditor
        variables={variables}
        recordSchemas={recordSchemas}
        drillRoots={recordColumns.length > 0 ? { record: recordColumns } : undefined}
        triggerModelName={table?.tableName}
        sample={sample}
        value={value || ''}
        onChange={onChange}
        compact={compact}
        hideVariablePicker
        placeholder="e.g. unit_price * qty  or  $uppercase(name) & ' - ' & $string($round(total, 2))"
      />
      {description && (
        <small style={{ color: 'var(--sails-text-muted)', fontSize: '0.75rem', marginTop: '4px', display: 'block', lineHeight: '1.3' }}>
          {description}
        </small>
      )}
    </div>
  );
};

const SortIcon: React.FC<{ active: boolean; direction?: 'asc' | 'desc' }> = ({ active, direction }) => {
  if (!active) return <ArrowUpDown size={14} className="om-sort-icon--idle" />;
  return direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
};

/** List View picker for the relation "Search List" display control. */
const LayoutSelectParam: React.FC<{ targetTable: string; value: string; onChange: (v: string) => void }> = ({ targetTable, value, onChange }) => {
  const { t } = useTranslation();
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!targetTable) { setOptions([]); return; }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/console/layouts?tableId=${encodeURIComponent(targetTable)}&viewType=LIST&page=1&limit=100`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        const rows: any[] = data?.data?.rows || [];
        setOptions(rows.map(l => ({ value: l.id, label: `${l.name}${l.status === 'active' ? '' : ` (${t('admin_view_manager.status.draft')})`}` })));
      })
      .catch(() => { if (!cancelled) setOptions([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [targetTable]);

  return (
    <CustomSelect
      size="md"
      searchable
      value={value || ''}
      options={[{ value: '', label: t('admin_object_manager.fieldConfig.defaultListView') }, ...options]}
      onChange={onChange}
      placeholder={loading ? t('admin_object_manager.fieldConfig.loadingListViews') : t('admin_object_manager.fieldConfig.chooseListView')}
    />
  );
};

interface SelectOptionSourceConfigProps {
  values: Record<string, any>;
  onChange: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  tables: SailsTableDefinition[];
}

const SelectOptionSourceConfig: React.FC<SelectOptionSourceConfigProps> = ({ values, onChange, tables }) => {
  const { t } = useTranslation();
  const [showFilterBuilder, setShowFilterBuilder] = useState(false);
  const isLookup = values.sourceType === 'object';
  const selectCustom = () => onChange((prev: Record<string, any>) => ({ ...prev, sourceType: 'custom' }));
  const selectObject = () => onChange((prev: Record<string, any>) => ({ ...prev, sourceType: 'object' }));

  const lookupSourceTable = tables.find(t => t.tableName === values.sourceTable);
  const lookupFieldOptions = lookupSourceTable?.fields
    ? lookupSourceTable.fields.map(f => ({
        value: f.fieldName,
        label: `${f.name} (${f.fieldName})`
      }))
    : [];

  const filterRuleCount = Array.isArray(values.sourceFilter)
    ? values.sourceFilter.reduce((acc: number, g: FilterGroup) => acc + (g.rules?.length || 0), 0)
    : 0;

  return (
    <div className="om-form-grid-2">
      {/* Allow Multi-Select — applies to both sources */}
      <div className="om-field-group" style={{ gridColumn: 'span 2' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            checked={!!values.allowMultiple}
            onChange={e => onChange(prev => ({ ...prev, allowMultiple: e.target.checked }))}
            style={{ width: 'auto' }}
          />
          <label className="om-field-label" style={{ margin: 0 }}>{t('admin_object_manager.fieldConfig.allowMultiple')}</label>
        </div>
      </div>

      {/* Column 1 — Custom entered options */}
      <div
        className={`om-source-zone${isLookup ? ' is-disabled' : ' is-active'}`}
        onClick={selectCustom}
      >
        <label className="om-source-zone__header">
          <input
            type="radio"
            name="optionSource"
            checked={!isLookup}
            onClick={selectCustom}
          />
          <span className="om-source-zone__title">{t('admin_object_manager.fieldConfig.customOptions')}</span>
        </label>
        <div className="om-source-zone__body">
          <label className="om-field-label">{t('admin_object_manager.fieldConfig.customOptionsLabel')}</label>
          <textarea
            className="sails-input"
            placeholder={'Draft\nIn Review\nApproved\nClosed'}
            rows={10}
            disabled={isLookup}
            value={values.optionsText || ''}
            onChange={e => onChange(prev => ({ ...prev, optionsText: e.target.value }))}
            style={{ resize: 'vertical', minHeight: '180px' }}
          />
          <span className="om-field-hint">{t('admin_object_manager.fieldConfig.customOptionsHint')}</span>
        </div>
      </div>

      {/* Column 2 — Lookup values from data model */}
      <div
        className={`om-source-zone${isLookup ? ' is-active' : ' is-disabled'}`}
        onClick={selectObject}
      >
        <label className="om-source-zone__header">
          <input
            type="radio"
            name="optionSource"
            checked={isLookup}
            onClick={selectObject}
          />
          <span className="om-source-zone__title">{t('admin_object_manager.fieldConfig.lookupValues')}</span>
        </label>
        <div className="om-source-zone__body">
          <div className="om-field-group" style={{ marginBottom: 12 }}>
            <label className="om-field-label">{t('admin_object_manager.fieldConfig.sourceModel')}</label>
            <CustomSelect
              size="md"
              searchable
              disabled={!isLookup}
              value={values.sourceTable || ''}
              options={tables.map(t => ({ value: t.tableName, label: `${t.name} (${t.tableName})` }))}
              onChange={val => onChange(prev => ({
                ...prev,
                sourceTable: val,
                sourceColumn: '',
                sourceFilter: undefined
              }))}
              placeholder={t('admin_object_manager.fieldConfig.selectSourceModel')}
            />
          </div>
          <div className="om-field-group" style={{ marginBottom: 0 }}>
            <label className="om-field-label">{t('admin_object_manager.fieldConfig.sourceField')}</label>
            <CustomSelect
              size="md"
              searchable
              disabled={!isLookup || !lookupSourceTable}
              value={values.sourceColumn || ''}
              options={lookupFieldOptions}
              onChange={val => onChange(prev => ({ ...prev, sourceColumn: val }))}
              placeholder={lookupSourceTable ? t('admin_object_manager.fieldConfig.selectSourceField') : t('admin_object_manager.fieldConfig.selectModelFirst')}
            />
          </div>

          {isLookup && values.sourceTable && values.sourceColumn && (
            <button
              type="button"
              className="sails-btn sails-btn--secondary sails-btn--sm om-source-filter"
              onClick={() => setShowFilterBuilder(true)}
            >
              <Filter size={13} style={{ marginRight: 6 }} />
              {filterRuleCount > 0 ? `${t('common.filter')} (${filterRuleCount} ${filterRuleCount === 1 ? t('admin_object_manager.fieldConfig.rule') : t('admin_object_manager.fieldConfig.rules')})` : t('common.filter')}
            </button>
          )}
        </div>
      </div>

      {/* Query Studio modal — reuses the same FilterBuilder component as the List View */}
      {showFilterBuilder && createPortal(
        <div className="om-modal-overlay om-qstudio-overlay" onClick={() => setShowFilterBuilder(false)}>
          <div className="om-modal om-qstudio-modal sails-qstudio-modal" onClick={(e) => e.stopPropagation()}>
            <div className="om-qstudio-modal__header">
              <h3 className="om-qstudio-modal__title">
                <Filter size={14} /> {t('admin_object_manager.fieldConfig.filterDropdown')}
              </h3>
              <button type="button" className="om-modal-close" onClick={() => setShowFilterBuilder(false)} aria-label={t('admin_object_manager.fieldConfig.closeQueryStudio')}>
                <X size={14} />
              </button>
            </div>
            <div className="om-qstudio-modal__body">
              <FilterBuilder
                fields={lookupSourceTable?.fields || []}
                rootTableName={values.sourceTable}
                initialGroups={values.sourceFilter ?? []}
                showHeader={false}
                title={t('admin_object_manager.fieldConfig.filterDropdown')}
                onApply={groups => {
                  onChange(prev => ({ ...prev, sourceFilter: groups }));
                  setShowFilterBuilder(false);
                }}
                onCancel={() => setShowFilterBuilder(false)}
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

const ObjectManager: React.FC = () => {
  const { t } = useTranslation();
  const datetimePrefs = useDateTimePrefs();
  const [tables, setTables] = useState<SailsTableDefinition[]>([]);
  const [selectedTable, setSelectedTable] = useState<SailsTableDefinition | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination state for tables
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [tableSortConfig, setTableSortConfig] = useState<{ key: 'name' | 'description' | 'isSystem' | 'fields' | 'createdAt' | 'updatedAt'; direction: 'asc' | 'desc' } | null>(null);

  // Field Manager state
  const [fieldSearchTerm, setFieldSearchTerm] = useState('');
  const [fieldCurrentPage, setFieldCurrentPage] = useState(1);
  const [fieldPageSize, setFieldPageSize] = useState(10);
  const [fieldSortConfig, setFieldSortConfig] = useState<{ key: 'name' | 'description' | 'logicalType' | 'isSystem' | 'isRequired'; direction: 'asc' | 'desc' } | null>(null);
  const [activeMenuFieldId, setActiveMenuFieldId] = useState<string | null>(null);

  type DetailTab = 'general' | 'fields' | 'layout' | 'permission';
  const [activeDetailTab, setActiveDetailTab] = useState<DetailTab>('fields');
  const [pendingDetailTabSwitch, setPendingDetailTabSwitch] = useState<DetailTab | null>(null);

  const [detailName, setDetailName] = useState('');
  const [detailDesc, setDetailDesc] = useState('');
  const [savedDetail, setSavedDetail] = useState({ name: '', description: '' });
  const [isSavingDetail, setIsSavingDetail] = useState(false);

  const [layouts, setLayouts] = useState<(TableLayout & { table?: { id: string; name: string; tableName: string } | null })[]>([]);
  const [layoutsLoading, setLayoutsLoading] = useState(false);

  const isDetailDirty =
    detailName !== savedDetail.name ||
    detailDesc !== savedDetail.description;

  const isCurrentDetailTabDirty = (tab?: DetailTab) => {
    const t = tab || activeDetailTab;
    if (t === 'general') return isDetailDirty;
    return false;
  };

  const handleDetailTabClick = (targetTab: DetailTab) => {
    if (targetTab === activeDetailTab) return;
    if (isCurrentDetailTabDirty()) {
      setPendingDetailTabSwitch(targetTab);
    } else {
      setActiveDetailTab(targetTab);
    }
  };

  const handleDiscardDetailAndSwitch = () => {
    setDetailName(savedDetail.name);
    setDetailDesc(savedDetail.description);
    if (pendingDetailTabSwitch) {
      setActiveDetailTab(pendingDetailTabSwitch);
      setPendingDetailTabSwitch(null);
    }
  };

  const handleSaveDetailAndSwitch = async () => {
    await saveGeneralInfo();
    if (pendingDetailTabSwitch) {
      setActiveDetailTab(pendingDetailTabSwitch);
      setPendingDetailTabSwitch(null);
    }
  };

  const VIEW_TYPE_LABELS: Record<ViewType, { label: string; icon: React.ElementType; className: string }> = {
    LIST: { label: 'List', icon: List, className: 'om-layout-badge--list' },
    DETAIL: { label: 'Detail', icon: ClipboardList, className: 'om-layout-badge--detail' },
    FORM: { label: 'Form', icon: FileText, className: 'om-layout-badge--form' },
  };

  const handleTableSort = (key: 'name' | 'description' | 'isSystem' | 'fields' | 'createdAt' | 'updatedAt') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (tableSortConfig && tableSortConfig.key === key && tableSortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setTableSortConfig({ key, direction });
  };

  const getTableSortIcon = (key: 'name' | 'description' | 'isSystem' | 'fields' | 'createdAt' | 'updatedAt') => (
    <SortIcon active={tableSortConfig?.key === key} direction={tableSortConfig?.direction} />
  );

  const handleFieldSort = (key: 'name' | 'description' | 'logicalType' | 'isSystem' | 'isRequired') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (fieldSortConfig && fieldSortConfig.key === key && fieldSortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setFieldSortConfig({ key, direction });
  };

  const getFieldSortIcon = (key: 'name' | 'description' | 'logicalType' | 'isSystem' | 'isRequired') => (
    <SortIcon active={fieldSortConfig?.key === key} direction={fieldSortConfig?.direction} />
  );

  const [isCreatingTable, setIsCreatingTable] = useState(false);
  const [isCreatingField, setIsCreatingField] = useState(false);

  const [activeMenuTableId, setActiveMenuTableId] = useState<string | null>(null);
  
  // Table form state
  const [newTableName, setNewTableName] = useState('');
  const [newTableDbName, setNewTableDbName] = useState('');
  const [newTableDesc, setNewTableDesc] = useState('');
  
  // Field form state
  const [fieldWizardStep, setFieldWizardStep] = useState<1 | 2>(1);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldDbName, setNewFieldDbName] = useState('');
  const [newFieldDesc, setNewFieldDesc] = useState('');
  const [newFieldLogicalType, setNewFieldLogicalType] = useState('short_text');
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  
  // Metadata-Driven Registry Schema state
  const [fieldTypeMetadataList] = useState<FieldTypeMetadata[]>(FIELD_TYPE_REGISTRY);
  const [dynamicConfigValues, setDynamicConfigValues] = useState<Record<string, any>>({});

  // Edit Field state
  const [editingField, setEditingField] = useState<any | null>(null);
  const [editFieldWizardStep, setEditFieldWizardStep] = useState<1 | 2>(1);
  const [editFieldName, setEditFieldName] = useState('');
  const [editFieldDbName, setEditFieldDbName] = useState('');
  const [editFieldDesc, setEditFieldDesc] = useState('');
  const [editFieldLogicalType, setEditFieldLogicalType] = useState('short_text');
  const [editFieldRequired, setEditFieldRequired] = useState(false);
  const [editDynamicConfigValues, setEditDynamicConfigValues] = useState<Record<string, any>>({});

  // Sequence reset state
  const [resetSeqValue, setResetSeqValue] = useState<number>(1);
  const [isResettingSeq, setIsResettingSeq] = useState(false);
  const [resetSeqSuccessMsg, setResetSeqSuccessMsg] = useState<string | null>(null);

  const handleResetSequence = async (fieldId: string) => {
    setIsResettingSeq(true);
    setResetSeqSuccessMsg(null);
    try {
      const res = await fetch(`/api/metadata/fields/${fieldId}/reset-sequence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nextValue: resetSeqValue })
      });
      if (res.ok) {
        setResetSeqSuccessMsg(t('admin_object_manager.toast.sequenceReset', { value: resetSeqValue }));
        fetchTables();
      } else {
        const data = await res.json();
        setErrorMsg(data.error || t('admin_object_manager.error.sequenceResetFailed'));
      }
    } catch (err: any) {
      setErrorMsg(err.message || t('admin_object_manager.error.sequenceResetError'));
    } finally {
      setIsResettingSeq(false);
    }
  };

  // Use FIELD_TYPE_REGISTRY from shared package — always up to date

  // Sync default dynamic parameter values when selected field logical type changes
  useEffect(() => {
    const activeMeta = fieldTypeMetadataList.find(t => t.type === newFieldLogicalType);
    if (activeMeta && activeMeta.parametersSchema) {
      const defaults: Record<string, any> = {};
      activeMeta.parametersSchema.forEach(param => {
        if (param.defaultValue !== undefined) {
          defaults[param.name] = param.defaultValue;
        }
      });
      setDynamicConfigValues(defaults);
    }
  }, [newFieldLogicalType, fieldTypeMetadataList]);

  const resetFieldParams = useCallback(() => {
    setFieldWizardStep(1);
    setNewFieldName('');
    setNewFieldDbName('');
    setNewFieldDesc('');
    setNewFieldLogicalType('short_text');
    setNewFieldRequired(false);
    setDynamicConfigValues({
      maxLength: 255,
      transform: 'none',
      placeholder: '',
      defaultValue: ''
    });
  }, []);



  // Custom Error Modal State
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Custom Delete Confirmation Modal State
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{
    type: 'table' | 'field';
    id: string;
    name: string;
    extra?: string;
  } | null>(null);

  const { setHeaderActions, setPageTitle, setPageSubtitle } = useConsole();

  // Dynamic header title and subtitle when viewing table detail
  useEffect(() => {
    if (viewMode === 'detail' && selectedTable) {
      setPageTitle(selectedTable.name);
      setPageSubtitle(selectedTable.description || t('admin_object_manager.detailSubtitle'));
    } else {
      setPageTitle(null);
      setPageSubtitle(null);
    }
  }, [viewMode, selectedTable, setPageTitle, setPageSubtitle]);

  const hasInitializedRef = useRef(false);

  const fetchLayouts = useCallback(async (tableId: string) => {
    setLayoutsLoading(true);
    try {
      const params = new URLSearchParams({ tableId, limit: '100' });
      const res = await fetch(`/api/console/layouts?${params}`);
      const json = await res.json();
      if (json.success) {
        setLayouts(json.data.rows);
      }
    } catch (error) {
      console.error('Failed to fetch layouts:', error);
    } finally {
      setLayoutsLoading(false);
    }
  }, []);

  const fetchTables = useCallback(async () => {
    try {
      const res = await fetch('/api/metadata/objects');
      if (res.ok) {
        const data = await res.json();
        const rows = Array.isArray(data) ? data : (data.data || []);
        setTables(rows);
        // Force other surfaces (Layout Studio, Workflow Studio) to refetch
        // fresh metadata — their caches are now stale.
        clearCache('metadata/objects');

        if (!hasInitializedRef.current) {
          hasInitializedRef.current = true;
          const pathParts = window.location.pathname.split('/').filter(Boolean);
          const pathTableId = pathParts.length >= 3 && pathParts[1] === 'schema' ? pathParts[2] : null;
          const params = new URLSearchParams(window.location.search);
          const urlTableId = pathTableId || params.get('tableId') || params.get('id');

          if (urlTableId) {
            const match = rows.find((t: any) => t.id === urlTableId || t.tableName === urlTableId);
            if (match) {
              setSelectedTable(match);
              setViewMode('detail');
              setDetailName(match.name || '');
              setDetailDesc(match.description || '');
              setSavedDetail({ name: match.name || '', description: match.description || '' });
              fetchLayouts(match.id);
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch tables:', error);
    }
  }, [fetchLayouts]);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  useEffect(() => {
    if (selectedTable) {
      const updated = tables.find(t => t.id === selectedTable.id);
      if (updated) {
        setSelectedTable(updated);
      }
    }
  }, [tables]);

  const saveGeneralInfo = async () => {
    if (!selectedTable || !detailName.trim()) return;
    setIsSavingDetail(true);
    try {
      const res = await fetch(`/api/metadata/objects/${selectedTable.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: detailName,
          description: detailDesc
        })
      });
      if (res.ok) {
        setSavedDetail({ name: detailName, description: detailDesc });
        fetchTables();
      } else {
        const data = await res.json();
        setErrorMsg(data.error || t('admin_object_manager.error.updateTableFailed'));
      }
    } catch (error) {
      console.error('Error updating table:', error);
    } finally {
      setIsSavingDetail(false);
    }
  };

  const triggerDeleteTable = (table: SailsTableDefinition) => {
    setDeleteConfirmTarget({
      type: 'table',
      id: table.id,
      name: table.name,
      extra: table.tableName
    });
  };

  const triggerDeleteField = (fieldId: string, fieldName: string) => {
    setDeleteConfirmTarget({
      type: 'field',
      id: fieldId,
      name: fieldName
    });
  };

  const executeDeleteTable = async (tableId: string) => {
    try {
      const res = await fetch(`/api/metadata/objects/${tableId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        if (selectedTable?.id === tableId) {
          setSelectedTable(null);
          setViewMode('list');
        }
        fetchTables();
      } else {
        const data = await res.json();
        setErrorMsg(data.error || t('admin_object_manager.error.deleteTableFailed'));
      }
    } catch (error) {
      console.error('Error deleting table:', error);
    }
  };

  const executeDeleteField = async (fieldId: string) => {
    try {
      const res = await fetch(`/api/metadata/fields/${fieldId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        fetchTables();
      } else {
        const data = await res.json();
        setErrorMsg(data.error || t('admin_object_manager.error.deleteFieldFailed'));
      }
    } catch (error) {
      console.error('Error deleting field:', error);
    }
  };

  const handleCreateTable = async () => {
    if (!newTableName || !newTableDbName) return;

    // Validation: System Name must be in valid snake_case
    const dbNameRegex = /^[a-z0-9]+(_[a-z0-9]+)*$/;

    if (!dbNameRegex.test(newTableDbName)) {
      setErrorMsg(t('admin_object_manager.error.snakeCaseTable'));
      return;
    }
    
    try {
      const res = await fetch('/api/metadata/objects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTableName,
          tableName: newTableDbName,
          description: newTableDesc
        })
      });
      if (res.ok) {
        setIsCreatingTable(false);
        setNewTableName('');
        setNewTableDbName('');
        setNewTableDesc('');
        fetchTables();
      } else {
        const data = await res.json();
        setErrorMsg(data.error || t('admin_object_manager.error.createTableFailed'));
      }
    } catch (error) {
      console.error('Error creating table:', error);
    }
  };

  const handleCreateField = async () => {
    if (!selectedTable || !newFieldName || !newFieldDbName) return;

    // Validation: System Name must be in valid snake_case
    const dbNameRegex = /^[a-z0-9]+(_[a-z0-9]+)*$/;

    if (!dbNameRegex.test(newFieldDbName)) {
      setErrorMsg(t('admin_object_manager.error.snakeCaseField'));
      return;
    }

    const activeMeta = fieldTypeMetadataList.find(t => t.type === newFieldLogicalType);
    const physicalType = activeMeta?.physicalType || 'text';

    // Process dynamic config values (e.g. convert newline-separated optionsText to options array for custom list)
    const finalConfig: Record<string, any> = { ...dynamicConfigValues };
    if (newFieldLogicalType === 'select') {
      if (finalConfig.sourceType !== 'object') {
        if (typeof finalConfig.optionsText === 'string') {
          const optionsArr = finalConfig.optionsText
            .split('\n')
            .map((s: string) => s.trim())
            .filter(Boolean)
            .map((opt: string) => ({ label: opt, value: opt.toLowerCase().replace(/\s+/g, '_') }));
          finalConfig.options = optionsArr;
        }
        delete finalConfig.optionsText;
        delete finalConfig.sourceTable;
        delete finalConfig.sourceColumn;
        delete finalConfig.sourceFilter;
      } else {
        delete finalConfig.optionsText;
        delete finalConfig.options;
      }
    }


    try {
      const res = await fetch('/api/metadata/fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId: selectedTable.id,
          name: newFieldName,
          fieldName: newFieldDbName,
          logicalType: newFieldLogicalType,
          physicalType: physicalType,
          isRequired: newFieldRequired,
          description: newFieldDesc,
          config: finalConfig
        })
      });

      if (res.ok) {
        setIsCreatingField(false);
        resetFieldParams();
        fetchTables();
      } else {
        const data = await res.json();
        setErrorMsg(data.error || t('admin_object_manager.error.createFieldFailed'));
      }
    } catch (error) {
      console.error('Error creating field:', error);
    }
  };

  const openEditFieldModal = (field: any) => {
    if (field?.isSystem) return; // system fields are locked
    setEditingField(field);
    setEditFieldWizardStep(1);
    setEditFieldName(field.name);
    setEditFieldDbName(field.fieldName);
    setEditFieldDesc(field.description || '');
    setEditFieldRequired(!!field.isRequired);
    setEditFieldLogicalType(field.logicalType);

    const cfg = field.config || {};
    if (field.logicalType === 'select') {
      if (cfg.sourceType === 'object') {
        setEditDynamicConfigValues({
          sourceType: 'object',
          sourceTable: cfg.sourceTable || '',
          sourceColumn: cfg.sourceColumn || '',
          allowMultiple: !!cfg.allowMultiple,
          sourceFilter: Array.isArray(cfg.sourceFilter) ? cfg.sourceFilter : undefined
        });
      } else {
        const text = Array.isArray(cfg.options)
          ? cfg.options.map((o: any) => (typeof o === 'string' ? o : o.label || o.value)).join('\n')
          : (cfg.optionsText || '');
        setEditDynamicConfigValues({
          sourceType: 'custom',
          optionsText: text,
          allowMultiple: !!cfg.allowMultiple
        });
      }
    } else {
      setEditDynamicConfigValues({ ...cfg });
    }
  };

  const handleUpdateField = async () => {
    if (!editingField || !editFieldName || !editFieldDbName) return;

    const finalConfig: Record<string, any> = { ...editDynamicConfigValues };
    if (editFieldLogicalType === 'select') {
      if (finalConfig.sourceType !== 'object') {
        if (typeof finalConfig.optionsText === 'string' && finalConfig.optionsText.trim()) {
          const optionsArr = finalConfig.optionsText
            .split('\n')
            .map((s: string) => s.trim())
            .filter(Boolean)
            .map((opt: string) => ({ label: opt, value: opt.toLowerCase().replace(/\s+/g, '_') }));
          finalConfig.options = optionsArr;
        } else if (Array.isArray((editingField?.config || {}).options) && (editingField?.config || ({} as any)).options.length > 0) {
          // Keep existing options when the textarea is empty — prevents
          // accidental wipes on edits that only touch other fields.
          finalConfig.options = [...(editingField!.config as any).options];
        }
        delete finalConfig.optionsText;
        delete finalConfig.sourceTable;
        delete finalConfig.sourceColumn;
        delete finalConfig.sourceFilter;
      } else {
        delete finalConfig.optionsText;
        delete finalConfig.options;
      }
    }

    try {
      const res = await fetch(`/api/metadata/fields/${editingField.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editFieldName,
          fieldName: editFieldDbName,
          description: editFieldDesc,
          isRequired: editFieldRequired,
          logicalType: editFieldLogicalType,
          config: finalConfig
        })
      });

      if (res.ok) {
        const data = await res.json();
        const updatedField = data.field || {
          ...editingField,
          name: editFieldName,
          fieldName: editFieldDbName,
          description: editFieldDesc,
          isRequired: editFieldRequired,
          logicalType: editFieldLogicalType,
          config: finalConfig
        };

        if (selectedTable) {
          const updatedFields = selectedTable.fields?.map(f => f.id === editingField.id ? updatedField : f) || [];
          const updatedTable = { ...selectedTable, fields: updatedFields };
          setSelectedTable(updatedTable);
          setTables(prev => prev.map(t => t.id === selectedTable.id ? updatedTable : t));
        }

        setEditingField(null);
      } else {
        const data = await res.json();
        setErrorMsg(data.error || t('admin_object_manager.error.updateFieldFailed'));
      }
    } catch (error) {
      console.error('Error updating field:', error);
      setErrorMsg(t('admin_object_manager.error.updateFieldError'));
    }
  };

  // Helper function to highlight search phrase matches
  const renderHighlightedText = (text: string, query: string): React.ReactNode => {
    if (!query || !query.trim() || !text) return text;
    const trimmedQuery = query.trim();
    const escapedQuery = trimmedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    const parts = text.split(regex);

    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === trimmedQuery.toLowerCase() ? (
            <mark key={i} className="om-search-highlight">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  };

  // Filtered tables based on search term and sorting
  const filteredTables = useMemo(() => {
    let list = [...tables];
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter(t => {
        const nameMatch = t.name?.toLowerCase().includes(q);
        const dbNameMatch = t.tableName?.toLowerCase().includes(q);
        const descMatch = t.description?.toLowerCase().includes(q);
        
        const fieldsCount = t._count?.fields ?? t.fields?.length ?? 0;
        const fieldsStr = `${fieldsCount} fields`;
        const fieldsMatch = fieldsStr.toLowerCase().includes(q);

        const dateStr = t.createdAt ? formatSystemDateTimeValue(t.createdAt, datetimePrefs) : '';
        const dateMatch = dateStr.toLowerCase().includes(q);

        const updatedDateStr = t.updatedAt ? formatSystemDateTimeValue(t.updatedAt, datetimePrefs) : (t.createdAt ? formatSystemDateTimeValue(t.createdAt, datetimePrefs) : '');
        const updatedDateMatch = updatedDateStr.toLowerCase().includes(q);

        return nameMatch || dbNameMatch || descMatch || fieldsMatch || dateMatch || updatedDateMatch;
      });
    }

    if (tableSortConfig !== null) {
      list.sort((a, b) => {
        let valA: any = '';
        let valB: any = '';

        if (tableSortConfig.key === 'name') {
          valA = a.name || '';
          valB = b.name || '';
        } else if (tableSortConfig.key === 'description') {
          valA = a.description || '';
          valB = b.description || '';
        } else if (tableSortConfig.key === 'isSystem') {
          valA = a.isSystem ? 1 : 0;
          valB = b.isSystem ? 1 : 0;
        } else if (tableSortConfig.key === 'fields') {
          valA = a._count?.fields ?? a.fields?.length ?? 0;
          valB = b._count?.fields ?? b.fields?.length ?? 0;
        } else if (tableSortConfig.key === 'createdAt') {
          valA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          valB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        } else if (tableSortConfig.key === 'updatedAt') {
          valA = a.updatedAt ? new Date(a.updatedAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
          valB = b.updatedAt ? new Date(b.updatedAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        }

        if (valA < valB) return tableSortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return tableSortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return list;
  }, [tables, searchTerm, tableSortConfig]);

  // Reset to page 1 when search term or page size changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, pageSize]);

  // Pagination calculations
  const totalCount = filteredTables.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const startRange = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRange = Math.min(currentPage * pageSize, totalCount);

  const paginatedTables = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTables.slice(start, start + pageSize);
  }, [filteredTables, currentPage, pageSize]);

  // Filtered fields based on fieldSearchTerm and sorting
  const filteredFields = useMemo(() => {
    let fields = [...(selectedTable?.fields || [])];
    if (fieldSearchTerm.trim()) {
      const q = fieldSearchTerm.trim().toLowerCase();
      fields = fields.filter(f => {
        const nameMatch = f.name?.toLowerCase().includes(q);
        const descMatch = f.description?.toLowerCase().includes(q);
        const dbNameMatch = f.fieldName?.toLowerCase().includes(q);
        const logicalTypeMatch = f.logicalType?.toLowerCase().includes(q);
        const physicalTypeMatch = f.physicalType?.toLowerCase().includes(q);
        const reqStr = f.isRequired ? 'required' : 'optional';
        const reqMatch = reqStr.includes(q);

        return nameMatch || descMatch || dbNameMatch || logicalTypeMatch || physicalTypeMatch || reqMatch;
      });
    }

    if (fieldSortConfig !== null) {
      fields.sort((a, b) => {
        let valA: any = '';
        let valB: any = '';

        if (fieldSortConfig.key === 'name') {
          valA = a.name || '';
          valB = b.name || '';
        } else if (fieldSortConfig.key === 'description') {
          valA = a.description || '';
          valB = b.description || '';
        } else if (fieldSortConfig.key === 'logicalType') {
          valA = a.logicalType || '';
          valB = b.logicalType || '';
        } else if (fieldSortConfig.key === 'isSystem') {
          valA = a.isSystem ? 1 : 0;
          valB = b.isSystem ? 1 : 0;
        } else if (fieldSortConfig.key === 'isRequired') {
          valA = a.isRequired ? 1 : 0;
          valB = b.isRequired ? 1 : 0;
        }

        if (valA < valB) return fieldSortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return fieldSortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return fields;
  }, [selectedTable?.fields, fieldSearchTerm, fieldSortConfig]);

  // Reset field page to 1 when search or page size changes
  useEffect(() => {
    setFieldCurrentPage(1);
  }, [fieldSearchTerm, fieldPageSize]);

  // Field pagination calculations
  const totalFieldCount = filteredFields.length;
  const totalFieldPages = Math.ceil(totalFieldCount / fieldPageSize) || 1;
  const fieldStartRange = totalFieldCount === 0 ? 0 : (fieldCurrentPage - 1) * fieldPageSize + 1;
  const fieldEndRange = Math.min(fieldCurrentPage * fieldPageSize, totalFieldCount);

  const paginatedFields = useMemo(() => {
    const start = (fieldCurrentPage - 1) * fieldPageSize;
    return filteredFields.slice(start, start + fieldPageSize);
  }, [filteredFields, fieldCurrentPage, fieldPageSize]);

  // Set header actions dynamically based on viewMode
  const memoizedHeaderActions = useMemo(() => {
    if (viewMode === 'list') {
      return (
        <button 
          className="sails-btn sails-btn--primary" 
          onClick={() => setIsCreatingTable(true)}
        >
          <Plus size={18} />
           <span>{t('admin_object_manager.addTable')}</span>
        </button>
      );
    } else {
      return (
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            className="sails-btn sails-btn--secondary" 
            onClick={() => { setViewMode('list'); setSelectedTable(null); window.history.pushState({}, '', '/admin/schema'); }}
          >
            <ArrowLeft size={18} />
            <span>{t('admin_object_manager.backToDataModels')}</span>
          </button>
        </div>
      );
    }
  }, [viewMode, selectedTable]);

  useEffect(() => {
    setHeaderActions(memoizedHeaderActions);
    return () => setHeaderActions(null);
  }, [setHeaderActions, memoizedHeaderActions]);

  const selectRow = (table: SailsTableDefinition, initialTab?: DetailTab) => {
    setSelectedTable(table);
    setActiveDetailTab(initialTab || 'fields');
    setDetailName(table.name);
    setDetailDesc(table.description || '');
    setSavedDetail({ name: table.name, description: table.description || '' });
    setViewMode('detail');
    fetchLayouts(table.id);
    window.history.pushState({}, '', `/admin/schema/${table.id}`);
  };

  return (
    <div className="object-manager-container-full">
      {viewMode === 'list' ? (
        <div className="om-list-view">
          {/* Search bar */}
          <div className="om-toolbar">
            <div className="om-search-wrapper">
              <Search size={18} className="om-search-icon" />
              <input
                type="text"
                placeholder={t('admin_object_manager.searchModels')}
                className="om-search-input"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Master Table Grid */}
          <UiTableCard>
            <UiTable>
              <thead>
                <tr>
                  <UiTh sortable sortState={tableSortConfig?.key === 'name' ? tableSortConfig.direction : 'idle'} onSort={() => handleTableSort('name')}>{t('admin_object_manager.columns.name')}</UiTh>
                  <UiTh sortable sortState={tableSortConfig?.key === 'description' ? tableSortConfig.direction : 'idle'} onSort={() => handleTableSort('description')}>{t('admin_object_manager.columns.description')}</UiTh>
                  <UiTh sortable sortState={tableSortConfig?.key === 'isSystem' ? tableSortConfig.direction : 'idle'} onSort={() => handleTableSort('isSystem')}>{t('admin_object_manager.columns.modelType')}</UiTh>
                  <UiTh sortable sortState={tableSortConfig?.key === 'fields' ? tableSortConfig.direction : 'idle'} onSort={() => handleTableSort('fields')}>{t('admin_object_manager.columns.fields')}</UiTh>
                  <UiTh sortable sortState={tableSortConfig?.key === 'createdAt' ? tableSortConfig.direction : 'idle'} onSort={() => handleTableSort('createdAt')}>{t('admin_object_manager.columns.createdAt')}</UiTh>
                  <UiTh sortable sortState={tableSortConfig?.key === 'updatedAt' ? tableSortConfig.direction : 'idle'} onSort={() => handleTableSort('updatedAt')}>{t('admin_object_manager.columns.lastModified')}</UiTh>
                  <th style={{ textAlign: 'right', width: 48 }}></th>
                </tr>
              </thead>
              <tbody>
                {paginatedTables.map(table => {
                  const fieldsCount = table._count?.fields ?? table.fields?.length ?? 0;
                  const fieldsText = t('admin_object_manager.nFields', { count: fieldsCount });
                  const dateText = table.createdAt ? formatSystemDateTimeValue(table.createdAt, datetimePrefs) : t('admin_object_manager.notAvailable');
                  const updatedDateText = table.updatedAt ? formatSystemDateTimeValue(table.updatedAt, datetimePrefs) : (table.createdAt ? formatSystemDateTimeValue(table.createdAt, datetimePrefs) : t('admin_object_manager.notAvailable'));

                  return (
                    <UiTr key={table.id} onClick={() => selectRow(table)}>
                      <UiTd>
                        <UiNameCell
                          icon={<Layers size={18} />}
                          primary={renderHighlightedText(table.name, searchTerm)}
                          secondary={renderHighlightedText(table.tableName, searchTerm)}
                          secondaryAsCode
                        />
                      </UiTd>
                      <UiTd>
                        <span className="ui-desc-text">
                          {table.description ? renderHighlightedText(table.description, searchTerm) : 'No description provided.'}
                        </span>
                      </UiTd>
                      <UiTd>
                        {table.isSystem ? (
                          <UiBadge tone="info">{t('admin_object_manager.systemModel')}</UiBadge>
                        ) : (
                          <UiBadge tone="neutral">{t('admin_object_manager.customModel')}</UiBadge>
                        )}
                      </UiTd>
                      <UiTd>
                        <UiBadge tone="neutral">{renderHighlightedText(fieldsText, searchTerm)}</UiBadge>
                      </UiTd>
                      <UiTd>
                        <UiDateCell>
                          <Calendar size={14} />
                          {renderHighlightedText(dateText, searchTerm)}
                        </UiDateCell>
                      </UiTd>
                      <UiTd>
                        <UiDateCell>
                          <Calendar size={14} />
                          {renderHighlightedText(updatedDateText, searchTerm)}
                        </UiDateCell>
                      </UiTd>
                      <UiTd align="right" onClick={(e) => e.stopPropagation()}>
                        <UiActionsMenu open={activeMenuTableId === table.id} onToggle={() => setActiveMenuTableId(activeMenuTableId === table.id ? null : table.id)}>
                          <UiActionsItem onClick={() => { setActiveMenuTableId(null); selectRow(table, 'general'); }}>
                            <Edit2 size={14} /> {t('admin_object_manager.editDetails')}
                          </UiActionsItem>
                          <UiActionsItem onClick={() => { setActiveMenuTableId(null); selectRow(table, 'fields'); }}>
                            <Layers size={14} /> {t('admin_object_manager.manageFields')}
                          </UiActionsItem>
                          {!table.isSystem && (
                            <>
                              <UiActionsDivider />
                              <UiActionsItem danger onClick={() => { setActiveMenuTableId(null); triggerDeleteTable(table); }}>
                                <Trash2 size={14} /> {t('admin_object_manager.remove')}
                              </UiActionsItem>
                            </>
                          )}
                        </UiActionsMenu>
                      </UiTd>
                    </UiTr>
                  );
                })}
                {filteredTables.length === 0 && (
                  <tr>
                    <td colSpan={6} className="om-empty-state-row">
                      <Database size={40} className="om-empty-icon" />
                      <h3>{t('admin_object_manager.noDataModels')}</h3>
                      <p>{t('admin_object_manager.noDataModelsDesc')}</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </UiTable>

            <UiPagination
              page={currentPage}
              totalPages={totalPages}
              total={totalCount}
              pageSize={pageSize === totalCount ? 50 : pageSize}
              label={t('common.pagination.records')}
              onPageChange={(p) => setCurrentPage(p)}
              onPageSizeChange={(n) => { setPageSize(n); setCurrentPage(1); }}
              pageSizeOptions={[10, 25, 50]}
            />
          </UiTableCard>
        </div>
      ) : (
        selectedTable && (
          <div className="om-detail-view-full">
            {/* Stats grid */}
            <div className="om-stats-grid-full">
              <div className="sails-card om-stat-card-full">
                <label>{t('admin_object_manager.stats.totalFields')}</label>
                <div className="stat-value">{t('admin_object_manager.nFields', { count: selectedTable.fields?.length || 0 })}</div>
              </div>
              <div className="sails-card om-stat-card-full">
                <label>{t('admin_object_manager.stats.totalLayouts')}</label>
                <div className="stat-value">{t('admin_object_manager.nLayouts', { count: layouts.length })}</div>
              </div>
              <div className="sails-card om-stat-card-full">
                <label>{t('admin_object_manager.stats.totalPermissions')}</label>
                <div className="stat-value">{t('admin_object_manager.comingSoon')}</div>
              </div>
            </div>

            {/* Tab navigation */}
            <nav className="om-detail-tabs">
              {(['fields', 'layout', 'permission', 'general'] as DetailTab[]).map(tab => (
                <button
                  key={tab}
                  className={`om-detail-tab ${activeDetailTab === tab ? 'om-detail-tab--active' : ''}`}
                  onClick={() => handleDetailTabClick(tab)}
                >
                  <span>
                    {tab === 'general' && t('admin_object_manager.tabs.general')}
                    {tab === 'fields' && t('admin_object_manager.tabs.fields')}
                    {tab === 'layout' && t('admin_object_manager.tabs.layouts')}
                    {tab === 'permission' && t('admin_object_manager.tabs.permission')}
                  </span>
                  {tab === 'general' && isDetailDirty && <span className="om-detail-tab__dirty-dot" title={t('admin_object_manager.unsavedChanges.dot')} />}
                </button>
              ))}
            </nav>

            {/* Tab body */}
            <div className="om-detail-tab-body">
              {activeDetailTab === 'general' && (
                <div className="om-detail-tab-section">
                  <div className="om-form-grid-2">
                    <div className="om-field-group">
                      <label className="om-field-label">{t('admin_object_manager.form.tableName')}</label>
                      <input
                        type="text"
                        className="sails-input"
                        value={detailName}
                        onChange={e => setDetailName(e.target.value)}
                      />
                    </div>
                    <div className="om-field-group">
                      <label className="om-field-label">{t('admin_object_manager.columns.systemName')}</label>
                      <input
                        type="text"
                        className="sails-input"
                        value={selectedTable.tableName}
                        disabled
                        style={{ opacity: 0.6, cursor: 'not-allowed' }}
                      />
                      <span className="om-field-hint">{t('admin_object_manager.form.systemNameHint')}</span>
                    </div>
                  </div>
                  <div className="om-field-group">
                    <label className="om-field-label">{t('admin_object_manager.columns.description')}</label>
                    <textarea
                      className="sails-input"
                      rows={3}
                      value={detailDesc}
                      onChange={e => setDetailDesc(e.target.value)}
                      placeholder={t('admin_object_manager.form.descriptionPlaceholder')}
                      style={{ resize: 'vertical', minHeight: '80px' }}
                    />
                  </div>
                  <div className="om-detail-tab__save-row">
                    <button
                      className="sails-btn sails-btn--primary"
                      onClick={saveGeneralInfo}
                      disabled={!isDetailDirty || isSavingDetail}
                    >
                      <Save size={16} />
                      <span>{isSavingDetail ? 'Saving...' : 'Save General Settings'}</span>
                    </button>
                    {!selectedTable.isSystem && (
                      <button
                        className="sails-btn sails-btn--danger"
                        onClick={() => triggerDeleteTable(selectedTable)}
                        style={{ marginLeft: '12px' }}
                      >
                        <Trash2 size={16} />
                        <span>{t('admin_object_manager.deleteTable')}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {activeDetailTab === 'fields' && (
                <div className="om-detail-tab-section">
                  <div className="om-toolbar" style={{ marginBottom: '16px' }}>
                    <div className="om-search-wrapper">
                      <Search size={18} className="om-search-icon" />
                      <input
                        type="text"
                        placeholder={t('admin_object_manager.searchFields')}
                        className="om-search-input"
                        value={fieldSearchTerm}
                        onChange={e => setFieldSearchTerm(e.target.value)}
                      />
                    </div>
                    <button
                      className="sails-btn sails-btn--primary"
                      onClick={() => setIsCreatingField(true)}
                      style={{ marginLeft: '12px' }}
                    >
                      <Plus size={18} />
                      <span>{t('admin_object_manager.addField')}</span>
                    </button>
                  </div>

                  <div className="sails-card om-table-card">
                    <table className="om-list-table">
                      <thead>
                        <tr>
                          <th className="om-th-sortable" onClick={() => handleFieldSort('name')}>
                            <div className="om-th-content">
                              <span>{t('admin_object_manager.columns.name')}</span>
                              {getFieldSortIcon('name')}
                            </div>
                          </th>
                          <th className="om-th-sortable" onClick={() => handleFieldSort('description')}>
                            <div className="om-th-content">
                              <span>{t('admin_object_manager.columns.description')}</span>
                              {getFieldSortIcon('description')}
                            </div>
                          </th>
                          <th className="om-th-sortable" onClick={() => handleFieldSort('logicalType')}>
                            <div className="om-th-content">
                              <span>{t('admin_object_manager.columns.type')}</span>
                              {getFieldSortIcon('logicalType')}
                            </div>
                          </th>
                          <th className="om-th-sortable" onClick={() => handleFieldSort('isSystem')}>
                            <div className="om-th-content">
                              <span>{t('admin_object_manager.columns.category')}</span>
                              {getFieldSortIcon('isSystem')}
                            </div>
                          </th>
                          <th className="om-th-sortable" onClick={() => handleFieldSort('isRequired')}>
                            <div className="om-th-content">
                              <span>{t('admin_object_manager.columns.required')}</span>
                              {getFieldSortIcon('isRequired')}
                            </div>
                          </th>
                          <th style={{ textAlign: 'right' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedFields.map(field => {
                          const fieldTypeMeta = fieldTypeMetadataList.find(t => t.type === field.logicalType);
                          const displayLabel = fieldTypeMeta?.label || field.logicalType.replace('_', ' ').toUpperCase();

                          return (
                            <tr key={field.id} className={`om-clickable-row${field.isSystem ? ' om-row--locked' : ''}`} onClick={() => { if (!field.isSystem) openEditFieldModal(field); }}>
                              <td>
                                <div className="om-table-cell-name">
                                  <div className="om-table-icon-wrapper">
                                    <DynamicIcon name={fieldTypeMeta?.iconName || 'Settings'} size={18} />
                                  </div>
                                  <div>
                                    <div className="om-name-primary">
                                      {renderHighlightedText(field.name, fieldSearchTerm)}
                                    </div>
                                    <div className="om-name-secondary" style={{ fontSize: '0.75rem', color: 'var(--sails-text-muted)', marginTop: '2px' }}>
                                      <code>{renderHighlightedText(field.fieldName, fieldSearchTerm)}</code>
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <div style={{ color: 'var(--sails-text-main)', fontSize: '0.85rem', maxWidth: '320px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={field.description || ''}>
                                  {field.description ? renderHighlightedText(field.description, fieldSearchTerm) : <span style={{ color: 'var(--sails-text-muted)', fontStyle: 'italic' }}>{t('admin_object_manager.noDescription')}</span>}
                                </div>
                              </td>
                              <td>
                                <span className="om-badge" style={{ fontSize: '0.85rem' }}>
                                  {renderHighlightedText(displayLabel, fieldSearchTerm)}
                                </span>
                              </td>
                              <td>
                                {field.isSystem ? (
                                  <span className="om-badge" style={{ fontSize: '0.75rem', background: 'rgba(var(--sails-primary-r), var(--sails-primary-g), var(--sails-primary-b), 0.15)', color: 'var(--sails-primary)', border: '1px solid rgba(var(--sails-primary-r), var(--sails-primary-g), var(--sails-primary-b), 0.3)' }}>
                                    {t('admin_object_manager.form.isSystem')}
                                  </span>
                                ) : (
                                  <span className="om-badge" style={{ fontSize: '0.75rem', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--sails-text-main)', border: '1px solid var(--sails-border-color)' }}>
                                    {t('admin_object_manager.customField')}
                                  </span>
                                )}
                              </td>
                            <td>
                              {field.isRequired ? (
                                <span className="om-status-tag om-status-tag--required">
                                  <CheckCircle2 size={12} />
                                  {renderHighlightedText(t('admin_object_manager.form.required'), fieldSearchTerm)}
                                </span>
                              ) : (
                                <span className="om-status-tag om-status-tag--optional">
                                  {renderHighlightedText(t('admin_object_manager.form.optional'), fieldSearchTerm)}
                                </span>
                              )}
                            </td>
                            <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                              <div className="om-action-wrapper">
                                <button 
                                  className={`sails-btn sails-btn--ghost ${activeMenuFieldId === field.id ? 'active' : ''}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuFieldId(activeMenuFieldId === field.id ? null : field.id);
                                  }} 
                                  title={t('admin_object_manager.options')} 
                                   aria-label={t('admin_object_manager.options')}
                                >
                                  <MoreHorizontal size={18} />
                                </button>

                                {activeMenuFieldId === field.id && (
                                  <div className="om-context-menu" onClick={e => e.stopPropagation()}>
                                    {field.isSystem ? (
                                      <div className="om-context-item" style={{ opacity: 0.6, cursor: 'not-allowed' }}>
                                        <ShieldAlert size={14} />
                                        <span>{t('admin_object_manager.systemFieldLocked')}</span>
                                      </div>
                                    ) : (
                                      <>
                                        <button 
                                          className="om-context-item" 
                                          onClick={() => {
                                            setActiveMenuFieldId(null);
                                            openEditFieldModal(field);
                                          }}
                                        >
                                          <Edit2 size={14} />
                                          <span>{t('common.edit')}</span>
                                        </button>

                                        <div className="om-context-divider"></div>

                                        <button 
                                          className="om-context-item om-context-item--danger" 
                                          onClick={() => {
                                            setActiveMenuFieldId(null);
                                            triggerDeleteField(field.id, field.name);
                                          }}
                                        >
                                          <Trash2 size={14} />
                                          <span>{t('admin_object_manager.deleteField')}</span>
                                        </button>
                                      </>
                                    )}
                                  </div>
                                 )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                        {filteredFields.length === 0 && (
                          <tr>
                            <td colSpan={5} className="om-empty-state-row">
                              <Info size={40} className="om-empty-icon" />
                              <h3>{t('admin_object_manager.noFieldsFound')}</h3>
                              <p>{t('admin_object_manager.noFieldsFoundDesc')}</p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>

                    {/* Field Pagination Footer */}
                    <div className="sails-user-manager__pagination" style={{ borderTop: '1px solid var(--sails-border-color)' }}>
                      <div className="sails-user-manager__pagination-info">
                        <span className="sails-user-manager__pagination-range">
                          {t('admin_object_manager.pagination.showingRange', { from: fieldStartRange, to: fieldEndRange, total: totalFieldCount })}
                        </span>
                        <div className="sails-user-manager__page-size">
                          <span className="sails-user-manager__page-size-label">{t('admin_object_manager.pagination.recordsPerPage')}</span>
                          <CustomSelect
                            size="sm"
                            value={fieldPageSize === totalFieldCount ? 'all' : fieldPageSize}
                            options={[
                              { value: 10, label: '10' },
                              { value: 25, label: '25' },
                              { value: 50, label: '50' },
                              { value: 'all', label: 'ALL' }
                            ]}
                            onChange={(val) => {
                              setFieldPageSize(val === 'all' ? (totalFieldCount || 1000) : Number(val));
                              setFieldCurrentPage(1);
                            }}
                          />
                        </div>
                      </div>
                      <div className="sails-user-manager__pagination-controls">
                        <button
                          className="sails-pagination-btn"
                          onClick={() => setFieldCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={fieldCurrentPage === 1}
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <div className="sails-pagination-pages">
                          {[...Array(totalFieldPages)].map((_, i) => (
                            <button
                              key={i + 1}
                              className={`sails-pagination-page ${fieldCurrentPage === i + 1 ? 'sails-pagination-page--active' : ''}`}
                              onClick={() => setFieldCurrentPage(i + 1)}
                            >
                              {i + 1}
                            </button>
                          ))}
                        </div>
                        <button
                          className="sails-pagination-btn"
                          onClick={() => setFieldCurrentPage(prev => Math.min(totalFieldPages, prev + 1))}
                          disabled={fieldCurrentPage === totalFieldPages || totalFieldPages === 0}
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeDetailTab === 'layout' && (
                <div className="om-detail-tab-section">
                  <div className="om-toolbar" style={{ marginBottom: '16px', justifyContent: 'flex-end' }}>
                    <button
                      className="sails-btn sails-btn--primary"
                      onClick={() => selectedTable && window.open(`/layout-studio/${selectedTable.id}/_new`, '_blank')}
                    >
                      <Plus size={18} />
                      <span>{t('admin_view_manager.title')}</span>
                    </button>
                  </div>

                  {layoutsLoading ? (
                    <div style={{ textAlign: 'center', padding: '48px', color: 'var(--sails-text-muted)' }}>
                      {t('admin_object_manager.layouts.loading')}
                    </div>
                  ) : layouts.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '48px', color: 'var(--sails-text-muted)' }}>
                      <LayoutTemplate size={40} style={{ marginBottom: '16px', opacity: 0.3 }} />
                      <h3 style={{ marginBottom: '8px', color: 'var(--sails-text-main)' }}>{t('admin_object_manager.layouts.noneFound')}</h3>
                      <p>{t('admin_object_manager.layouts.noneFoundDesc')}</p>
                    </div>
                  ) : (
                    <div className="sails-card om-table-card">
                      <table className="om-list-table">
                        <thead>
                          <tr>
                            <th>
                              <div className="om-th-content">
                                <span>{t('admin_object_manager.columns.name')}</span>
                              </div>
                            </th>
                            <th>
                              <div className="om-th-content">
                                <span>{t('admin_view_manager.columns.type')}</span>
                              </div>
                            </th>
                            <th>
                              <div className="om-th-content">
                                <span>{t('admin_object_manager.default')}</span>
                              </div>
                            </th>
                            <th>
                              <div className="om-th-content">
                                <span>{t('admin_object_manager.columns.createdAt')}</span>
                              </div>
                            </th>
                            <th style={{ textAlign: 'right' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {layouts.map(layout => {
                            const LayoutIcon = VIEW_TYPE_LABELS[layout.viewType]?.icon || LayoutTemplate;
                            return (
                            <tr key={layout.id} className="om-clickable-row" onClick={() => selectedTable && window.open(`/layout-studio/${selectedTable.id}/${layout.id}`, '_blank')}>
                              <td>
                                <div className="om-table-cell-name">
                                  <div className="om-table-icon-wrapper">
                                    <LayoutIcon size={18} />
                                  </div>
                                  <div>
                                    <div className="om-name-primary">{layout.name}</div>
                                    {layout.description && (
                                      <div className="om-name-secondary" style={{ fontSize: '0.75rem', color: 'var(--sails-text-muted)', marginTop: '2px' }}>
                                        {layout.description}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span className={`om-layout-badge ${VIEW_TYPE_LABELS[layout.viewType]?.className || ''}`}
                                  style={{
                                    fontSize: '0.75rem',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    background: layout.viewType === 'LIST' ? 'rgba(59, 130, 246, 0.1)' : layout.viewType === 'DETAIL' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                    color: layout.viewType === 'LIST' ? '#93b4f5' : layout.viewType === 'DETAIL' ? '#6ee7b7' : '#fcd34d',
                                    border: `1px solid ${layout.viewType === 'LIST' ? 'rgba(59,130,246,0.3)' : layout.viewType === 'DETAIL' ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
                                  }}>
                                  {VIEW_TYPE_LABELS[layout.viewType]?.label || layout.viewType}
                                </span>
                              </td>
                              <td>
                                {layout.isDefault ? (
                                  <span style={{ fontSize: '0.8rem', color: 'var(--sails-primary)' }}>{t('admin_object_manager.default')}</span>
                                ) : (
                                  <span style={{ fontSize: '0.8rem', color: 'var(--sails-text-muted)' }}>—</span>
                                )}
                              </td>
                              <td>
                                <span className="om-date-cell">
                                  <Calendar size={14} style={{ marginRight: '4px' }} />
                                  {formatSystemDateTimeValue(layout.createdAt, datetimePrefs)}
                                </span>
                              </td>
                               <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                                <button
                                  className="sails-btn sails-btn--ghost"
                                  onClick={() => selectedTable && window.open(`/layout-studio/${selectedTable.id}/${layout.id}`, '_blank')}
                                  title={t('admin_object_manager.layouts.openInStudio')}
                                >
                                  <ExternalLink size={16} />
                                </button>
                              </td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeDetailTab === 'permission' && (
                <div className="om-detail-tab-section" style={{ textAlign: 'center', padding: '64px 32px' }}>
                  <div style={{ marginBottom: '16px' }}>
                    <ShieldCheck size={48} style={{ color: 'var(--sails-text-muted)', opacity: 0.4 }} />
                  </div>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--sails-text-main)', marginBottom: '8px' }}>
                    {t('admin_object_manager.permission.title')}
                  </h4>
                  <p style={{ color: 'var(--sails-text-muted)', marginBottom: '16px' }}>
                    {t('admin_object_manager.permission.description')}
                  </p>
                  <span style={{
                    fontSize: '0.8rem',
                    padding: '4px 12px',
                    borderRadius: '12px',
                    background: 'rgba(var(--sails-primary-r), var(--sails-primary-g), var(--sails-primary-b), 0.1)',
                    color: 'var(--sails-primary)',
                    border: '1px solid rgba(var(--sails-primary-r), var(--sails-primary-g), var(--sails-primary-b), 0.2)',
                  }}>
                    {t('admin_object_manager.comingSoon')}
                  </span>
                </div>
              )}
            </div>

            {/* Unsaved changes confirmation dialog */}
            {pendingDetailTabSwitch && createPortal(
              <div className="om-modal-overlay">
                <div className="sails-app-confirm-dialog">
                  <div className="sails-app-confirm-dialog__header">
                    <AlertCircle size={22} style={{ color: 'var(--sails-warning)' }} />
                    <span>{t('admin_object_manager.unsavedChanges.title')}</span>
                  </div>
                  <div className="sails-app-confirm-dialog__body">
                    {t('admin_object_manager.unsavedChanges.message')}
                  </div>
                  <div className="sails-app-confirm-dialog__footer">
                    <button className="sails-btn sails-btn--ghost" onClick={() => setPendingDetailTabSwitch(null)}>{t('admin_object_manager.unsavedChanges.stay')}</button>
                    <button className="sails-btn sails-app-confirm-dialog__btn-discard" onClick={handleDiscardDetailAndSwitch}>{t('admin_object_manager.unsavedChanges.discard')}</button>
                    <button className="sails-btn sails-btn--primary" onClick={handleSaveDetailAndSwitch}>{t('admin_object_manager.unsavedChanges.saveAndSwitch')}</button>
                  </div>
                </div>
              </div>,
              document.body
            )}
          </div>
        )
      )}

      {/* Create Data Model Big Modal */}
      {isCreatingTable && createPortal(
        <div className="om-modal-overlay">
          <div className="om-big-modal om-big-modal--md">
            <div className="om-modal-header">
              <div className="om-modal-header-info">
                <div className="om-modal-icon-badge">
                  <Database size={24} />
                </div>
                <div>
                  <h2 className="om-modal-title">{t('admin_object_manager.createTable')}</h2>
                  <p className="om-modal-subtitle">
                    {t('admin_object_manager.createTableDesc')}
                  </p>
                </div>
              </div>
              <button 
                className="om-modal-close" 
                onClick={() => {
                  setIsCreatingTable(false);
                  setNewTableName('');
                  setNewTableDbName('');
                  setNewTableDesc('');
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="om-modal-body">
              <div className="om-form-grid-2">
                <div className="om-field-group">
                  <label className="om-field-label">{t('admin_object_manager.form.tableName')}</label>
                  <input 
                    type="text" 
                    className="sails-input" 
                    placeholder={t('admin_object_manager.form.tableNamePlaceholder')} 
                    autoFocus 
                    value={newTableName}
                    onChange={e => {
                      const val = e.target.value;
                      setNewTableName(val);
                      setNewTableDbName(toSnakeCase(val));
                    }}
                  />
                </div>

                <div className="om-field-group">
                  <label className="om-field-label">{t('admin_object_manager.columns.systemName')}</label>
                  <input 
                    type="text" 
                    className="sails-input" 
                    placeholder={t('admin_object_manager.form.systemNamePlaceholder')} 
                    value={newTableDbName}
                    onChange={e => setNewTableDbName(e.target.value)}
                  />
                  <span className="om-field-hint">{t('admin_object_manager.form.snakeCaseHint')}</span>
                </div>
              </div>

              <div className="om-field-group">
                <label className="om-field-label">{t('admin_object_manager.columns.description')}</label>
                <textarea 
                  className="sails-input" 
                  placeholder={t('admin_object_manager.form.descriptionPlaceholder')} 
                  rows={3}
                  value={newTableDesc}
                  onChange={e => setNewTableDesc(e.target.value)}
                  style={{ resize: 'vertical', minHeight: '80px' }}
                />
              </div>
            </div>

            <div className="om-modal-footer">
              <button className="sails-btn sails-btn--ghost" onClick={() => setIsCreatingTable(false)}>{t('common.cancel')}</button>
              <button className="sails-btn sails-btn--primary" onClick={handleCreateTable}>{t('admin_object_manager.addTable')}</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Add Field Big Modal */}
      {isCreatingField && createPortal(
        <div className="om-modal-overlay">
          <div className="om-big-modal">
            <div className="om-modal-header">
              <div className="om-modal-header-info">
                <div className="om-modal-icon-badge">
                  <Plus size={24} />
                </div>
                <div>
                  <h2 className="om-modal-title">
                    Add New Field {fieldWizardStep === 1 ? t('admin_object_manager.wizard.step1of2') : t('admin_object_manager.wizard.step2of2')}
                  </h2>
                  <p className="om-modal-subtitle">
                    {fieldWizardStep === 1 
                      ? t('admin_object_manager.wizard.createFieldStep1Desc', { model: selectedTable?.name })
                      : t('admin_object_manager.wizard.createFieldStep2Desc', { field: newFieldName, type: newFieldLogicalType.toUpperCase().replace('_', ' ') })}
                  </p>
                </div>
              </div>
              <button 
                className="om-modal-close" 
                onClick={() => {
                  setIsCreatingField(false);
                  resetFieldParams();
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="om-modal-body">
              {fieldWizardStep === 1 ? (
                <>
                  {/* General Information */}
                  <div className="om-form-grid-2">
                    <div className="om-field-group">
                      <label className="om-field-label">{t('admin_object_manager.form.fieldName')}</label>
                      <input 
                        type="text" 
                        className="sails-input" 
                        placeholder={t('admin_object_manager.form.fieldNamePlaceholder')} 
                        autoFocus 
                        value={newFieldName}
                        onChange={e => {
                          const val = e.target.value;
                          setNewFieldName(val);
                          setNewFieldDbName(toSnakeCase(val));
                        }}
                      />
                    </div>

                    <div className="om-field-group">
                      <label className="om-field-label">{t('admin_object_manager.columns.systemName')}</label>
                      <input 
                        type="text" 
                        className="sails-input" 
                        placeholder={t('admin_object_manager.form.fieldSystemNamePlaceholder')} 
                        value={newFieldDbName}
                        onChange={e => setNewFieldDbName(e.target.value)}
                      />
                      <span className="om-field-hint">{t('admin_object_manager.form.fieldSnakeCaseHint')}</span>
                    </div>
                  </div>

                  {/* Required Field Checkbox right under Display Name / System Name */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', marginBottom: '16px' }}>
                    <input 
                      type="checkbox" 
                      checked={newFieldRequired}
                      onChange={e => setNewFieldRequired(e.target.checked)}
                      style={{ width: 'auto' }}
                    />
                    <label className="om-field-label" style={{ margin: 0 }}>{t('admin_object_manager.form.required')}</label>
                  </div>

                  <div className="om-field-group">
                    <label className="om-field-label">{t('admin_object_manager.columns.description')}</label>
                    <input 
                      type="text"
                      className="sails-input" 
                      placeholder={t('admin_object_manager.form.fieldDescriptionPlaceholder')} 
                      value={newFieldDesc}
                      onChange={e => setNewFieldDesc(e.target.value)}
                    />
                  </div>

                  {/* Logical Type Visual Grid (Dynamic from Registry Schema) */}
                  <div className="om-field-group">
                    <label className="om-field-label">{t('admin_object_manager.form.fieldType')}</label>
                    <div className="om-type-grid">
                      {fieldTypeMetadataList.map(t => {
                        const isActive = newFieldLogicalType === t.type;
                        return (
                          <div
                            key={t.type}
                            className={`om-type-card ${isActive ? 'om-type-card--active' : ''}`}
                            onClick={() => setNewFieldLogicalType(t.type)}
                          >
                            <div className="om-type-card-icon">
                              <DynamicIcon name={t.iconName || 'Type'} size={24} />
                            </div>
                            <span className="om-type-card-label">{t.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>

              ) : (
                <>
                  {/* Step 2: Metadata-Driven Dynamic Field Type Configuration */}
                  {(() => {
                    const activeFieldTypeMeta = fieldTypeMetadataList.find(t => t.type === newFieldLogicalType);

                    return (
                      <div className="om-config-section">

                        {newFieldLogicalType === 'select' ? (
                          <SelectOptionSourceConfig
                            values={dynamicConfigValues}
                            onChange={setDynamicConfigValues}
                            tables={tables}
                          />
                        ) : (!activeFieldTypeMeta?.parametersSchema || activeFieldTypeMeta.parametersSchema.length === 0) ? (
                          <p style={{ color: 'var(--sails-text-muted)', fontSize: '0.875rem', margin: 0 }}>
                            {t('admin_object_manager.wizard.noParams')}
                          </p>
                        ) : (
                          <div>
                            {newFieldLogicalType === 'auto_number' && (
                              <div style={{
                                padding: '12px 16px',
                                backgroundColor: 'rgba(var(--sails-primary-r), var(--sails-primary-g), var(--sails-primary-b), 0.08)',
                                border: '1px solid rgba(var(--sails-primary-r), var(--sails-primary-g), var(--sails-primary-b), 0.25)',
                                borderRadius: '8px',
                                marginBottom: '16px'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--sails-primary)', fontWeight: 600, fontSize: '0.875rem', marginBottom: '6px' }}>
                                  <Sparkles size={16} />
                                  <span>{t('admin_object_manager.wizard.autoNumberGuidance')}</span>
                                </div>
                                <p style={{ margin: '0 0 8px 0', fontSize: '0.8125rem', color: 'var(--sails-text-main)', lineHeight: '1.4' }}>
                                  {t('admin_object_manager.wizard.autoNumberHelp')}
                                </p>
                                <div style={{ fontSize: '0.75rem', color: 'var(--sails-text-muted)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
                                  <div><code>INV-0000</code> ➔ 4 digits (<code>INV-0001</code>)</div>
                                  <div><code>{`{yyyy}`}</code> / <code>{`{YYYY}`}</code> ➔ 4-digit Year</div>
                                  <div><code>INV-{`{yyyy}`}00000</code> ➔ Year + 5 digits</div>
                                  <div><code>{`{mm}`}</code> / <code>{`{MM}`}</code> ➔ 2-digit Month</div>
                                  <div><code>REQ-{`{yyyy}`}-{`{mm}`}-000-US</code></div>
                                  <div><code>{`{dd}`}</code> / <code>{`{DD}`}</code> ➔ 2-digit Day</div>
                                </div>
                              </div>
                            )}

                            {newFieldLogicalType === 'expression' && (
                              <div style={{
                                padding: '12px 16px',
                                backgroundColor: 'rgba(var(--sails-primary-r), var(--sails-primary-g), var(--sails-primary-b), 0.08)',
                                border: '1px solid rgba(var(--sails-primary-r), var(--sails-primary-g), var(--sails-primary-b), 0.25)',
                                borderRadius: '8px',
                                marginBottom: '16px'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--sails-primary)', fontWeight: 600, fontSize: '0.875rem', marginBottom: '6px' }}>
                                  <Sparkles size={16} />
                                  <span>{t('admin_object_manager.wizard.expressionGuidance')}</span>
                                </div>
                                <p style={{ margin: '0', fontSize: '0.8125rem', color: 'var(--sails-text-main)', lineHeight: '1.4' }}>
                                  {t('admin_object_manager.wizard.expressionHelp')}
                                </p>
                              </div>
                            )}

                            <div className="om-form-grid-2">
                              {activeFieldTypeMeta.parametersSchema.map((param: FieldParameterDefinition) => {
                                const vw = param.visibleWhen;
                                if (vw && (dynamicConfigValues[vw.name] ?? activeFieldTypeMeta.parametersSchema.find(p => p.name === vw.name)?.defaultValue) !== vw.equals) {
                                  return null;
                                }
                                if ((param.name === 'trueLabel' || param.name === 'falseLabel') && dynamicConfigValues['defaultControl'] !== 'control:boolean_dropdown') {
                                  return null;
                                }

                                // Selection field — source type rendered as tabs (standard pattern)
                                if (param.type === 'select' && param.name === 'sourceType') {
                                  const activeSource = dynamicConfigValues[param.name] ?? param.defaultValue ?? 'custom';
                                  return (
                                    <div key={param.name} className="om-field-group" style={{ gridColumn: '1 / -1' }}>
                                      <label className="om-field-label">{param.label}</label>
                                      <div style={{ display: 'flex', gap: 0, marginTop: 6, width: '100%' }}>
                                        {(param.options || []).map((opt: any) => (
                                          <button
                                            key={opt.value}
                                            type="button"
                                            className={`sails-tab-btn${activeSource === opt.value ? ' sails-tab-btn--active' : ''}`}
                                            style={{ flex: 1, justifyContent: 'center' }}
                                            onClick={() => setDynamicConfigValues((prev: any) => ({ ...prev, [param.name]: opt.value }))}
                                          >
                                            {opt.label}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                }

                                if (param.type === 'select') {
                                  return (
                                    <div key={param.name} className="om-field-group" style={param.name === 'resultType' ? { gridColumn: '1 / -1' } : undefined}>
                                      <label className="om-field-label">{param.label}</label>
                                      <CustomSelect
                                        size="md"
                                        searchable={!!param.searchable}
                                        value={dynamicConfigValues[param.name] ?? param.defaultValue ?? ''}
                                        options={param.options || []}
                                        onChange={val => setDynamicConfigValues(prev => {
                                          const next = { ...prev, [param.name]: val };
                                          if (param.name === 'defaultControl' && val !== 'control:boolean_dropdown') {
                                            delete next.trueLabel;
                                            delete next.falseLabel;
                                          }
                                          return next;
                                        })}
                                      />
                                      {param.description && (
                                        <small style={{ color: 'var(--sails-text-muted)', fontSize: '0.75rem', marginTop: '4px', display: 'block', lineHeight: '1.3' }}>
                                          {param.description}
                                        </small>
                                      )}
                                    </div>
                                  );
                                }

                                if (param.type === 'boolean') {
                                  return (
                                    <div key={param.name} className="om-field-group" style={{ justifyContent: 'center' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
                                        <input
                                          type="checkbox"
                                          checked={!!dynamicConfigValues[param.name]}
                                          onChange={e => setDynamicConfigValues(prev => ({ ...prev, [param.name]: e.target.checked }))}
                                          style={{ width: 'auto' }}
                                        />
                                        <label className="om-field-label" style={{ margin: 0 }}>{param.label}</label>
                                      </div>
                                      {param.description && (
                                        <small style={{ color: 'var(--sails-text-muted)', fontSize: '0.75rem', marginTop: '4px', display: 'block', lineHeight: '1.3' }}>
                                          {param.description}
                                        </small>
                                      )}
                                    </div>
                                  );
                                }

                                if (param.type === 'model_select') {
                                  return (
                                    <div key={param.name} className="om-field-group">
                                      <label className="om-field-label">{param.label} *</label>
                                      <CustomSelect
                                        size="md"
                                        searchable={true}
                                        value={dynamicConfigValues[param.name] || ''}
                                        options={tables.map(t => ({ value: t.tableName, label: `${t.name} (${t.tableName})` }))}
                                        onChange={val => setDynamicConfigValues(prev => ({ ...prev, [param.name]: val }))}
                                        placeholder={t('admin_object_manager.form.searchTargetModel')}
                                      />
                                      {param.description && (
                                        <small style={{ color: 'var(--sails-text-muted)', fontSize: '0.75rem', marginTop: '4px', display: 'block', lineHeight: '1.3' }}>
                                          {param.description}
                                        </small>
                                      )}
                                    </div>
                                  );
                                }

                                if (param.type === 'layout_select') {
                                  return (
                                    <div key={param.name} className="om-field-group">
                                      <label className="om-field-label">{param.label}</label>
                                      <LayoutSelectParam
                                        targetTable={dynamicConfigValues['targetTable'] || ''}
                                        value={dynamicConfigValues[param.name] || ''}
                                        onChange={val => setDynamicConfigValues(prev => ({ ...prev, [param.name]: val }))}
                                      />
                                      {param.description && (
                                        <small style={{ color: 'var(--sails-text-muted)', fontSize: '0.75rem', marginTop: '4px', display: 'block', lineHeight: '1.3' }}>
                                          {param.description}
                                        </small>
                                      )}
                                    </div>
                                  );
                                }

                                if (param.name === 'expression') {
                                  return (
                                    <ExpressionParam
                                      key={param.name}
                                      tables={tables}
                                      table={selectedTable}
                                      label={param.label}
                                      description={param.description}
                                      compact
                                      value={dynamicConfigValues[param.name]}
                                      onChange={v => setDynamicConfigValues((prev: any) => ({ ...prev, [param.name]: v }))}
                                    />
                                  );
                                }

                                if (param.type === 'textarea') {
                                  return (
                                    <div key={param.name} className="om-field-group om-field-group--full">
                                      <label className="om-field-label">{param.label}</label>
                                      <textarea
                                        className="sails-input"
                                        placeholder={param.placeholder}
                                        rows={4}
                                        value={dynamicConfigValues[param.name] || ''}
                                        onChange={e => setDynamicConfigValues(prev => ({ ...prev, [param.name]: e.target.value }))}
                                        style={{ resize: 'vertical' }}
                                      />
                                      {param.description && (
                                        <small style={{ color: 'var(--sails-text-muted)', fontSize: '0.75rem', marginTop: '4px', display: 'block', lineHeight: '1.3' }}>
                                          {param.description}
                                        </small>
                                      )}
                                    </div>
                                  );
                                }

                                return (
                                  <div key={param.name} className="om-field-group">
                                    <label className="om-field-label">{param.label}</label>
                                    <input
                                      type={param.type === 'number' ? 'number' : 'text'}
                                      className="sails-input"
                                      placeholder={param.placeholder}
                                      min={param.min}
                                      max={param.max}
                                      value={dynamicConfigValues[param.name] ?? ''}
                                      onChange={e => setDynamicConfigValues(prev => ({ 
                                        ...prev, 
                                        [param.name]: param.type === 'number' && e.target.value !== '' ? Number(e.target.value) : e.target.value 
                                      }))}
                                    />
                                    {param.description && (
                                      <small style={{ color: 'var(--sails-text-muted)', fontSize: '0.75rem', marginTop: '4px', display: 'block', lineHeight: '1.3' }}>
                                        {param.description}
                                      </small>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </>
              )}
            </div>

            <div className="om-modal-footer">
              {fieldWizardStep === 1 ? (
                <>
                  <button 
                    className="sails-btn sails-btn--ghost" 
                    onClick={() => {
                      setIsCreatingField(false);
                      resetFieldParams();
                    }}
                  >
                    {t('common.cancel')}
                  </button>
                  <button 
                    className="sails-btn sails-btn--primary" 
                    disabled={!newFieldName || !newFieldDbName}
                    onClick={() => setFieldWizardStep(2)}
                  >
                    {t('admin_object_manager.wizard.next')}
                  </button>
                </>
              ) : (
                <>
                  <button 
                    className="sails-btn sails-btn--ghost" 
                    onClick={() => setFieldWizardStep(1)}
                  >
                    {t('common.back')}
                  </button>
                  <button 
                    className="sails-btn sails-btn--primary" 
                    onClick={handleCreateField}
                  >
                    {t('admin_object_manager.addField')}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Field Modal (2-Step Wizard with Locked Field Type) */}
      {editingField && createPortal(
        <div className="om-modal-overlay">
          <div className="om-big-modal">
            <div className="om-modal-header">
              <div className="om-modal-header-info">
                <div className="om-modal-icon-badge">
                  <Sliders size={24} />
                </div>
                <div>
                  <h2 className="om-modal-title">
                    {t('admin_object_manager.editField')}: {editingField.name} {editFieldWizardStep === 1 ? t('admin_object_manager.wizard.step1of2') : t('admin_object_manager.wizard.step2of2')}
                  </h2>
                  <p className="om-modal-subtitle">
                    {editFieldWizardStep === 1 
                      ? t('admin_object_manager.wizard.editFieldStep1Desc', { field: editingField.fieldName })
                      : t('admin_object_manager.wizard.editFieldStep2Desc', { type: editFieldLogicalType.toUpperCase().replace('_', ' ') })}
                  </p>
                </div>
              </div>
              <button 
                className="om-modal-close" 
                onClick={() => setEditingField(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="om-modal-body">
              {editFieldWizardStep === 1 ? (
                <>
                  {/* General Information */}
                  <div className="om-form-grid-2">
                    <div className="om-field-group">
                      <label className="om-field-label">{t('admin_object_manager.form.fieldName')}</label>
                      <input 
                        type="text" 
                        className="sails-input" 
                        placeholder={t('admin_object_manager.form.fieldNamePlaceholder')} 
                        autoFocus 
                        value={editFieldName}
                        onChange={e => {
                          const val = e.target.value;
                          setEditFieldName(val);
                          setEditFieldDbName(toSnakeCase(val));
                        }}
                      />
                    </div>

                    <div className="om-field-group">
                      <label className="om-field-label">{t('admin_object_manager.columns.systemName')}</label>
                      <input 
                        type="text" 
                        className="sails-input" 
                        placeholder={t('admin_object_manager.form.fieldSystemNamePlaceholder')} 
                        value={editFieldDbName}
                        onChange={e => setEditFieldDbName(e.target.value)}
                      />
                      <span className="om-field-hint">{t('admin_object_manager.form.fieldSnakeCaseHint')}</span>
                    </div>
                  </div>

                  {/* Required Field Checkbox right under Display Name / System Name */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', marginBottom: '16px' }}>
                    <input 
                      type="checkbox" 
                      checked={editFieldRequired}
                      onChange={e => setEditFieldRequired(e.target.checked)}
                      style={{ width: 'auto' }}
                    />
                    <label className="om-field-label" style={{ margin: 0 }}>{t('admin_object_manager.form.required')}</label>
                  </div>

                  <div className="om-field-group">
                    <label className="om-field-label">{t('admin_object_manager.columns.description')}</label>
                    <input 
                      type="text"
                      className="sails-input" 
                      placeholder={t('admin_object_manager.form.fieldDescriptionPlaceholder')} 
                      value={editFieldDesc}
                      onChange={e => setEditFieldDesc(e.target.value)}
                    />
                  </div>

                  {/* Selectable Field Data Type Grid */}
                  <div className="om-field-group">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label className="om-field-label">{t('admin_object_manager.form.fieldType')}</label>
                      <span className="om-badge" style={{ fontSize: '0.75rem', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--sails-text-muted)' }}>
                        {t('admin_object_manager.editFieldValidationNote')}
                      </span>
                    </div>
                    <div className="om-type-grid">
                      {fieldTypeMetadataList.map(t => {
                        const isActive = editFieldLogicalType === t.type;
                        return (
                          <div
                            key={t.type}
                            className={`om-type-card ${isActive ? 'om-type-card--active' : ''}`}
                            onClick={() => setEditFieldLogicalType(t.type)}
                          >
                            <div className="om-type-card-icon">
                              <DynamicIcon name={t.iconName || 'Type'} size={24} />
                            </div>
                            <span className="om-type-card-label">{t.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Step 2: Metadata-Driven Dynamic Field Type Parameters */}
                  {(() => {
                    const activeFieldTypeMeta = fieldTypeMetadataList.find(t => t.type === editFieldLogicalType);

                    return (
                      <div className="om-config-section">

                        {editFieldLogicalType === 'select' ? (
                          <SelectOptionSourceConfig
                            values={editDynamicConfigValues}
                            onChange={setEditDynamicConfigValues}
                            tables={tables}
                          />
                        ) : (!activeFieldTypeMeta?.parametersSchema || activeFieldTypeMeta.parametersSchema.length === 0) ? (
                          <p style={{ color: 'var(--sails-text-muted)', fontSize: '0.875rem', margin: 0 }}>
                            {t('admin_object_manager.wizard.noParams')}
                          </p>
                        ) : (
                          <div>
                            {editFieldLogicalType === 'auto_number' && (
                              <div style={{
                                padding: '12px 16px',
                                backgroundColor: 'rgba(var(--sails-primary-r), var(--sails-primary-g), var(--sails-primary-b), 0.08)',
                                border: '1px solid rgba(var(--sails-primary-r), var(--sails-primary-g), var(--sails-primary-b), 0.25)',
                                borderRadius: '8px',
                                marginBottom: '16px'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--sails-primary)', fontWeight: 600, fontSize: '0.875rem', marginBottom: '6px' }}>
                                  <Sparkles size={16} />
                                  <span>{t('admin_object_manager.wizard.autoNumberGuidance')}</span>
                                </div>
                                <p style={{ margin: '0 0 8px 0', fontSize: '0.8125rem', color: 'var(--sails-text-main)', lineHeight: '1.4' }}>
                                  {t('admin_object_manager.wizard.autoNumberHelp')}
                                </p>
                                <div style={{ fontSize: '0.75rem', color: 'var(--sails-text-muted)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
                                  <div><code>INV-0000</code> ➔ 4 digits (<code>INV-0001</code>)</div>
                                  <div><code>{`{yyyy}`}</code> / <code>{`{YYYY}`}</code> ➔ 4-digit Year</div>
                                  <div><code>INV-{`{yyyy}`}00000</code> ➔ Year + 5 digits</div>
                                  <div><code>{`{mm}`}</code> / <code>{`{MM}`}</code> ➔ 2-digit Month</div>
                                  <div><code>REQ-{`{yyyy}`}-{`{mm}`}-000-US</code></div>
                                  <div><code>{`{dd}`}</code> / <code>{`{DD}`}</code> ➔ 2-digit Day</div>
                                </div>
                              </div>
                            )}

                            {editFieldLogicalType === 'expression' && (
                              <div style={{
                                padding: '12px 16px',
                                backgroundColor: 'rgba(var(--sails-primary-r), var(--sails-primary-g), var(--sails-primary-b), 0.08)',
                                border: '1px solid rgba(var(--sails-primary-r), var(--sails-primary-g), var(--sails-primary-b), 0.25)',
                                borderRadius: '8px',
                                marginBottom: '16px'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--sails-primary)', fontWeight: 600, fontSize: '0.875rem', marginBottom: '6px' }}>
                                  <Sparkles size={16} />
                                  <span>{t('admin_object_manager.wizard.expressionGuidance')}</span>
                                </div>
                                <p style={{ margin: '0', fontSize: '0.8125rem', color: 'var(--sails-text-main)', lineHeight: '1.4' }}>
                                  {t('admin_object_manager.wizard.expressionHelp')}
                                </p>
                              </div>
                            )}

                            <div className="om-form-grid-2">
                              {activeFieldTypeMeta.parametersSchema.map((param: FieldParameterDefinition) => {
                                const vw = param.visibleWhen;
                                if (vw && (editDynamicConfigValues[vw.name] ?? activeFieldTypeMeta.parametersSchema.find(p => p.name === vw.name)?.defaultValue) !== vw.equals) {
                                  return null;
                                }
                                if ((param.name === 'trueLabel' || param.name === 'falseLabel') && editDynamicConfigValues['defaultControl'] !== 'control:boolean_dropdown') {
                                  return null;
                                }

                                // Selection field — source type rendered as tabs (standard pattern)
                                if (param.type === 'select' && param.name === 'sourceType') {
                                  const activeSource = editDynamicConfigValues[param.name] ?? param.defaultValue ?? 'custom';
                                  return (
                                    <div key={param.name} className="om-field-group" style={{ gridColumn: '1 / -1' }}>
                                      <label className="om-field-label">{param.label}</label>
                                      <div style={{ display: 'flex', gap: 0, marginTop: 6, width: '100%' }}>
                                        {(param.options || []).map((opt: any) => (
                                          <button
                                            key={opt.value}
                                            type="button"
                                            className={`sails-tab-btn${activeSource === opt.value ? ' sails-tab-btn--active' : ''}`}
                                            style={{ flex: 1, justifyContent: 'center' }}
                                            onClick={() => setEditDynamicConfigValues((prev: any) => ({ ...prev, [param.name]: opt.value }))}
                                          >
                                            {opt.label}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                }

                                if (param.type === 'select') {
                                  return (
                                    <div key={param.name} className="om-field-group" style={param.name === 'resultType' ? { gridColumn: '1 / -1' } : undefined}>
                                      <label className="om-field-label">{param.label}</label>
                                      <CustomSelect
                                        size="md"
                                        searchable={!!param.searchable}
                                        value={editDynamicConfigValues[param.name] ?? param.defaultValue ?? ''}
                                        options={param.options || []}
                                        onChange={val => setEditDynamicConfigValues(prev => {
                                          const next = { ...prev, [param.name]: val };
                                          if (param.name === 'defaultControl' && val !== 'control:boolean_dropdown') {
                                            delete next.trueLabel;
                                            delete next.falseLabel;
                                          }
                                          return next;
                                        })}
                                      />
                                      {param.description && (
                                        <small style={{ color: 'var(--sails-text-muted)', fontSize: '0.75rem', marginTop: '4px', display: 'block', lineHeight: '1.3' }}>
                                          {param.description}
                                        </small>
                                      )}
                                    </div>
                                  );
                                }

                                if (param.type === 'boolean') {
                                  return (
                                    <div key={param.name} className="om-field-group" style={{ justifyContent: 'center' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
                                        <input
                                          type="checkbox"
                                          checked={!!editDynamicConfigValues[param.name]}
                                          onChange={e => setEditDynamicConfigValues(prev => ({ ...prev, [param.name]: e.target.checked }))}
                                          style={{ width: 'auto' }}
                                        />
                                        <label className="om-field-label" style={{ margin: 0 }}>{param.label}</label>
                                      </div>
                                      {param.description && (
                                        <small style={{ color: 'var(--sails-text-muted)', fontSize: '0.75rem', marginTop: '4px', display: 'block', lineHeight: '1.3' }}>
                                          {param.description}
                                        </small>
                                      )}
                                    </div>
                                  );
                                }

                                if (param.type === 'model_select') {
                                  return (
                                    <div key={param.name} className="om-field-group">
                                      <label className="om-field-label">{param.label} *</label>
                                      <CustomSelect
                                        size="md"
                                        searchable={true}
                                        value={editDynamicConfigValues[param.name] || ''}
                                        options={tables.map(t => ({ value: t.tableName, label: `${t.name} (${t.tableName})` }))}
                                        onChange={val => setEditDynamicConfigValues(prev => ({ ...prev, [param.name]: val }))}
                                        placeholder={t('admin_object_manager.form.searchTargetModel')}
                                      />
                                      {param.description && (
                                        <small style={{ color: 'var(--sails-text-muted)', fontSize: '0.75rem', marginTop: '4px', display: 'block', lineHeight: '1.3' }}>
                                          {param.description}
                                        </small>
                                      )}
                                    </div>
                                  );
                                }

                                if (param.type === 'layout_select') {
                                  return (
                                    <div key={param.name} className="om-field-group">
                                      <label className="om-field-label">{param.label}</label>
                                      <LayoutSelectParam
                                        targetTable={editDynamicConfigValues['targetTable'] || ''}
                                        value={editDynamicConfigValues[param.name] || ''}
                                        onChange={val => setEditDynamicConfigValues(prev => ({ ...prev, [param.name]: val }))}
                                      />
                                      {param.description && (
                                        <small style={{ color: 'var(--sails-text-muted)', fontSize: '0.75rem', marginTop: '4px', display: 'block', lineHeight: '1.3' }}>
                                          {param.description}
                                        </small>
                                      )}
                                    </div>
                                  );
                                }

                                if (param.name === 'expression') {
                                  return (
                                    <ExpressionParam
                                      key={param.name}
                                      tables={tables}
                                      table={selectedTable}
                                      label={param.label}
                                      description={param.description}
                                      compact
                                      value={editDynamicConfigValues[param.name]}
                                      onChange={v => setEditDynamicConfigValues((prev: any) => ({ ...prev, [param.name]: v }))}
                                    />
                                  );
                                }

                                if (param.type === 'textarea') {
                                  return (
                                    <div key={param.name} className="om-field-group om-field-group--full">
                                      <label className="om-field-label">{param.label}</label>
                                      <textarea
                                        className="sails-input"
                                        placeholder={param.placeholder}
                                        rows={4}
                                        value={editDynamicConfigValues[param.name] || ''}
                                        onChange={e => setEditDynamicConfigValues(prev => ({ ...prev, [param.name]: e.target.value }))}
                                        style={{ resize: 'vertical' }}
                                      />
                                      {param.description && (
                                        <small style={{ color: 'var(--sails-text-muted)', fontSize: '0.75rem', marginTop: '4px', display: 'block', lineHeight: '1.3' }}>
                                          {param.description}
                                        </small>
                                      )}
                                    </div>
                                  );
                                }

                                return (
                                  <div key={param.name} className="om-field-group">
                                    <label className="om-field-label">{param.label}</label>
                                    <input
                                      type={param.type === 'number' ? 'number' : 'text'}
                                      className="sails-input"
                                      placeholder={param.placeholder}
                                      min={param.min}
                                      max={param.max}
                                      value={editDynamicConfigValues[param.name] ?? ''}
                                      onChange={e => setEditDynamicConfigValues(prev => ({ 
                                        ...prev, 
                                        [param.name]: param.type === 'number' && e.target.value !== '' ? Number(e.target.value) : e.target.value 
                                      }))}
                                    />
                                    {param.description && (
                                      <small style={{ color: 'var(--sails-text-muted)', fontSize: '0.75rem', marginTop: '4px', display: 'block', lineHeight: '1.3' }}>
                                        {param.description}
                                      </small>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            {editFieldLogicalType === 'auto_number' && editingField && (
                              <div style={{
                                marginTop: '20px',
                                padding: '14px 16px',
                                backgroundColor: 'rgba(234, 179, 8, 0.06)',
                                border: '1px solid rgba(234, 179, 8, 0.25)',
                                borderRadius: '8px'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#eab308', fontWeight: 600, fontSize: '0.875rem', marginBottom: '6px' }}>
                                  <RefreshCw size={16} />
                                  <span>{t('admin_object_manager.resetSequenceTitle')}</span>
                                </div>
                                <p style={{ margin: '0 0 10px 0', fontSize: '0.8125rem', color: '#cbd5e1', lineHeight: '1.4' }}>
                                  {t('admin_object_manager.resetSequenceDesc')}
                                </p>
                                {resetSeqSuccessMsg && (
                                  <div style={{ margin: '0 0 10px 0', padding: '8px 12px', backgroundColor: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', borderRadius: '4px', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <CheckCircle2 size={16} />
                                    <span>{resetSeqSuccessMsg}</span>
                                  </div>
                                )}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <input
                                    type="number"
                                    className="sails-input"
                                    min={1}
                                    value={resetSeqValue}
                                    onChange={e => setResetSeqValue(Math.max(Number(e.target.value) || 1, 1))}
                                    style={{ width: '130px' }}
                                  />
                                  <button
                                    type="button"
                                    className="sails-btn sails-btn--secondary"
                                    onClick={() => handleResetSequence(editingField.id)}
                                    disabled={isResettingSeq}
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                                  >
                                    <RefreshCw size={14} className={isResettingSeq ? 'spin' : ''} />
                                    <span>{isResettingSeq ? 'Resetting...' : 'Reset Sequence'}</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </>
              )}
            </div>

            <div className="om-modal-footer">
              {editFieldWizardStep === 1 ? (
                <>
                  <button 
                    className="sails-btn sails-btn--ghost" 
                    onClick={() => setEditingField(null)}
                  >
                    {t('common.cancel')}
                  </button>
                  <button 
                    className="sails-btn sails-btn--primary" 
                    disabled={!editFieldName || !editFieldDbName}
                    onClick={() => setEditFieldWizardStep(2)}
                  >
                    {t('admin_object_manager.wizard.next')}
                  </button>
                </>
              ) : (
                <>
                  <button 
                    className="sails-btn sails-btn--ghost" 
                    onClick={() => setEditFieldWizardStep(1)}
                  >
                    {t('common.back')}
                  </button>
                  <button 
                    className="sails-btn sails-btn--primary" 
                    onClick={handleUpdateField}
                  >
                    {t('admin_object_manager.saveChanges')}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Nice Error Notification Modal */}
      {errorMsg && createPortal(
        <div className="om-modal-overlay" style={{ zIndex: 10000 }}>
          <div className="om-modal glass-morphism" style={{ width: '400px', textAlign: 'center', padding: '24px 32px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', color: 'var(--sails-danger, #ef4444)' }}>
              <XCircle size={48} />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 8px 0', color: 'white' }}>{t('admin_object_manager.error.title')}</h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--sails-text-muted)', margin: '0 0 24px 0', lineHeight: 1.5 }}>
              {errorMsg}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button 
                className="sails-btn sails-btn--primary" 
                onClick={() => setErrorMsg(null)}
                style={{ minWidth: '120px' }}
              >
                {t('admin_object_manager.error.dismiss')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* Custom Delete Confirmation Modal */}
      {deleteConfirmTarget && createPortal(
        <div className="om-modal-overlay" style={{ zIndex: 10000 }}>
          <div className="om-modal glass-morphism" style={{ width: '440px', padding: '32px' }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
              <div style={{ 
                background: 'rgba(253, 97, 97, 0.15)', 
                color: 'var(--sails-danger, #fd6161)', 
                padding: '12px', 
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Trash2 size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 600, margin: '0 0 8px 0', color: 'white' }}>
                  {deleteConfirmTarget.type === 'table' ? t('admin_object_manager.deleteTable') : t('admin_object_manager.deleteField')}
                </h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--sails-text-muted)', margin: '0 0 24px 0', lineHeight: 1.5 }}>
                  {deleteConfirmTarget.type === 'table' ? (
                    <>
                      {t('admin_object_manager.confirmDeleteTableMsg', { name: deleteConfirmTarget.name, tableName: deleteConfirmTarget.extra })}
                    </>
                  ) : (
                    <>
                      {t('admin_object_manager.confirmDeleteFieldMsg', { name: deleteConfirmTarget.name })}
                    </>
                  )}
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button 
                    className="sails-btn sails-btn--ghost" 
                    onClick={() => setDeleteConfirmTarget(null)}
                  >
                    {t('common.cancel')}
                  </button>
                  <button 
                    className="sails-btn" 
                    onClick={async () => {
                      const { type, id } = deleteConfirmTarget;
                      setDeleteConfirmTarget(null);
                      if (type === 'table') {
                        await executeDeleteTable(id);
                      } else {
                        await executeDeleteField(id);
                      }
                    }}
                    style={{ 
                      background: 'var(--sails-danger, #fd6161)', 
                      color: 'white',
                      border: 'none'
                    }}
                  >
                    Confirm Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default ObjectManager;
