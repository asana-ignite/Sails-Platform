import React, { useState, useEffect, useMemo, memo } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import {
  ChevronLeft,
  Database,
  AlertCircle,
  Table2,
  Save,
  Loader2
} from 'lucide-react';
import type { TableLayout, SailsFieldDefinition } from '@sails/shared';
import { isSystemField } from '@sails/shared';
import LoadingScreen from '../components/common/LoadingScreen';
import { fetchCached } from '../api/client';
import { FieldControlRegistry } from '../features/controls';
import './DynamicTablePage.css';
import './custom/LayoutStudio.css';
import './custom/layouts-responsive.css';

// ── Route Helper ──────────────────────────────────────────────
interface DetailRouteParams {
  appSlug: string;
  dataModelId: string | null;
  recordId: string | null;
  isNewMode: boolean;
}

const getDetailRouteParams = (pathname: string): DetailRouteParams => {
  const parts = pathname.split('/').filter(Boolean);
  const modelsIdx = parts.findIndex((p) => p === 'models' || p === 'objects');
  const appSlug = modelsIdx > 0 ? parts[modelsIdx - 1] : (parts[0] || 'admin');
  const dataModelId = modelsIdx >= 0 && parts.length > modelsIdx + 1 ? parts[modelsIdx + 1] : (parts.length >= 2 ? parts[1] : null);
  const recordId = modelsIdx >= 0 && parts.length > modelsIdx + 2 ? parts[modelsIdx + 2] : (parts.length >= 3 ? parts[2] : null);
  return { appSlug, dataModelId, recordId, isNewMode: recordId === 'new' };
};

// ── Sub-Component: Client-Side Field Input Control ────────────
interface FieldInputControlProps {
  field: SailsFieldDefinition;
  fieldKey: string;
  label: string;
  val: any;
  controlPluginId?: string;
  onChange: (key: string, value: any) => void;
}

const FieldInputControl: React.FC<FieldInputControlProps> = memo(({ field, fieldKey, label, val, controlPluginId, onChange }) => {
  const controlRegistry = FieldControlRegistry.getInstance();
  const logicalType = field.logicalType || field.physicalType || 'text';
  const effectiveControlId = controlPluginId || (field?.config as any)?.defaultControl || (field?.config as any)?.controlStyle;
  const controlPlugin = (effectiveControlId ? controlRegistry.getControl(effectiveControlId) : null) || controlRegistry.getFallbackControl(logicalType);

  if (controlPlugin && controlPlugin.RenderEdit) {
    const RenderEditComponent = controlPlugin.RenderEdit;
    return (
      <RenderEditComponent
        field={field}
        value={val}
        onChange={(v) => onChange(fieldKey, v)}
      />
    );
  }

  return (
    <input
      type="text"
      className="sails-detail-field-input"
      value={val ?? ''}
      onChange={(e) => onChange(fieldKey, e.target.value)}
      placeholder={`Enter ${label.toLowerCase()}...`}
      required={field.isRequired}
    />
  );
});

// ── Sub-Component: Page Header ────────────────────────────────
interface DetailHeaderProps {
  primaryTitle: string;
  subtitle: string;
  isNewMode: boolean;
  saving: boolean;
  onBack: () => void;
}

const DetailHeader: React.FC<DetailHeaderProps> = memo(({ primaryTitle, subtitle, isNewMode, saving, onBack }) => (
  <header className="sails-page-header sails-dynamic-table__header">
    <div className="sails-page-header__left" style={{ pointerEvents: 'auto' }}>
      <button
        type="button"
        className="sails-btn sails-btn--secondary"
        onClick={onBack}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginRight: 12 }}
      >
        <ChevronLeft size={16} />
        <span>Back</span>
      </button>
      <div className="sails-page-header__icon-wrapper">
        <Database size={24} />
      </div>
      <div>
        <h1 className="sails-page-header__title">{primaryTitle}</h1>
        <p className="sails-page-header__subtitle">{subtitle}</p>
      </div>
    </div>
    {isNewMode && (
      <div className="sails-page-header__right" style={{ pointerEvents: 'auto', display: 'flex', gap: 8 }}>
        <button type="button" className="sails-btn sails-btn--secondary" onClick={onBack} disabled={saving}>
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
              <span>Save Record</span>
            </>
          )}
        </button>
      </div>
    )}
  </header>
));

