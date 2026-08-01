import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import {
  ChevronLeft,
  Database,
  AlertCircle,
  Table2
} from 'lucide-react';
import type { TableLayout, SailsFieldDefinition } from '@sails/shared';
import LoadingScreen from '../components/common/LoadingScreen';
import './DynamicTablePage.css';
import './custom/LayoutStudio.css';
import './custom/layouts-responsive.css';

const DynamicDetailPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const animClass = navigationType === 'POP' ? 'sails-dynamic-table--back' : '';

  const [layout, setLayout] = useState<TableLayout | null>(null);
  const [fields, setFields] = useState<SailsFieldDefinition[]>([]);
  const [record, setRecord] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTabMap, setActiveTabMap] = useState<Record<string, number>>({});

  const pathParts = location.pathname.split('/').filter(Boolean);
  const dataModelId = pathParts.length >= 3 ? pathParts[2] : null;
  const recordId = pathParts.length >= 4 ? pathParts[3] : null;

  useEffect(() => {
    if (!dataModelId || !recordId) {
      setError('Invalid record detail route parameter');
      setLoading(false);
      return;
    }

    const loadDetailData = async () => {
      setLoading(true);
      setError(null);
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const targetLayoutId = searchParams.get('layoutId');

        let targetLayout: any = null;
        let objectsData: any = null;

        if (targetLayoutId) {
          const layoutRes = await fetch(`/api/console/layouts?id=${targetLayoutId}`);
          if (layoutRes.ok) {
            const layoutResult = await layoutRes.json();
            if (layoutResult.success) targetLayout = layoutResult.data;
          }
        } else {
          const objRes = await fetch('/api/metadata/objects');
          objectsData = objRes?.ok ? await objRes.json() : [];
        }

        const objectRows = Array.isArray(objectsData) ? objectsData : (objectsData?.rows || objectsData?.data || []);

        if (!targetLayout && dataModelId) {
          const lRes = await fetch(`/api/console/layouts?tableId=${dataModelId}`);
          if (lRes.ok) {
            const lResult = await lRes.json();
            const rows: any[] = lResult.data?.rows || [];
            targetLayout =
              rows.find((r: any) => (r.viewType === 'DETAIL' || r.viewType === 'FORM') && r.status === 'active' && r.isDefault) ||
              rows.find((r: any) => (r.viewType === 'DETAIL' || r.viewType === 'FORM') && r.status === 'active') ||
              rows.find((r: any) => r.viewType === 'DETAIL' || r.viewType === 'FORM');
          }
        }

        let tableName = targetLayout?.table?.tableName;
        if (!tableName && dataModelId) {
          const foundTable = objectRows.find((t: any) => t.id === dataModelId || t.tableName === dataModelId);
          if (foundTable) tableName = foundTable.tableName;
        }

        if (!tableName) {
          setError('Data model table reference not found');
          setLoading(false);
          return;
        }

        const recordsRes = await fetch(`/api/dynamic/${tableName}?id=${recordId}`);

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
  }, [location.pathname, location.search, dataModelId, recordId]);

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

  const primaryTitle = record
    ? record.name || record.title || record.label || record.id
    : `Record #${recordId}`;

  const sections: any[] = (config as any)?.sections && (config as any).sections.length > 0
    ? (config as any).sections
    : [{ id: 'default_sec', title: 'Record Properties', columns: 2 }];
  const blocks: any[] = (config as any)?.blocks || [];

  const renderBlock = (b: any) => {
    if (!b || b.visible === false) return null;

    // ── FIELD BLOCK ──
    if (b.blockType === 'field' || (!b.blockType && b.fieldId)) {
      const field = fields.find((f) => f.id === b.fieldId);
      if (!field) return null;
      const label = b.labelOverride || field.name;
      const val = record ? (record[field.fieldName] ?? record[field.id] ?? '—') : '—';
      const colSpan = b.width ? (typeof b.width === 'number' ? b.width : 4) : 4;

      return (
        <div
          key={b.id || field.id}
          className="ls-block ls-block--field"
          style={{ gridColumn: `span ${colSpan}` }}
        >
          <label className="ls-block__label">
            {label}
            {field.isRequired && <span className="ls-block__required">*</span>}
          </label>
          <div className="ls-block__value">
            {typeof val === 'object' ? JSON.stringify(val) : String(val)}
          </div>
        </div>
      );
    }

    // ── TAB GROUP BLOCK ──
    if (b.blockType === 'tab_group') {
      const tabs = b.tabs || [];
      const activeTabIdx = activeTabMap[b.id] ?? 0;
      const activeTab = tabs[activeTabIdx];
      const activeBlocks = activeTab?.blocks || [];
      const colSpan = b.width ? (typeof b.width === 'number' ? b.width : 12) : 12;

      return (
        <div
          key={b.id}
          className="ls-block ls-block--tabs"
          style={{ gridColumn: `span ${colSpan}` }}
        >
          {/* Desktop tab bar */}
          <div className="ls-tabs__bar">
            {tabs.map((tab: any, ti: number) => (
              <div
                key={tab.id || ti}
                className={`ls-tabs__tab ${ti === activeTabIdx ? 'ls-tabs__tab--active' : ''}`}
                onClick={() => setActiveTabMap((prev) => ({ ...prev, [b.id]: ti }))}
              >
                {tab.label}
                {tab.blocks && tab.blocks.length > 0 && (
                  <span className="ls-tabs__count">{tab.blocks.length}</span>
                )}
              </div>
            ))}
          </div>

          {/* Desktop active tab body */}
          <div className="ls-tabs__body">
            <div className="ls-section__grid">
              {activeBlocks.length > 0 ? (
                activeBlocks.map((tb: any) => renderBlock(tb))
              ) : (
                <p className="ls-tabs__hint" style={{ gridColumn: '1 / -1' }}>No fields in this tab.</p>
              )}
            </div>
          </div>

          {/* Mobile accordion */}
          <div className="ls-tabs__accordion-wrapper">
            {tabs.map((tab: any, ti: number) => {
              const isOpen = ti === activeTabIdx;
              const hasBlocks = tab.blocks && tab.blocks.length > 0;
              return (
                <div
                  key={tab.id || ti}
                  className={`ls-tabs__accordion ${isOpen ? 'ls-tabs__accordion--open' : ''}`}
                >
                  <div
                    className="ls-tabs__accordion-header"
                    onClick={() => {
                      const current = activeTabMap[b.id] ?? 0;
                      setActiveTabMap((prev) => ({ ...prev, [b.id]: ti === current ? -1 : ti }));
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        const current = activeTabMap[b.id] ?? 0;
                        setActiveTabMap((prev) => ({ ...prev, [b.id]: ti === current ? -1 : ti }));
                      }
                    }}
                  >
                    <span className="ls-tabs__accordion-title">{tab.label}</span>
                    {hasBlocks && (
                      <span className="ls-tabs__count">{tab.blocks.length}</span>
                    )}
                    <span className="ls-tabs__accordion-chevron" />
                  </div>
                  <div className="ls-tabs__accordion-body">
                    <div className="ls-section__grid">
                      <div className="ls-accordion-inner">
                        {hasBlocks ? (
                          tab.blocks.map((tb: any) => renderBlock(tb))
                        ) : (
                          <p className="ls-tabs__hint" style={{ gridColumn: '1 / -1' }}>No fields in this tab.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // ── RELATED LIST BLOCK ──
    if (b.blockType === 'related_list') {
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
      {loading ? (
        <LoadingScreen />
      ) : error ? (
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
      ) : (
        <>
          <header className="sails-page-header sails-dynamic-table__header">
            <div className="sails-page-header__left" style={{ pointerEvents: 'auto' }}>
              <button
                className="sails-btn sails-btn--secondary"
                onClick={() => navigate(-1)}
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
                <p className="sails-page-header__subtitle">
                  {layout?.name ? `Detail Layout: ${layout.name}` : 'Record Details'}
                </p>
              </div>
            </div>
          </header>

          <section className="sails-page-body" style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', gap: 24 }}>
            {record ? (
              sections.map((section: any) => {
                const sectionBlocks = blocks.length > 0
                  ? blocks.filter((b: any) => b.sectionId === section.id && b.visible !== false)
                      .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
                  : fields.map((f: any, idx: number) => ({
                      id: f.id,
                      sectionId: section.id,
                      fieldId: f.id,
                      blockType: 'field',
                      visible: true,
                      width: 4,
                      position: idx
                    }));

                if (blocks.length > 0 && sectionBlocks.length === 0) return null;

                return (
                  <div key={section.id} className="ls-table-card" style={{ padding: 24, borderRadius: 12, background: 'var(--sails-bg-card, #ffffff)' }}>
                    <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--sails-text-main, #0f172a)', marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid var(--sails-border, #e2e8f0)' }}>
                      {section.title || 'Section'}
                    </h3>
                    <div className="ls-section__grid">
                      {sectionBlocks.map((b: any) => renderBlock(b))}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="ls-table-card" style={{ padding: 24, borderRadius: 12, background: 'var(--sails-bg-card, #ffffff)', textAlign: 'center' }}>
                <p className="ls-empty">Record not found.</p>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default DynamicDetailPage;
