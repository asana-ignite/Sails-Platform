/**
 * VariableEditor — record/collection workflow variable schema editor.
 *
 * Rendered in Workflow Properties when a variable chip is selected.  Declares
 * the record schema (Model-bound or Custom), the collection item type, and
 * the default value — with a generated JSON Schema preview and validation.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Braces, CheckCircle2, AlertTriangle, RotateCcw, Plus } from 'lucide-react';
import { collectionValueSchema, validateCollectionValue, WORKFLOW_SCALAR_TYPES } from '@sails/shared';
import { CustomSelect } from '../common/CustomSelect';

interface ColumnDef {
  fieldName: string;
  label?: string;
  logicalType?: string;
  targetModel?: string;
}

interface VariableShape {
  id: string;
  name: string;
  fieldType: string;
  schemaMode?: 'model' | 'custom';
  itemType?: string;
  targetModel?: string;
  columns?: ColumnDef[];
  boundEventId?: string;
  defaultValue?: any;
}

interface ModelRow {
  id: string;
  name: string;
  tableName: string;
  fields: any[];
}

interface Props {
  variable: VariableShape;
  models: ModelRow[];
  isReadonly: boolean;
  /** Locks the Name field only (draft creation — the name is fixed by the picker). */
  nameReadonly?: boolean;
  onChange: (patch: Partial<VariableShape>) => void;
  onReloadModels: () => void;
  /** When provided, an '+ Add Variable' button appears at the top. */
  onAddVariable?: () => void;
}

const VAR_TYPES = [
  ...WORKFLOW_SCALAR_TYPES,
  { value: 'collection', label: 'Collection' },
  { value: 'record', label: 'Record' },
];

const COLLECTION_ITEM_TYPES = [
  { value: 'record', label: 'Record (rows)' },
  { value: 'any', label: 'Any' },
  ...WORKFLOW_SCALAR_TYPES,
];

const colLabel = (c: ColumnDef): string => c.label || c.fieldName;

