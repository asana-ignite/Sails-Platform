import React, { useState, useEffect, useMemo, memo } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Table2,
  Save,
  Loader2,
  Pencil
} from 'lucide-react';
import type { TableLayout, SailsFieldDefinition, ConsoleMenu } from '@sails/shared';
import { isSystemField, SYSTEM_PROTECTED_COLUMNS } from '@sails/shared';
import LoadingScreen from '../components/common/LoadingScreen';
import RelatedListView from '../components/common/RelatedListView';
import { fetchCached } from '../api/client';
import { DetailFieldInput, DetailFieldDisplay, DetailFieldLabel, validateFieldIssues } from '../features/controls/DetailFieldControl';
import type { FieldValidation } from '../features/controls/types';
import { useConsole } from '../contexts/ConsoleContext';
import { useRecordStack } from '../contexts/RecordStackContext';
import './DynamicTablePage.css';
import './custom/LayoutStudio.css';
import './custom/layouts-responsive.css';

// ── Route Helper ──────────────────────────────────────────────
interface DetailRouteParams {
  appSlug: string;
  dataModelId: string | null;
  layoutKey: string | null;
  recordId: string | null;
  isNewMode: boolean;
}

/**
 * Resolves the current URL against the nav menu tree.
 * URL shape: /{appSlug}/{navPath}/{layoutKey}/{recordId}
 * e.g. /test/testtype/test_type_details_view/<recordId> or .../new
 */
const getDetailRouteParams = (pathname: string, menus: ConsoleMenu[]): DetailRouteParams => {
  const parts = pathname.split('/').filter(Boolean);
  const appSlug = parts[0] || 'admin';
  const normalize = (p: string | null) => p ? p.replace(/\/+$/, '').toLowerCase() : '';

  const allMenus: ConsoleMenu[] = [];
  const collect = (items: ConsoleMenu[]) => {
    for (const m of items) {
      allMenus.push(m);
      if (m.children) collect(m.children);
    }
  };
  collect(menus);

  const target = normalize(pathname);
  const matched = allMenus
    .filter(m => { const p = normalize(m.path); return !!p && target.startsWith(p + '/'); })
    .sort((a, b) => normalize(b.path).length - normalize(a.path).length)[0];

  if (!matched) {
    return { appSlug, dataModelId: null, layoutKey: null, recordId: null, isNewMode: false };
  }

  const rest = target.slice(normalize(matched.path).length).split('/').filter(Boolean);
  const layoutKey = rest[0] || null;
  const recordId = rest[1] || null;
  return {
    appSlug,
    dataModelId: matched.dataModelId || null,
    layoutKey,
    recordId,
    isNewMode: recordId === 'new',
  };
};

// ── Sub-Component: Page Header ────────────────────────────────
interface DetailHeaderProps {
  primaryTitle: string;
  subtitle: string;
  isNewMode: boolean;
  isEditing: boolean;
  saving: boolean;
  canEdit: boolean;
  onBack: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  showBack?: boolean;
}

const DetailHeader: React.FC<DetailHeaderProps> = memo(
  ({ primaryTitle, subtitle, isNewMode, isEditing, saving, canEdit, onBack, onEdit, onCancelEdit, showBack = true }) => (
    <header className="sails-page-header sails-dynamic-table__header">
      <div className="sails-page-header__left" style={{ pointerEvents: 'auto' }}>
        {showBack && (
          <button
            type="button"
            className="sails-btn sails-btn--secondary"
            onClick={onBack}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 8, marginRight: 12 }}
            title="Back"
          >
            <ChevronLeft size={16} />
          </button>
        )}
        <div>
          <h1 className="sails-page-header__title">{primaryTitle}</h1>
          <p className="sails-page-header__subtitle">{subtitle}</p>
        </div>
      </div>
      {isNewMode || isEditing ? (
        <div className="sails-page-header__right" style={{ pointerEvents: 'auto', display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="sails-btn sails-btn--secondary"
            onClick={isNewMode ? onBack : onCancelEdit}
            disabled={saving}
          >
            <span>Cancel</span>
          </button>
          <button
            type="submit"
            className="sails-btn sails-btn--primary"
            disabled={saving}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            {saving ? (
              <>
                <Loader2 size={16} className="sails-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span>{isNewMode ? 'Save Record' : 'Update Record'}</span>
              </>
            )}
          </button>
        </div>
      ) : canEdit ? (
        <div className="sails-page-header__right" style={{ pointerEvents: 'auto' }}>
          <button
            type="button"
            className="sails-btn sails-btn--primary"
            onClick={onEdit}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Pencil size={16} />
            <span>Edit</span>
          </button>
        </div>
      ) : null}
    </header>
  )
);

