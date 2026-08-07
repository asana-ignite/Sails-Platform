/**
 * VariableEditor — record/collection workflow variable schema editor.
 *
 * Rendered in Workflow Properties when a variable chip is selected.  Declares
 * the record schema (Model-bound or Custom), the collection item type, and
 * the default value — with a generated JSON Schema preview and validation.
 */
import React, { useMemo, useState } from 'react';
import { Plus, Trash2, MoveUp, MoveDown, Braces, CheckCircle2, AlertTriangle, Database, PenLine, RotateCcw } from 'lucide-react';
import { collectionValueSchema, validateCollectionValue } from '@sails/shared';
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
  onChange: (patch: Partial<VariableShape>) => void;
  onReloadModels: () => void;
}

const VAR_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'long_text', label: 'Long Text' },
  { value: 'number', label: 'Number' },
  { value: 'decimal', label: 'Decimal' },
  { value: 'date', label: 'Date' },
  { value: 'datetime', label: 'Date & Time' },
  { value: 'time', label: 'Time' },
  { value: 'user', label: 'User' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'collection', label: 'Collection' },
  { value: 'record', label: 'Record' },
];

const COLLECTION_ITEM_TYPES = [
  { value: 'record', label: 'Record (rows)' },
  { value: 'any', label: 'Any' },
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'decimal', label: 'Decimal' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'date', label: 'Date' },
  { value: 'datetime', label: 'Date & Time' },
  { value: 'user', label: 'User' },
];

/** Scalar types usable inside a custom record schema. */
const FIELD_TYPES = [
  'text', 'long_text', 'number', 'decimal', 'date', 'datetime', 'time',
  'user', 'boolean', 'relation',
];

const colLabel = (c: ColumnDef): string => c.label || c.fieldName;