export const VariableEditor: React.FC<Props> = ({ variable: v, models, isReadonly, nameReadonly, onChange, onReloadModels, onAddVariable }) => {
  const [defaultDraft, setDefaultDraft] = useState<string | null>(null);
  const [schemaOpen, setSchemaOpen] = useState(false);

  const isRecordShape = v.fieldType === 'record' || (v.fieldType === 'collection' && v.itemType === 'record');
  const model = v.targetModel ? models.find((m) => m.tableName === v.targetModel || m.name === v.targetModel) : undefined;
  const columns = v.columns || [];

  // ── Schema preview + default-value validation ──
  const schema = useMemo(() => {
    if (v.fieldType === 'collection') {
      return collectionValueSchema({ itemType: v.itemType || 'any', columns });
    }
    if (v.fieldType === 'record') {
      return {
        type: 'object',
        properties: Object.fromEntries(columns.map((c) => [c.fieldName, { type: 'string' }])),
        required: columns.map((c) => c.fieldName),
      };
    }
    return null;
  }, [v.fieldType, v.itemType, columns]);

  const validation = useMemo(() => {
    if (!isRecordShape || !Array.isArray(v.defaultValue)) return null;
    return validateCollectionValue(v.defaultValue, { itemType: 'record', columns });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.defaultValue, columns, isRecordShape]);

  // ── Column ops (model mode) ──
  const defaultText = defaultDraft ?? (v.defaultValue != null ? JSON.stringify(v.defaultValue, null, 2) : '');
  const commitDefault = () => {
    if (defaultDraft === null) return;
    try {
      const parsed = JSON.parse(defaultDraft);
      onChange({ defaultValue: parsed });
    } catch { /* keep last valid */ }
    setDefaultDraft(null);
  };

  return (
    <div style={{ border: '1px solid var(--sails-border,#e2e8f0)', borderRadius: 8, margin: '0 12px 10px', padding: 10, background: 'var(--sails-bg-card,#fff)' }}>
      {/* No '+ Add Variable' for record/collection variables — their editor is for the created variable. */}
      {onAddVariable && v.fieldType !== 'record' && v.fieldType !== 'collection' && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
          <button type="button" className="sails-btn sails-btn--ghost sails-btn--sm" onClick={onAddVariable}>
            <Plus size={12} /> Add Variable
          </button>
        </div>
      )}
      {/* Name + type */}
      <label className="ws-props-label">Name</label>
      <input className="ws-props-input" value={v.name} onChange={(e) => onChange({ name: e.target.value })} disabled={isReadonly || nameReadonly} />
      <label className="ws-props-label" style={{ marginTop: 6 }}>Type</label>
      {/* A variable's type is fixed once created — only name/description are editable. */}
      <select className="ws-props-input" value={v.fieldType} disabled>
        {VAR_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>

      {/* Collection item type */}
      {v.fieldType === 'collection' && (
        <>
          <label className="ws-props-label" style={{ marginTop: 6 }}>Item Type</label>
          <CustomSelect
            size="md"
            searchable
            className="ws-props-select"
            value={v.itemType || 'record'}
            options={COLLECTION_ITEM_TYPES.map((t) => ({ value: t.value, label: t.label }))}
            onChange={(val) => {
              const it = String(val);
              const patch: any = { itemType: it };
              if (it !== 'record') { patch.targetModel = undefined; patch.columns = undefined; }
              onChange(patch);
            }}
            disabled={isReadonly}
          />
        </>
      )}

      {/* Record schema — model only; all of the model's columns are included. */}
      {isRecordShape && (
        <>
          <label className="ws-props-label" style={{ marginTop: 6 }}>Model</label>
          <div className="ws-props-row">
            <CustomSelect
              size="md"
              searchable
              className="ws-props-select"
              style={{ flex: 1, minWidth: 0 }}
              value={v.targetModel || ''}
              options={models.map((m) => ({ value: m.tableName, label: `${m.name} (${m.tableName})` }))}
              onChange={(val) => {
                const name = String(val);
                const m = models.find((x) => x.tableName === name || x.name === name);
                onChange({
                  schemaMode: 'model',
                  targetModel: name || undefined,
                  columns: m ? m.fields.map((f: any) => ({
                    fieldName: f.fieldName ?? f.columnName ?? f.id,
                    label: f.name ?? f.label ?? f.fieldName,
                    logicalType: f.logicalType ?? f.physicalType ?? 'text',
                    targetModel: (f.logicalType === 'relation' || f.logicalType === 'lookup')
                      ? (f.config?.targetTable ?? f.config?.targetModel ?? undefined)
                      : undefined,
                  })) : [],
                });
              }}
              disabled={isReadonly}
              placeholder="Select model..."
            />
            <button className="ws-icon-btn" title="Reload models" onClick={onReloadModels}><RotateCcw size={12} /></button>
          </div>
          {model ? (
            <p className="ws-props-hint" style={{ paddingTop: 4 }}>All columns of {model.name} are included.</p>
          ) : (
            <p className="ws-props-hint" style={{ paddingTop: 4 }}>Select a model — all of its columns are included.</p>
          )}

          {/* Declared columns summary */}
          {columns.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {columns.map((c) => (
                <span key={c.fieldName} className="ws-badge" style={{ background: 'rgba(59,130,246,.06)', borderColor: 'rgba(59,130,246,.25)', color: '#3b82f6' }}>
                  {colLabel(c)}<code style={{ fontSize: 9, marginLeft: 3 }}>{c.logicalType || 'text'}</code>
                  {c.targetModel && <code style={{ fontSize: 9, marginLeft: 3 }}>→ {c.targetModel}</code>}
                </span>
              ))}
            </div>
          )}

          {/* JSON Schema structure preview */}
          {schema && (
            <div style={{ marginTop: 8 }}>
              <button type="button" className="ws-props-input" style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', background: 'var(--sails-bg-secondary,#f8fafc)' }}
                onClick={() => setSchemaOpen(!schemaOpen)}>
                <Braces size={12} /> {schemaOpen ? 'Hide' : 'Show'} JSON Schema structure
              </button>
              {schemaOpen && (
                <pre style={{ background: 'var(--sails-bg-secondary,#f8fafc)', border: '1px solid var(--sails-border,#e2e8f0)', borderRadius: 6, padding: 8, fontSize: 10, overflow: 'auto', maxHeight: 200, margin: '6px 0 0' }}>
                  {JSON.stringify(schema, null, 2)}
                </pre>
              )}
            </div>
          )}
        </>
      )}

      {/* Default value */}
      <label className="ws-props-label" style={{ marginTop: 8 }}>Default Value (JSON)</label>
      <textarea
        className="ws-props-input ws-props-textarea"
        rows={3}
        value={defaultText}
        placeholder={v.fieldType === 'collection' ? '[]' : '{}'}
        onChange={(e) => setDefaultDraft(e.target.value)}
        onBlur={commitDefault}
        disabled={isReadonly}
      />
      {validation && (
        validation.ok
          ? <p style={{ fontSize: 10, color: '#059669', margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={11} /> Default value matches the record schema</p>
          : <p style={{ fontSize: 10, color: '#ef4444', margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}><AlertTriangle size={11} /> {validation.errors.slice(0, 2).join(' · ')}</p>
      )}
    </div>
  );
};

export default VariableEditor;