// ── Main Page Component ────────────────────────────────────────
const DynamicDetailPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
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

  const { appSlug, dataModelId, recordId, isNewMode } = useMemo(
    () => getDetailRouteParams(location.pathname),
    [location.pathname]
  );

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

      try {
        const searchParams = new URLSearchParams(window.location.search);
        const targetLayoutId = searchParams.get('layoutId');

        let targetLayout: any = null;
        let objectsData: any = null;

        if (targetLayoutId) {
          const layoutResult = await fetchCached(`/api/console/layouts?id=${targetLayoutId}`);
          if (layoutResult.success) targetLayout = layoutResult.data;
        } else {
          objectsData = await fetchCached('/api/metadata/objects', undefined, 60000);
        }

        const objectRows = Array.isArray(objectsData) ? objectsData : (objectsData?.rows || objectsData?.data || []);
        const foundTable = objectRows.find((t: any) => t.id === dataModelId || t.tableName === dataModelId);

        if (!targetLayout && dataModelId) {
          const lResult = await fetchCached(`/api/console/layouts?tableId=${dataModelId}`);
          if (lResult) {
            const rows: any[] = lResult.data?.rows || lResult.rows || [];
            targetLayout =
              rows.find((r: any) => (r.viewType === 'DETAIL' || r.viewType === 'FORM') && r.status === 'active' && r.isDefault) ||
              rows.find((r: any) => (r.viewType === 'DETAIL' || r.viewType === 'FORM') && r.status === 'active') ||
              rows.find((r: any) => r.viewType === 'DETAIL' || r.viewType === 'FORM');
          }
        }

        const resolvedTableName = targetLayout?.table?.tableName || foundTable?.tableName;

        if (isNewMode) {
          let tableFields: SailsFieldDefinition[] = foundTable?.fields || [];
          if (tableFields.length === 0 && resolvedTableName) {
            const schemaRes = await fetch(`/api/dynamic/${resolvedTableName}?page=1&pageSize=1`);
            if (schemaRes.ok) {
              const schemaData = await schemaRes.json();
              tableFields = schemaData.fields || [];
            }
          }

          setFields(tableFields);
          setLayout(targetLayout || null);
          setTableName(resolvedTableName || null);
          setRecord({});

          const initialForm: Record<string, any> = {};
          tableFields.forEach((f) => {
            const key = f.fieldName || f.id;
            if (isSystemField(key)) return;
            if (f.defaultValue !== undefined && f.defaultValue !== null) {
              initialForm[key] = f.defaultValue;
            }
          });
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
          const rows = recordsData.rows || (Array.isArray(recordsData) ? recordsData : []);
          setRecord(rows[0] || null);
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
  }, [location.pathname, location.search, dataModelId, recordId, isNewMode]);

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

  const handleFieldInputChange = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveRecord = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!tableName) return;

    setSaving(true);
    setSaveError(null);

    try {
      const res = await fetch(`/api/dynamic/${tableName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok || data.error || data.success === false) {
        throw new Error(data.error || data.message || 'Failed to create record.');
      }

      const createdRecord = data.record || (Array.isArray(data.rows) ? data.rows[0] : data.rows) || data.data || data;
      const newId = createdRecord?.id || data.id;

      navigate(newId ? `/${appSlug}/models/${dataModelId}/${newId}` : `/${appSlug}/models/${dataModelId}`, {
        replace: true,
      });
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save record.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingScreen />;

  if (error) {
    return (
      <div className={`sails-dynamic-table sails-page-container ${animClass}`}>
        <header className="sails-page-header sails-dynamic-table__header">
          <div className="sails-page-header__left">
            <button className="sails-btn sails-btn--secondary" onClick={() => navigate(-1)} style={{ marginRight: 12 }}>
              <ChevronLeft size={16} /> Back
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

  const primaryTitle = isNewMode
    ? `New ${tableName ? tableName.charAt(0).toUpperCase() + tableName.slice(1) : 'Record'}`
    : record
    ? record.name || record.title || record.label || record.id
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
      if (isSystemField(key)) return null;

      const colSpan = b.width ? (typeof b.width === 'number' ? b.width : 4) : 4;
      const val = isNewMode ? formData[key] ?? '' : record ? record[field.fieldName] ?? record[field.id] ?? '—' : '—';

      return (
        <div key={b.id || field.id} className="ls-block ls-block--field" style={{ gridColumn: `span ${colSpan}` }}>
          <label className="ls-block__label">
            {label}
            {field.isRequired && <span className="ls-block__required">*</span>}
          </label>
          {isNewMode ? (
            <div className="ls-block__input-wrapper" style={{ marginTop: 6 }}>
              <FieldInputControl field={field} fieldKey={key} label={label} val={val} controlPluginId={b.controlPluginId} onChange={handleFieldInputChange} />
            </div>
          ) : (
            <div className="ls-block__value">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</div>
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
      const title = b.labelOverride || (b.relatedTableId === 't_tasks' ? 'Tasks' : 'Related Records');
      const colSpan = b.width ? (typeof b.width === 'number' ? b.width : 12) : 12;

      return (
        <div key={b.id} className="ls-block ls-block--related" style={{ gridColumn: `span ${colSpan}` }}>
          <div className="ls-related__header">
            <Table2 size={14} />
            <span className="ls-related__title">{title}</span>
            <span className="ls-related__count">0 records</span>
          </div>
          <table className="ls-related__table">
            <thead>
              <tr>
                <th>TITLE</th>
                <th>STATUS</th>
                <th>DUE DATE</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={3} style={{ textAlign: 'center', color: 'var(--sails-text-muted)', padding: '16px' }}>
                  No related records.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      );
    }

    return null;
  };

  return (
    <div className={`sails-dynamic-table sails-page-container ${animClass}`}>
      <form onSubmit={handleSaveRecord}>
        <DetailHeader
          primaryTitle={primaryTitle}
          subtitle={subtitle}
          isNewMode={isNewMode}
          saving={saving}
          onBack={() => navigate(-1)}
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

                return (
                  <div key={section.id} className="sails-detail-section-card">
                    <h3 className="sails-detail-section-title">{section.title || 'Section'}</h3>
                    <div className="ls-section__grid">{sectionBlocks.map((b: any) => renderBlock(b))}</div>
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