export const VariableEditor: React.FC<Props> = ({ variable: v, models, isReadonly, onChange, onReloadModels }) => {
  const [customField, setCustomField] = useState<ColumnDef>({ fieldName: '', label: '', logicalType: 'text' });
  const [customPopOpen, setCustomPopOpen] = useState(false);
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
  const toggleModelField = (fieldName: string) => {
    const existing = columns.some((c) => c.fieldName === fieldName);
    const next = existing
      ? columns.filter((c) => c.fieldName !== fieldName)
      : [...columns, { fieldName, label: fieldName, logicalType: 'text' }];
    onChange({ columns: next });
  };

  const moveColumn = (idx: number, dir: -1 | 1) => {
    const next = [...columns];
    const other = idx + dir;
    if (other < 0 || other >= next.length) return;
    [next[idx], next[other]] = [next[other], next[idx]];
    onChange({ columns: next });
  };

  const removeColumn = (idx: number) => {
    onChange({ columns: columns.filter((_, i) => i !== idx) });
  };

  // ── Custom schema ops ──
  const addCustomField = () => {
    if (!customField.fieldName.trim()) return;
    onChange({
      columns: [...columns, {
        fieldName: customField.fieldName.trim(),
        label: customField.label?.trim() || customField.fieldName.trim(),
        logicalType: customField.logicalType || 'text',
        targetModel: customField.targetModel || undefined,
      }],
    });
    setCustomPopOpen(false);
    setCustomField({ fieldName: '', label: '', logicalType: 'text' });
  };

  const updateCustomField = (idx: number, patch: Partial<ColumnDef>) => {
    const next = [...columns];
    next[idx] = { ...next[idx], ...patch };
    onChange({ columns: next });
  };

  const patchColumn = (idx: number, patch: Partial<ColumnDef>) => updateCustomField(idx, patch);

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
      {/* Name + type */}
      <label className="ws-props-label">Name</label>
      <input className="ws-props-input" value={v.name} onChange={(e) => onChange({ name: e.target.value })} disabled={isReadonly} />
      <label className="ws-props-label" style={{ marginTop: 6 }}>Type</label>
      <select className="ws-props-input" value={v.fieldType}
        onChange={(e) => {
          const ft = e.target.value;
          const patch: any = { fieldType: ft };
          if (ft === 'collection') { patch.itemType = v.itemType || 'record'; patch.defaultValue = Array.isArray(v.defaultValue) ? v.defaultValue : []; }
          else if (ft === 'record') { patch.itemType = undefined; patch.defaultValue = v.defaultValue && typeof v.defaultValue === 'object' && !Array.isArray(v.defaultValue) ? v.defaultValue : {}; }
          else { patch.itemType = undefined; patch.targetModel = undefined; patch.columns = undefined; }
          onChange(patch);
        }} disabled={isReadonly}>
        {VAR_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>

      {/* Collection item type */}
      {v.fieldType === 'collection' && (
        <>
          <label className="ws-props-label" style={{ marginTop: 6 }}>Item Type</label>
          <select className="ws-props-input" value={v.itemType || 'record'}
            onChange={(e) => {
              const it = e.target.value;
              const patch: any = { itemType: it };
              if (it !== 'record') { patch.targetModel = undefined; patch.columns = undefined; }
              onChange(patch);
            }} disabled={isReadonly}>
            {COLLECTION_ITEM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </>
      )}

      {/* Record schema editor */}
      {isRecordShape && (
        <>
          {/* Schema mode toggle */}
          <label className="ws-props-label" style={{ marginTop: 6 }}>Schema Source</label>
          <div className="ws-mode-toggle" style={{ marginBottom: 6 }}>
            <button type="button" className={`ws-mode-btn ${(v.schemaMode || 'model') === 'model' ? 'ws-mode-btn--active' : ''}`}
              onClick={() => onChange({ schemaMode: 'model' })} disabled={isReadonly}>
              <Database size={12} /> Model
            </button>
            <button type="button" className={`ws-mode-btn ${v.schemaMode === 'custom' ? 'ws-mode-btn--active' : ''}`}
              onClick={() => onChange({ schemaMode: 'custom' })} disabled={isReadonly}>
              <PenLine size={12} /> Custom
            </button>
          </div>

          {(v.schemaMode || 'model') === 'model' ? (
            <>
              <label className="ws-props-label">Model</label>
              <div className="ws-props-row">
                <CustomSelect
                  size="sm"
                  searchable
                  value={v.targetModel || ''}
                  options={models.map((m) => ({ value: m.tableName, label: `${m.name} (${m.tableName})` }))}
                  onChange={(val) => {
                    const name = String(val);
                    const m = models.find((x) => x.tableName === name || x.name === name);
                    onChange({
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
                <>
                  <label className="ws-props-label" style={{ marginTop: 6 }}>Columns ({columns.length}/{model.fields.length})</label>
                  <div style={{ maxHeight: 160, overflow: 'auto', border: '1px solid var(--sails-border,#e2e8f0)', borderRadius: 6 }}>
                    {model.fields.map((f: any, i: number) => {
                      const fn = f.fieldName ?? f.columnName ?? f.id;
                      const included = columns.some((c) => c.fieldName === fn);
                      return (
                        <div key={fn} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 6px', borderBottom: '1px solid var(--sails-border,#e2e8f0)' }}>
                          <input type="checkbox" checked={included} disabled={isReadonly}
                            onChange={() => toggleModelField(fn)} />
                          <span style={{ flex: 1, fontSize: 11 }}>{f.name ?? f.label ?? fn}</span>
                          <code style={{ fontSize: 9, color: 'var(--sails-text-muted,#94a3b8)' }}>{f.logicalType ?? f.physicalType ?? 'text'}</code>
                          {included && (
                            <span style={{ display: 'inline-flex', gap: 2 }}>
                              <button className="ws-icon-btn" title="Move up" disabled={i === 0 || isReadonly} onClick={() => moveColumn(Math.max(0, columns.findIndex((c) => c.fieldName === fn)), -1)}><MoveUp size={10} /></button>
                              <button className="ws-icon-btn" title="Move down" disabled={isReadonly} onClick={() => moveColumn(columns.findIndex((c) => c.fieldName === fn), 1)}><MoveDown size={10} /></button>
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="ws-props-hint" style={{ paddingTop: 4 }}>Select a model to derive its columns. Uncheck columns you don't need.</p>
              )}
            </>
          ) : (
            <>
              <label className="ws-props-label">Custom Fields</label>
              {columns.length === 0 && <p className="ws-props-hint">No custom fields yet — add fields below.</p>}
              {columns.map((c, i) => (
                <div key={i} style={{ border: '1px solid var(--sails-border,#e2e8f0)', borderRadius: 6, padding: 6, marginBottom: 4 }}>
                  <div className="ws-props-row">
                    <input className="ws-props-input" style={{ flex: 1 }} placeholder="field_name" value={c.fieldName}
                      onChange={(e) => patchColumn(i, { fieldName: e.target.value })} disabled={isReadonly} />
                    <select className="ws-props-input" style={{ width: 90 }} value={c.logicalType || 'text'}
                      onChange={(e) => patchColumn(i, { logicalType: e.target.value })} disabled={isReadonly}>
                      {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <button className="ws-icon-btn ws-icon-btn--danger" title="Remove field" disabled={isReadonly} onClick={() => removeColumn(i)}><Trash2 size={11} /></button>
                  </div>
                  <div className="ws-props-row" style={{ marginTop: 4 }}>
                    <input className="ws-props-input" style={{ flex: 1 }} placeholder="Display label (optional)" value={c.label || ''}
                      onChange={(e) => patchColumn(i, { label: e.target.value })} disabled={isReadonly} />
                    <select className="ws-props-input" style={{ width: 120 }} value={c.targetModel || ''}
                      onChange={(e) => patchColumn(i, { targetModel: e.target.value || undefined })} disabled={isReadonly}>
                      <option value="">— no nested model —</option>
                      {models.map((m) => <option key={m.id} value={m.tableName}>{m.name}</option>)}
                    </select>
                  </div>
                </div>
              ))}
              {/* Add custom field — button + popup (same pattern as variable creation) */}
              <div style={{ position: 'relative', marginTop: 6 }}>
                <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={() => { setCustomPopOpen(true); setCustomField({ fieldName: '', label: '', logicalType: 'text' }); }} disabled={isReadonly}>
                  <Plus size={12} /> Add Field
                </button>
                {customPopOpen && (
                  <div className="ws-var-add-pop" style={{ left: 0, top: 'calc(100% + 6px)', width: 260 }} onClick={(e) => e.stopPropagation()}>
                    <label className="ws-props-label">Field Name</label>
                    <input className="ws-props-input" autoFocus placeholder="field_name" value={customField.fieldName}
                      onChange={(e) => setCustomField((f) => ({ ...f, fieldName: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') addCustomField(); if (e.key === 'Escape') setCustomPopOpen(false); }} />
                    <label className="ws-props-label" style={{ marginTop: 4 }}>Display Label</label>
                    <input className="ws-props-input" placeholder="Display label (optional)" value={customField.label || ''}
                      onChange={(e) => setCustomField((f) => ({ ...f, label: e.target.value }))} />
                    <label className="ws-props-label" style={{ marginTop: 4 }}>Type</label>
                    <CustomSelect
                      size="sm"
                      searchable
                      value={customField.logicalType || 'text'}
                      options={FIELD_TYPES.map((t) => ({ value: t, label: t }))}
                      onChange={(v) => setCustomField((f) => ({ ...f, logicalType: String(v) }))}
                    />
                    <label className="ws-props-label" style={{ marginTop: 4 }}>Nested Model (optional)</label>
                    <CustomSelect
                      size="sm"
                      searchable
                      value={customField.targetModel || ''}
                      options={[{ value: '', label: '— none —' }, ...models.map((m) => ({ value: m.tableName, label: `${m.name} (${m.tableName})` }))]}
                      onChange={(v) => setCustomField((f) => ({ ...f, targetModel: String(v) || undefined }))}
                    />
                    <div className="ws-var-add-pop__footer">
                      <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={() => setCustomPopOpen(false)}>Cancel</button>
                      <button className="sails-btn sails-btn--primary sails-btn--sm" disabled={!customField.fieldName.trim()}
                        onClick={addCustomField}>OK</button>
                    </div>
                  </div>
                )}
              </div>
            </>
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
