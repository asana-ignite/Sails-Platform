/**
 * MOCK UP — Layout-Driven Page Sample
 *
 * Demonstrates how a page renders dynamically from TableLayout config.
 * Replaces the hardcoded DynamicTablePage with a layout-driven engine.
 *
 * Key concept: ONE component renders ALL tables. The layout config
 * dictates what appears, in what order, and in what arrangement.
 * No per-table React code needed.
 */
import React, { useState, useMemo } from 'react';
import {
  ArrowLeft, Edit3, Trash2, ChevronDown, ChevronRight,
  Mail, Phone, MapPin, Calendar, Hash, User, DollarSign,
} from 'lucide-react';
import type { TableLayout, LayoutSection, LayoutField, KlaoFieldDefinition } from '@klao/shared';
import './LayoutSample.css';
import {
  MOCK_LEADS_FIELDS,
  MOCK_LAYOUT_LIST,
  MOCK_LAYOUT_DETAIL,
  MOCK_LAYOUT_FORM,
} from './sample-layout-data';

// ─── Props ─────────────────────────────────────────────────────

interface LayoutSampleProps {
  demoView: 'LIST' | 'DETAIL' | 'FORM';
}

// ─── Helpers ───────────────────────────────────────────────────

function fieldById(id: string): KlaoFieldDefinition | undefined {
  return MOCK_LEADS_FIELDS.find((f) => f.id === id);
}

function fieldsForSection(fields: LayoutField[], sectionId: string): LayoutField[] {
  return fields
    .filter((f) => f.sectionId === sectionId && f.visible)
    .sort((a, b) => a.position - b.position);
}

function layoutByView(view: string): TableLayout {
  switch (view) {
    case 'DETAIL': return MOCK_LAYOUT_DETAIL;
    case 'FORM':   return MOCK_LAYOUT_FORM;
    default:       return MOCK_LAYOUT_LIST;
  }
}

// ─── Field value renderer (simplified — maps logicalType to UI) ─

const MOCK_RECORD: Record<string, any> = {
  lead_name:    'ACME Corp Deal',
  company:      'ACME Corporation',
  email:        'j.doe@acme.com',
  phone:        '+66 2 123 4567',
  status:       'qualified',
  source:       'website',
  budget:       250000,
  contact_date: '2026-06-15',
  notes:        'Met at Tech Summit. Interested in Enterprise plan. Follow up Q3.',
  assigned_to:  'Somsak Chaiyaporn',
};

function renderFieldValue(field: KlaoFieldDefinition, value: any): React.ReactNode {
  if (value === undefined || value === null) return <span className="layout-sample__null">—</span>;

  switch (field.logicalType) {
    case 'email':
      return (
        <a href={`mailto:${value}`} className="layout-sample__link">
          <Mail size={14} /> {value}
        </a>
      );
    case 'phone':
      return (
        <span className="layout-sample__with-icon">
          <Phone size={14} /> {value}
        </span>
      );
    case 'url':
      return (
        <a href={value} target="_blank" rel="noopener noreferrer" className="layout-sample__link">
          {value}
        </a>
      );
    case 'currency':
      return new Intl.NumberFormat('th-TH', {
        style: 'currency',
        currency: 'THB',
        maximumFractionDigits: 0,
      }).format(value);
    case 'select': {
      const options = (field.config as any)?.options || [];
      const option = options.find((o: any) => o.value === value);
      return option?.label || value;
    }
    case 'lookup':
      return (
        <span className="layout-sample__with-icon">
          <User size={14} /> {value}
        </span>
      );
    default:
      return String(value);
  }
}

// ─── Sub-components ────────────────────────────────────────────

function FieldLabel({ field, layoutField }: { field: KlaoFieldDefinition; layoutField: LayoutField }) {
  return (
    <label className="layout-sample__field-label">
      {layoutField.labelOverride || field.name}
      {field.isRequired && <span className="layout-sample__required">*</span>}
    </label>
  );
}

/** Read-only label+value — used in DETAIL view */
function DetailField({ layoutField }: { layoutField: LayoutField }) {
  const field = fieldById(layoutField.fieldId);
  if (!field) return null;
  const value = MOCK_RECORD[field.fieldName];

  return (
    <div className={`layout-sample__field layout-sample__field--${layoutField.width}`}>
      <FieldLabel field={field} layoutField={layoutField} />
      <div className="layout-sample__field-value">{renderFieldValue(field, value)}</div>
    </div>
  );
}

/** Editable input — used in FORM view */
function FormField({ layoutField }: { layoutField: LayoutField }) {
  const field = fieldById(layoutField.fieldId);
  if (!field) return null;
  const value = MOCK_RECORD[field.fieldName] ?? '';

  const isTextarea = field.logicalType === 'long_text';
  const isReadOnly = layoutField.readOnly;

  return (
    <div className={`layout-sample__field layout-sample__field--${layoutField.width}`}>
      <FieldLabel field={field} layoutField={layoutField} />
      {isTextarea ? (
        <textarea
          className="klao-input layout-sample__textarea"
          defaultValue={value}
          readOnly={isReadOnly}
          rows={4}
        />
      ) : (
        <input
          type="text"
          className="klao-input layout-sample__input"
          defaultValue={value}
          readOnly={isReadOnly}
        />
      )}
    </div>
  );
}