// ── Main Page Component ────────────────────────────────────────
interface DynamicDetailPageProps {
  /** When provided, override route-derived params (stacked card / generic route). */
  tableName?: string;
  layoutKey?: string;
  recordId?: string;
  isNewMode?: boolean;
  /** Pre-filled values for a new record (e.g. parent FK binding from a Related List block). */
  presetValues?: Record<string, any>;
  /** Render as a compact card shell (stacked record panel) instead of a full page. */
  inStack?: boolean;
}

const DynamicDetailPage: React.FC<DynamicDetailPageProps> = ({
  tableName: tableNameProp,
  layoutKey: layoutKeyProp,
  recordId: recordIdProp,
  isNewMode: isNewModeProp,
  presetValues,
  inStack = false,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const { navigationItems, apps } = useConsole();
  const { requestClose, notifyRecordsChanged } = useRecordStack();
  const animClass = navigationType === 'POP' ? 'sails-dynamic-table--back' : '';

  const [layout, setLayout] = useState<TableLayout | null>(null);
  const [fields, setFields] = useState<SailsFieldDefinition[]>([]);
  const [record, setRecord] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [tableName, setTableName] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [activeTabMap, setActiveTabMap] = useState<Record<string, number>>({});
  const [collapsedSectionMap, setCollapsedSectionMap] = useState<Record<string, boolean>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [saveAttempted, setSaveAttempted] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  const { dataModelId, layoutKey, recordId, isNewMode } = useMemo(() => {
    // 1. Explicit props (stacked record card) override everything else.
    if (tableNameProp) {
      return {
        dataModelId: tableNameProp,
        layoutKey: layoutKeyProp || null,
        recordId: recordIdProp || null,
        // A stacked "new" card opens the create form (not an existing record).
        isNewMode: isNewModeProp || recordIdProp === 'new',
      };
    }
    // 2. Generic record route: /_r/:tableName/:layoutKey/:recordId (menu-independent).
    const parts = location.pathname.split('/').filter(Boolean);
    if (parts[0] === '_r') {
      return {
        dataModelId: parts[1] || null,
        layoutKey: parts[2] || null,
        recordId: parts[3] || null,
        isNewMode: parts[3] === 'new',
      };
    }
    // 3. Menu-bound route (default).
    const menus = navigationItems.length > 0 ? navigationItems : (apps || []).flatMap(a => a.menus || []);
    return getDetailRouteParams(location.pathname, menus);
  }, [tableNameProp, layoutKeyProp, recordIdProp, isNewModeProp, location.pathname, navigationItems, apps]);

  // Base nav route without the layout/record segments.
  const baseRoute = useMemo(() => {
    if (tableNameProp) return `/_r/${tableNameProp}`;
    const parts = location.pathname.split('/').filter(Boolean);
    if (parts[0] === '_r') return `/_r/${parts[1] || ''}`;
    return '/' + parts.slice(0, Math.max(1, parts.length - 2)).join('/');
  }, [location.pathname, tableNameProp]);

  useEffect(() => {
    if (!dataModelId || !recordId) {
      setError('Invalid record detail route parameter');
      setLoading(false);
      return;
    }

    const loadDetailData = async () => {
      setLoading(true);
      setError(null);
      setSaveError(null);
      setIsEditing(false);
      setFormData({});
      setTouched({});
      setSaveAttempted(false);

      try {
        // Fetch the table's layouts once; resolve the layout from the URL segment
        // (matches layout system_name or id, e.g. /test/testtype/test_type_details_view/<id>)
        const lResult = await fetchCached(`/api/console/layouts?tableId=${dataModelId}&page=1&limit=100`);
        const rows: any[] = lResult?.data?.rows || lResult?.rows || [];

        const detailRows = rows.filter((r: any) => r.viewType === 'DETAIL' || r.viewType === 'FORM');
        let targetLayout: any = null;

        if (layoutKey) {
          targetLayout = detailRows.find((r: any) => r.systemName === layoutKey || r.id === layoutKey) || null;
        }
        if (!targetLayout) {
          targetLayout =
            detailRows.find((r: any) => r.status === 'active' && r.isDefault) ||
            detailRows.find((r: any) => r.status === 'active') ||
            detailRows[0] ||
            null;
        }

        const resolvedTableName = targetLayout?.table?.tableName || null;

        if (isNewMode) {
          let tableFields: SailsFieldDefinition[] = [];
          if (resolvedTableName) {
            const schemaRes = await fetch(`/api/dynamic/${resolvedTableName}?page=1&pageSize=1`);
            if (schemaRes.ok) {
              const schemaData = await schemaRes.json();
              tableFields = schemaData.fields || [];
            }
          }

          setFields(tableFields);
          setLayout(targetLayout || null);
          setTableName(resolvedTableName);
          setRecord({});

          const initialForm: Record<string, any> = {};
          tableFields.forEach((f) => {
            const key = f.fieldName || f.id;
            if (isSystemField(key)) return;
            // Auto-number is generated by the DB on insert — leave it out of the
            // payload so the column DEFAULT fires (and edit never re-runs it).
            if ((f.logicalType || '').toLowerCase() === 'auto_number') return;
            initialForm[key] = f.defaultValue !== undefined && f.defaultValue !== null
              ? f.defaultValue
              : '';
          });
          // Pre-filled values (e.g. parent FK binding from a Related List block)
          // win over defaults; hidden fields are still submitted on save.
          if (presetValues && typeof presetValues === 'object') {
            for (const [key, val] of Object.entries(presetValues)) {
              if (isSystemField(key)) continue;
              if (val === undefined || val === null || val === '') continue;
              initialForm[key] = val;
            }
          }
          setFormData(initialForm);
          setLoading(false);
          return;
        }

        if (!resolvedTableName) {
          setError('Data model table reference not found');
          setLoading(false);
          return;
        }

        setTableName(resolvedTableName);
        const recordsRes = await fetch(`/api/dynamic/${resolvedTableName}?id=${recordId}`);

        if (recordsRes.ok) {
          const recordsData = await recordsRes.json();
          const rowsArr = recordsData.rows || (Array.isArray(recordsData) ? recordsData : []);
          setRecord(rowsArr[0] || null);
          setFields(recordsData.fields || []);
        } else {
          setError('Failed to load record details');
        }

        setLayout(targetLayout || null);
      } catch (err: any) {
        setError(err.message || 'Failed to load record details');
      } finally {
        setLoading(false);
      }
    };

    loadDetailData();
  }, [location.pathname, dataModelId, layoutKey, recordId, isNewMode, presetValues]);

  const config = useMemo(() => {
    if (!layout) return null;
    let raw = layout.status === 'active' ? (layout.publishedConfig || layout.config) : layout.config;
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch (e) {}
    }
    return raw;
  }, [layout]);

  // Field → block validation rules (sections + tabs), keyed by fieldId.
  const blockRulesByField = useMemo(() => {
    const map: Record<string, FieldValidation[]> = {};
    const collect = (list: any[]) => {
      for (const b of list || []) {
        if (b?.validations?.length && b.fieldId) {
          map[b.fieldId] = b.validations;
        }
        if (b?.blockType === 'tab_group') {
          for (const t of b.tabs || []) collect(t.blocks);
        }
      }
    };
    collect((config as any)?.blocks || []);
    return map;
  }, [config]);

  const handleFieldInputChange = (key: string, value: any) => {
    setTouched((prev) => ({ ...prev, [key]: true }));
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleEditRecord = () => {
    if (!record) return;
    const initialForm: Record<string, any> = {};
    for (const field of fields) {
      const key = field.fieldName || field.id;
      if (!key || isSystemField(key)) continue;
      initialForm[key] = record[key] ?? record[field.id] ?? '';
    }
    setFormData(initialForm);
    setTouched({});
    setSaveAttempted(false);
    setSaveError(null);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setFormData({});
    setTouched({});
    setSaveAttempted(false);
    setSaveError(null);
  };

  const handleSaveRecord = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!tableName) return;

    // Client-side validation gate: metadata config rules + layout block rules.
    const issues: string[] = [];
    for (const field of fields) {
      const key = field.fieldName || field.id;
      if (!key || isSystemField(key)) continue;
      issues.push(...validateFieldIssues(field, formData[key], blockRulesByField[field.id], formData));
    }
    if (issues.length > 0) {
      setSaveAttempted(true);
      const first = issues[0];
      const more = issues.length > 1 ? ` (+${issues.length - 1} more)` : '';
      setSaveError(`Please fix the highlighted fields: ${first}${more}`);
      return;
    }

    const isUpdate = !isNewMode && isEditing;
    setSaving(true);
    setSaveError(null);

    try {
      const payload = isUpdate
        ? Object.fromEntries(Object.entries(formData).filter(([k]) => !SYSTEM_PROTECTED_COLUMNS.includes(k)))
        : formData;

      const res = await fetch(
        isUpdate ? `/api/dynamic/${tableName}?id=${recordId}` : `/api/dynamic/${tableName}`,
        {
          method: isUpdate ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();
      if (!res.ok || data.error || data.success === false) {
        throw new Error(data.error || data.message || 'Failed to save record.');
      }

      if (isUpdate) {
        const updatedRecord = data.record || data.data || (Array.isArray(data.rows) ? data.rows[0] : data.rows) || data;
        setRecord(updatedRecord || {});
        setIsEditing(false);
        setFormData({});
        setTouched({});
        setSaveAttempted(false);
      } else {
        const createdRecord = data.record || (Array.isArray(data.rows) ? data.rows[0] : data.rows) || data.data || data;
        const newId = createdRecord?.id || data.id;

        if (inStack) {
          // Stacked create: close the "new" card fully (no created-record card) and
          // tell lists/related blocks underneath to refetch so the record appears.
          requestClose();
          notifyRecordsChanged();
          return;
        }

        navigate(newId ? `${baseRoute}/${layoutKey}/${newId}` : baseRoute, {
          replace: true,
        });
      }
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save record.');
    } finally {
      setSaving(false);
    }
  };

  // Browser tab title: "Sails - <primary column value>" (e.g. "Sails - INV-0001").
  // Uses the layout's configured recordTitleField; skipped for stacked cards so
  // the underlying page keeps its tab title. The ConsoleProvider effect re-runs
  // after navigation and restores the menu/app title.
  useEffect(() => {
    if (inStack) return;
    const titleField = layout?.recordTitleField
      ? fields.find((f) => f.id === layout.recordTitleField)
        || fields.find((f) => f.fieldName === layout.recordTitleField)
        || fields.find((f) => f.name === layout.recordTitleField)
      : null;
    const primaryTitle = isNewMode
      ? `New ${tableName ? tableName.charAt(0).toUpperCase() + tableName.slice(1) : 'Record'}`
      : record
      ? (titleField && record[titleField.fieldName] != null && record[titleField.fieldName] !== ''
          ? record[titleField.fieldName]
          : record.name || record.title || record.label || record.id)
      : null;
    if (primaryTitle) {
      document.title = `Sails - ${primaryTitle}`;
    }
  }, [record, isNewMode, layout, fields, tableName, recordId, inStack]);

  if (loading) {
    return inStack ? (
      <div className="record-detail-card record-detail-card--loading">
        <LoadingScreen />
      </div>
    ) : (
      <LoadingScreen />
    );
  }

  if (error) {
    return (
      <div className={inStack ? 'record-detail-card' : `sails-dynamic-table sails-page-container ${animClass}`}>
        <header className="sails-page-header sails-dynamic-table__header">
          <div className="sails-page-header__left">
            <button className="sails-btn sails-btn--secondary" onClick={() => navigate(-1)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 8, marginRight: 12 }} title="Back">
              <ChevronLeft size={16} />
            </button>
            <AlertCircle size={24} />
            <div>
              <h1 className="sails-page-header__title">Record Detail Error</h1>
              <p className="sails-page-header__subtitle">{error}</p>
            </div>
          </div>
        </header>
      </div>
    );
  }

  const titleField = layout?.recordTitleField
    ? fields.find((f) => f.id === layout.recordTitleField)
      || fields.find((f) => f.fieldName === layout.recordTitleField)
      || fields.find((f) => f.name === layout.recordTitleField)
    : null;
  const primaryTitle = isNewMode
    ? `New ${tableName ? tableName.charAt(0).toUpperCase() + tableName.slice(1) : 'Record'}`
    : record
    ? (titleField && record[titleField.fieldName] != null && record[titleField.fieldName] !== ''
        ? record[titleField.fieldName]
        : record.name || record.title || record.label || record.id)
    : `Record #${recordId}`;

  const subtitle = isNewMode
    ? `Creating record using Detail Layout: ${layout?.name || 'Default'}`
    : layout?.name
    ? `Detail Layout: ${layout.name}`
    : 'Record Details';

  const userVisibleFields = fields.filter((f) => !isSystemField(f.fieldName || f.id));
  const sections: any[] = (config as any)?.sections?.length > 0 ? (config as any).sections : [{ id: 'default_sec', title: 'Record Properties', columns: 2 }];
  const blocks: any[] = (config as any)?.blocks || [];

  const renderBlock = (b: any) => {
    if (!b || b.visible === false) return null;

    if (b.blockType === 'field' || (!b.blockType && b.fieldId)) {
      const field = fields.find((f) => f.id === b.fieldId || f.fieldName === b.fieldId);
      if (!field) return null;

      const label = b.labelOverride || field.name;
      const key = field.fieldName || field.id;

      const colSpan = b.width ? (typeof b.width === 'number' ? b.width : 4) : 4;
      const isSystemFieldDef = !!field.isSystem || isSystemField(key);
      const isEditable = (isNewMode || isEditing) && !isSystemFieldDef;
      const val = isEditable ? formData[key] ?? '' : record ? record[field.fieldName] ?? record[field.id] : undefined;

      return (
        <div key={b.id || field.id} className="ls-block ls-block--field" style={{ gridColumn: `span ${colSpan}` }}>
          <DetailFieldLabel field={field} label={label} />
          {isSystemFieldDef ? (
            <div className="ls-block__value">
              <DetailFieldDisplay field={field} val={val} controlPluginId={b.controlPluginId} />
            </div>
          ) : isEditable ? (
            <DetailFieldInput
              field={field}
              fieldKey={key}
              label={label}
              val={val}
              controlPluginId={b.controlPluginId}
              rules={b.validations as FieldValidation[] | undefined}
              showErrors={!!touched[key] || saveAttempted}
              record={formData}
              onChange={handleFieldInputChange}
            />
          ) : (
            <div className="ls-block__value">
              <DetailFieldDisplay field={field} val={val} controlPluginId={b.controlPluginId} />
            </div>
          )}
        </div>
      );
    }

    if (b.blockType === 'tab_group') {
      const tabs = b.tabs || [];
      const activeTabIdx = activeTabMap[b.id] ?? 0;
      const activeTab = tabs[activeTabIdx];
      const activeBlocks = activeTab?.blocks || [];
      const colSpan = b.width ? (typeof b.width === 'number' ? b.width : 12) : 12;

      return (
        <div key={b.id} className="ls-block ls-block--tabs" style={{ gridColumn: `span ${colSpan}` }}>
          <div className="ls-tabs__bar">
            {tabs.map((tab: any, ti: number) => (
              <div
                key={tab.id || ti}
                className={`ls-tabs__tab ${ti === activeTabIdx ? 'ls-tabs__tab--active' : ''}`}
                onClick={() => setActiveTabMap((prev) => ({ ...prev, [b.id]: ti }))}
              >
                {tab.label}
                {tab.blocks?.length > 0 && <span className="ls-tabs__count">{tab.blocks.length}</span>}
              </div>
            ))}
          </div>
          <div className="ls-tabs__body">
            <div className="ls-section__grid">
              {activeBlocks.length > 0 ? (
                activeBlocks.map((tb: any) => renderBlock(tb))
              ) : (
                <p className="ls-tabs__hint" style={{ gridColumn: '1 / -1' }}>
                  No fields in this tab.
                </p>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (b.blockType === 'related_list') {
      if (isNewMode) return null;
      const colSpan = b.width ? (typeof b.width === 'number' ? b.width : 12) : 12;

      // Configured via "Related List View" block (model + FK field + LIST view).
      if (b.relatedTableName && b.relatedFieldName && recordId) {
        return (
          <div key={b.id} className="ls-block ls-block--related" style={{ gridColumn: `span ${colSpan}` }}>
            <RelatedListView
              tableName={b.relatedTableName}
              fieldName={b.relatedFieldName}
              viewId={b.relatedViewId}
              parentRecordId={recordId}
              title={b.labelOverride || b.relatedTableLabel || b.relatedTableName}
            />
          </div>
        );
      }

      return (
        <div key={b.id} className="ls-block ls-block--related" style={{ gridColumn: `span ${colSpan}` }}>
          <div className="ls-related__header">
            <Table2 size={14} />
            <span className="ls-related__title">{b.labelOverride || 'Related Records'}</span>
            <span className="ls-related__count">0 records</span>
          </div>
          <div className="ls-related__empty" style={{ padding: 16, textAlign: 'center', color: 'var(--sails-text-muted)', fontSize: '0.85rem' }}>
            Configure a model and list view for this block in Layout Studio.
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className={inStack ? 'record-detail-card' : `sails-dynamic-table sails-page-container ${animClass}`}>
      <form onSubmit={handleSaveRecord}>
        <DetailHeader
          primaryTitle={primaryTitle}
          subtitle={subtitle}
          isNewMode={isNewMode}
          isEditing={isEditing}
          saving={saving}
          canEdit={!isNewMode && !!record}
          onBack={inStack ? () => requestClose() : () => navigate(-1)}
          onEdit={handleEditRecord}
          onCancelEdit={handleCancelEdit}
          showBack={!inStack}
        />

        <section className="sails-page-body" style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', gap: 24 }}>
          {saveError && (
            <div className="sails-detail-error-banner">
              <AlertCircle size={18} />
              <span>{saveError}</span>
            </div>
          )}

          {record ? (
            blocks.length > 0 ? (
              sections.map((section: any) => {
                const sectionBlocks = blocks
                  .filter((b: any) => b.sectionId === section.id && b.visible !== false)
                  .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));

                if (sectionBlocks.length === 0) return null;

                const showHeader = section.showHeader !== false;
                const isCollapsible = !!section.collapsible;
                const isCollapsed = collapsedSectionMap[section.id] ?? section.collapsed ?? false;

                const header = showHeader ? (
                  isCollapsible ? (
                    <button
                      type="button"
                      className="sails-detail-section-header-btn"
                      onClick={() => setCollapsedSectionMap((prev) => ({ ...prev, [section.id]: !(prev[section.id] ?? section.collapsed ?? false) }))}
                    >
                      {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                      <span>{section.title || 'Section'}</span>
                    </button>
                  ) : (
                    <h3 className="sails-detail-section-title">{section.title || 'Section'}</h3>
                  )
                ) : null;

                return (
                  <div key={section.id} className="sails-detail-section-card">
                    {header}
                    {!isCollapsed && <div className="ls-section__grid">{sectionBlocks.map((b: any) => renderBlock(b))}</div>}
                  </div>
                );
              })
            ) : (
              <div className="sails-detail-section-card">
                <h3 className="sails-detail-section-title">Record Properties</h3>
                <div className="ls-section__grid">
                  {userVisibleFields.map((f, idx) =>
                    renderBlock({ id: f.id, fieldId: f.id, blockType: 'field', visible: true, width: 4, position: idx })
                  )}
                </div>
              </div>
            )
          ) : (
            <div className="sails-detail-section-card" style={{ textAlign: 'center' }}>
              <p className="ls-empty">Record not found.</p>
            </div>
          )}
        </section>
      </form>
    </div>
  );
};

export default DynamicDetailPage;