/** A section renders its fields in a responsive grid */
function Section({
  section,
  fields,
  viewType,
}: {
  section: LayoutSection;
  fields: LayoutField[];
  viewType: string;
}) {
  const [collapsed, setCollapsed] = useState(section.collapsed || false);

  return (
    <div className="klao-card layout-sample__section">
      <button
        className="layout-sample__section-header"
        onClick={() => setCollapsed(!collapsed)}
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        <h3 className="layout-sample__section-title">{section.title}</h3>
      </button>
      {!collapsed && (
        <div className={`layout-sample__section-grid layout-sample__section-grid--cols-${section.columns}`}>
          {fields.map((lf) =>
            viewType === 'FORM' ? (
              <FormField key={lf.fieldId} layoutField={lf} />
            ) : (
              <DetailField key={lf.fieldId} layoutField={lf} />
            )
          )}
        </div>
      )}
    </div>
  );
}

/** Inline list of related child records (DETAIL view only) */
function RelatedRecords({ layout }: { layout: TableLayout }) {
  const related = layout.config.relatedRecords;
  if (!related || related.length === 0) return null;

  return (
    <>
      {related.map((rel) => (
        <div key={rel.tableId} className="klao-card layout-sample__related">
          <div className="layout-sample__related-header">
            <h3 className="layout-sample__section-title">
              Related {rel.tableId.replace('t_', '')}
            </h3>
            <span className="layout-sample__related-count">{rel.maxRows} shown</span>
          </div>
          <table className="klao-table">
            <thead>
              <tr>
                {rel.displayFields.map((df) => (
                  <th key={df}>{df.replace(/_/g, ' ')}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={rel.displayFields.length} className="layout-sample__mock-msg">
                  ↳ Real data fetched from API. Columns driven by layout config.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ))}
    </>
  );
}

// ─── Main Component ────────────────────────────────────────────

export const LayoutSample: React.FC<LayoutSampleProps> = ({ demoView }) => {
  const layout = layoutByView(demoView);

  // Resolve sections + their fields from config
  const sections = useMemo(() => {
    return layout.config.sections
      .sort((a, b) => a.position - b.position)
      .map((sec) => ({
        section: sec,
        fields: fieldsForSection(layout.config.fields, sec.id),
      }));
  }, [layout]);

  const titleValue = MOCK_RECORD[layout.recordTitleField || 'lead_name'];
  const isDetail = demoView === 'DETAIL';
  const isForm = demoView === 'FORM';
  const isList = demoView === 'LIST';

  return (
    <div className="klao-page-container layout-sample">
      {/* ── Page Header (dynamically titled from layout) ── */}
      <header className="klao-page-header layout-sample__header">
        <div className="klao-page-header__left">
          {isDetail && (
            <button className="klao-btn klao-btn--ghost layout-sample__back">
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <h1 className="klao-page-header__title">
              {isDetail || isForm ? titleValue : 'Leads'}
            </h1>
            <p className="klao-page-header__subtitle">
              {isList   && 'Layout-driven table view — columns from layout config'}
              {isDetail && 'Layout-driven detail view — sections from layout config'}
              {isForm   && `Editing: ${titleValue}`}
            </p>
          </div>
        </div>
        <div className="klao-page-header__right">
          {isDetail && (
            <>
              <button className="klao-btn klao-btn--ghost"><Edit3 size={16} /> Edit</button>
              <button className="klao-btn klao-btn--ghost layout-sample__danger"><Trash2 size={16} /> Delete</button>
            </>
          )}
          {isForm && (
            <>
              <button className="klao-btn klao-btn--ghost">Cancel</button>
              <button className="klao-btn klao-btn--primary">Save Lead</button>
            </>
          )}
        </div>
      </header>

      {/* ── LIST View: table columns from layout config ── */}
      {isList && (
        <div className="klao-card layout-sample__list-table-wrap">
          <table className="klao-table">
            <thead>
              <tr>
                {layout.config.fields
                  .filter((f) => f.visible)
                  .sort((a, b) => a.position - b.position)
                  .map((lf) => {
                    const fd = fieldById(lf.fieldId);
                    return <th key={lf.fieldId}>{fd?.name || lf.fieldId}</th>;
                  })}
              </tr>
            </thead>
            <tbody>
              <tr className="layout-sample__mock-row">
                {layout.config.fields
                  .filter((f) => f.visible)
                  .sort((a, b) => a.position - b.position)
                  .map((lf) => {
                    const fd = fieldById(lf.fieldId);
                    const val = fd ? MOCK_RECORD[fd.fieldName] : '';
                    return (
                      <td key={lf.fieldId}>
                        {fd ? renderFieldValue(fd, val) : val}
                      </td>
                    );
                  })}
              </tr>
            </tbody>
          </table>
          <p className="layout-sample__mock-legend">
            ↳ <strong>LIST view:</strong> Columns are driven by <code>layout.config.fields</code> — only visible,
            sorted by position. No hardcoded &lt;th&gt; elements.
          </p>
        </div>
      )}

      {/* ── DETAIL & FORM: sections from layout config ── */}
      {(isDetail || isForm) && (
        <div className="layout-sample__detail-layout">
          {sections.map(({ section, fields }) => (
            <Section
              key={section.id}
              section={section}
              fields={fields}
              viewType={demoView}
            />
          ))}
        </div>
      )}

      {/* ── Related records (DETAIL only) ── */}
      {isDetail && <RelatedRecords layout={layout} />}

      {/* ── Debug: show the JSON config driving this page ── */}
      <details className="layout-sample__debug">
        <summary className="layout-sample__debug-toggle">
          View Layout Config JSON (what drives this page)
        </summary>
        <pre className="layout-sample__debug-json">
          {JSON.stringify(layout.config, null, 2)}
        </pre>
      </details>
    </div>
  );
};

export default LayoutSample;
