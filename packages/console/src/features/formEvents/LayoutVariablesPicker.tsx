/**
 * LayoutVariablesPicker — layout-level form variables, styled to mirror
 * Workflow Studio's Variables section (same wvp-* / ws-* visual language).
 *
 * variant="manager"  Owns the full section: "Layout Variables (n)" header with
 *                    "+ Add Variable" button, bordered searchable tree (inline
 *                    rename on double-click of the label), portal add popover
 *                    (Scalars / Containers type groups + preview), and a
 *                    ws-modal variable editor on row double-click.
 * variant="control"  Compact input trigger + popup list (storeAs fields) —
 *                    declares nothing, only picks among declared variables.
 */
import React, { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Braces, CheckCircle2, ChevronDown, Hash, Plus, Search, X } from 'lucide-react';
import type { FormVariable } from '@sails/shared';
import DynamicIcon from '../../components/common/DynamicIcon';

/** Canonical registry icon names + Workflow Studio's exact type palette. */
const TYPE_DEFS: Record<string, { label: string; icon: string; color: string }> = {
  text: { label: 'Text', icon: 'Type', color: '#3b82f6' },
  number: { label: 'Number', icon: 'Hash', color: '#8b5cf6' },
  boolean: { label: 'Boolean', icon: 'ToggleRight', color: '#10b981' },
  date: { label: 'Date', icon: 'Calendar', color: '#f59e0b' },
  json: { label: 'JSON', icon: 'Layers', color: '#ec4899' },
  record: { label: 'Record', icon: 'Database', color: '#3b82f6' },
};

const SCALAR_TYPES = ['text', 'number', 'boolean', 'date'];
const CONTAINER_TYPES = ['json', 'record'];

interface LayoutVariablesPickerProps {
  variables: FormVariable[];
  variant?: 'manager' | 'control';
  readonly?: boolean;
  /** Control mode: the currently selected variable name (e.g. storeAs). */
  value?: string;
  /** Control mode: existing free-text value not among the declared variables. */
  legacyValue?: string;
  onChange?: (name: string | undefined) => void;
  onAdd?: (name: string, type: FormVariable['fieldType']) => void;
  onPatch?: (id: string, patch: Partial<FormVariable>) => void;
  onRemove?: (id: string) => void;
}

const sanitizeName = (raw: string): string => raw.replace(/[^a-zA-Z0-9_]/g, '');

export const LayoutVariablesPicker: React.FC<LayoutVariablesPickerProps> = ({
  variables,
  variant = 'manager',
  readonly = false,
  value = '',
  legacyValue,
  onChange,
  onAdd,
  onPatch,
  onRemove,
}) => {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [addPos, setAddPos] = useState<{ top: number; left: number } | null>(null);
  const [addName, setAddName] = useState('');
  const [addType, setAddType] = useState<FormVariable['fieldType']>('text');
  const [typeFilter, setTypeFilter] = useState('');
  const [editorId, setEditorId] = useState<string | null>(null);
  const [ctrlOpen, setCtrlOpen] = useState(false);
  const addBtnRef = useRef<HTMLButtonElement>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return variables;
    return variables.filter((v) => v.name.toLowerCase().includes(q));
  }, [variables, search]);

  const defOf = (t: string) => TYPE_DEFS[t] || TYPE_DEFS.text;
  const displayOptions = legacyValue && !variables.some((v) => v.name === legacyValue)
    ? [{ id: 'legacy', name: legacyValue, fieldType: 'json' } as FormVariable]
    : [];

  const commitRename = (v: FormVariable) => {
    const name = sanitizeName(renameDraft.trim());
    if (name && name !== v.name && !variables.some((o) => o.id !== v.id && o.name === name)) {
      onPatch?.(v.id, { name });
    }
    setRenameId(null);
  };

  const openAdd = () => {
    const W = 320;
    const estH = Math.min(420, Math.round(window.innerHeight * 0.6));
    const rect = addBtnRef.current?.getBoundingClientRect();
    let top: number;
    let left: number;
    if (rect && rect.width > 0 && rect.height > 0) {
      left = Math.max(8, Math.min(rect.left, window.innerWidth - W - 8));
      const below = rect.bottom + 6;
      top = below + estH > window.innerHeight - 8 ? Math.max(8, rect.top - estH - 6) : below;
    } else {
      left = Math.max(8, Math.round((window.innerWidth - W) / 2));
      top = Math.max(8, Math.round((window.innerHeight - estH) / 2));
    }
    setAddPos({ top, left });
    setAddName('');
    setAddType('text');
    setTypeFilter('');
    setAddOpen(true);
  };

  const commitAdd = () => {
    const name = sanitizeName(addName.trim()) || `var${variables.length + 1}`;
    if (variables.some((v) => v.name === name)) return;
    onAdd?.(name, addType);
    setAddOpen(false);
  };

  const renderTypeRow = (t: string) => {
    const def = defOf(t);
    const sel = addType === t;
    return (
      <div key={t} className={`wvp-node ${sel ? 'wvp-node--selected' : ''}`} style={{ cursor: 'pointer', paddingLeft: 20 }} onClick={() => setAddType(t as FormVariable['fieldType'])}>
        <span className="wvp-node__icon" style={{ color: def.color }}><DynamicIcon name={def.icon} size={12} /></span>
        <span className="wvp-node__label">{def.label}</span>
        <span className="wvp-node__type">{def.label}</span>
      </div>
    );
  };

  const renderVarRow = (v: FormVariable, { pickable = false }: { pickable?: boolean } = {}) => {
    const def = defOf(v.fieldType);
    const isSel = pickable && selectedId === v.id;
    const isRenaming = renameId === v.id;
    return (
      <div
        key={v.id}
        className={`wvp-node ${isSel ? 'wvp-node--selected' : ''}`}
        style={{ cursor: pickable ? 'pointer' : 'default', paddingLeft: 6 }}
        onClick={() => {
          if (!pickable) return;
          if (variant === 'control') {
            onChange?.(v.name);
            setCtrlOpen(false);
          } else {
            setSelectedId(isSel ? null : v.id);
          }
        }}
        onDoubleClick={(e) => {
          if (!pickable || variant !== 'manager') return;
          e.stopPropagation();
          if (!readonly) setEditorId(v.id);
        }}
        title={pickable && variant === 'manager' ? 'Click to select · double-click to edit' : undefined}
      >
        <span className="wvp-node__chevron"><span style={{ width: 11 }} /></span>
        <span className="wvp-node__icon" style={{ color: def.color }}><DynamicIcon name={def.icon} size={12} /></span>
        {isRenaming ? (
          <input
            className="ws-props-input ws-var-rename-input"
            autoFocus
            style={{ width: 90 }}
            value={renameDraft}
            onChange={(e) => setRenameDraft(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onBlur={() => commitRename(v)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename(v);
              if (e.key === 'Escape') setRenameId(null);
            }}
          />
        ) : (
          <span
            className="wvp-node__label"
            onDoubleClick={(e) => {
              if (!pickable || readonly || !onPatch) return;
              e.stopPropagation();
              setRenameId(v.id);
              setRenameDraft(v.name || '');
            }}
          >
            {v.name}
          </span>
        )}
        <span className="wvp-node__type">{def.label}</span>
        {pickable && variant === 'manager' && (
          <button
            className="ws-var-row__remove"
            title="Remove variable"
            onClick={(e) => {
              e.stopPropagation();
              onRemove?.(v.id);
              if (selectedId === v.id) setSelectedId(null);
              if (editorId === v.id) setEditorId(null);
            }}
          >
            <X size={10} />
          </button>
        )}
      </div>
    );
  };

  if (variant === 'control') {
    const selected = variables.find((v) => v.name === value);
    const shown = selected || (legacyValue ? displayOptions[0] : undefined);
    const def = shown ? defOf(shown.fieldType) : TYPE_DEFS.text;
    return (
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          className="sails-input"
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left', gap: 6 }}
          onClick={() => setCtrlOpen((o) => !o)}
        >
          {shown ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <span style={{ color: def.color, flexShrink: 0 }}><DynamicIcon name={def.icon} size={11} /></span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{shown.name}</span>
              {!selected && <span className="wvp-node__type">legacy</span>}
            </span>
          ) : (
            <span style={{ color: 'var(--sails-text-muted, #94a3b8)' }}>— none —</span>
          )}
          <ChevronDown size={11} />
        </button>
        {ctrlOpen && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 1049 }} onClick={() => setCtrlOpen(false)} />
            <div
              style={{
                position: 'absolute', top: '100%', left: 0, zIndex: 1050, marginTop: 4, minWidth: 240,
                border: '1px solid var(--sails-border, #2a2a2e)', borderRadius: 8,
                background: 'var(--sails-bg-surface, #1b1b1f)', overflow: 'hidden',
                boxShadow: '0 8px 24px rgba(0,0,0,.45)', padding: 6,
              }}
            >
              <div className="wvp-search" style={{ marginBottom: 4 }}>
                <Search size={11} />
                <input className="wvp-search-input" placeholder="Search variables…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="wvp-tree" style={{ maxHeight: 220 }}>
                <div className="wvp-node" style={{ paddingLeft: 6 }} onClick={() => { onChange?.(undefined); setCtrlOpen(false); }}>
                  <span className="wvp-node__icon" style={{ color: 'var(--sails-text-muted, #94a3b8)' }}><X size={11} /></span>
                  <span className="wvp-node__label" style={{ color: 'var(--sails-text-muted, #94a3b8)' }}>— none —</span>
                </div>
                {filtered.map((v) => renderVarRow(v, { pickable: true }))}
                {displayOptions.map((v) => renderVarRow(v, { pickable: true }))}
                {filtered.length === 0 && displayOptions.length === 0 && (
                  <p className="ls-empty" style={{ padding: 8 }}>No variables declared. Add them under Variables in the Detail View Properties.</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  const editorVar = variables.find((v) => v.id === editorId) || null;
  const editorDef = editorVar ? defOf(editorVar.fieldType) : null;

  return (
    <div>
      <div className="ws-props-section-title ws-var-section-head">
        <span className="ws-var-section-head__title"><Hash size={11} /> Variables ({variables.length})</span>
        <button
          ref={addBtnRef}
          className="sails-btn sails-btn--ghost sails-btn--sm"
          onClick={openAdd}
          disabled={readonly}
        >
          <Plus size={12} /> Add
        </button>
      </div>
      {variables.length === 0 && (
        <p className="ws-props-hint">Layout variables are shared across event chains and condition expressions.</p>
      )}
      <div style={{ margin: '2px 12px', border: '1px solid var(--sails-border,#e2e8f0)', borderRadius: 8, overflow: 'hidden' }}>
        <div className="wvp-search" style={{ border: 'none', borderBottom: '1px solid var(--sails-border,#e2e8f0)', borderRadius: 0 }}>
          <Search size={11} />
          <input className="wvp-search-input" placeholder="Search variables…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="wvp-tree" style={{ maxHeight: 300 }}>
          {filtered.length === 0 && <p className="ls-empty" style={{ padding: 8 }}>No variables declared yet.</p>}
          {filtered.map((v) => renderVarRow(v, { pickable: true }))}
        </div>
      </div>

      {addOpen && addPos && createPortal(
        <div className="ws-var-add-pop wvp-pop" style={{ position: 'fixed', top: addPos.top, left: addPos.left, width: 320, zIndex: 30000 }} onClick={(e) => e.stopPropagation()}>
          <div className="wvp-head"><Braces size={12} /> Add Variable</div>
          <label className="ws-props-label">Name</label>
          <input
            className="ws-props-input"
            autoFocus
            placeholder="Variable name"
            value={addName}
            onChange={(e) => setAddName(sanitizeName(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && addName.trim()) commitAdd();
              if (e.key === 'Escape') setAddOpen(false);
            }}
          />
          <div className="wvp-search">
            <Search size={11} />
            <input className="wvp-search-input" placeholder="Filter types…" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} />
          </div>
          <div className="wvp-tree">
            <div className="wvp-node wvp-node--section"><span className="wvp-node__chevron"><span style={{ width: 11 }} /></span><span className="wvp-node__label">Scalars</span></div>
            {SCALAR_TYPES.filter((t) => !typeFilter.trim() || defOf(t).label.toLowerCase().includes(typeFilter.trim().toLowerCase())).map(renderTypeRow)}
            <div className="wvp-node wvp-node--section"><span className="wvp-node__chevron"><span style={{ width: 11 }} /></span><span className="wvp-node__label">Containers</span></div>
            {CONTAINER_TYPES.filter((t) => !typeFilter.trim() || defOf(t).label.toLowerCase().includes(typeFilter.trim().toLowerCase())).map(renderTypeRow)}
          </div>
          <div className="wvp-preview">
            <span className="wvp-preview__label">New variable</span>
            <code className="wvp-preview__code">{addName.trim() ? `${addName.trim()} · ${defOf(addType).label}` : '—'}</code>
          </div>
          <div className="ws-var-add-pop__footer">
            <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={() => setAddOpen(false)}>Cancel</button>
            <button className="sails-btn sails-btn--primary sails-btn--sm" disabled={!addName.trim()} onClick={commitAdd}>
              <Plus size={12} /> Add
            </button>
          </div>
        </div>,
        document.body,
      )}

      {editorVar && editorDef && !readonly && (
        <div className="ws-modal-overlay" style={{ zIndex: 31000 }} onClick={() => setEditorId(null)}>
          <div className="ws-modal" style={{ width: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="ws-modal__header">
              <span className="ws-modal__icon" style={{ background: `${editorDef.color}1f`, color: editorDef.color }}>
                <DynamicIcon name={editorDef.icon} size={16} />
              </span>
              <div className="ws-modal__titles">
                <span className="ws-modal__title">Variable — {editorVar.name}</span>
                <span className="ws-modal__sub">{editorDef.label}</span>
              </div>
              <button className="ws-icon-btn" onClick={() => setEditorId(null)}><X size={15} /></button>
            </div>
            <div className="ws-modal__body">
              <div className="ws-props-group">
                <label className="ws-props-label">Type</label>
                <select
                  className="ws-props-input"
                  value={editorVar.fieldType}
                  onChange={(e) => onPatch?.(editorVar.id, { fieldType: e.target.value as FormVariable['fieldType'] })}
                >
                  {Object.entries(TYPE_DEFS).map(([t, def]) => <option key={t} value={t}>{def.label}</option>)}
                </select>
              </div>
              <div className="ws-props-group">
                <label className="ws-props-label">Default value</label>
                <input
                  className="ws-props-input"
                  value={editorVar.defaultValue ?? ''}
                  placeholder={editorVar.fieldType === 'boolean' ? 'true / false' : 'Static default (used when no expression is set)'}
                  onChange={(e) => onPatch?.(editorVar.id, { defaultValue: e.target.value })}
                />
              </div>
              <div className="ws-props-group">
                <label className="ws-props-label">JSONata default expression</label>
                <input
                  className="ws-props-input"
                  style={{ fontFamily: 'var(--sails-font-mono, ui-monospace, Menlo, monospace)', fontSize: 11 }}
                  value={editorVar.expression || ''}
                  placeholder="$now() — evaluated with record + vars at chain start"
                  onChange={(e) => onPatch?.(editorVar.id, { expression: e.target.value || undefined })}
                />
              </div>
              <div className="ws-props-group">
                <label className="ws-props-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="checkbox" checked={!!editorVar.exposeToForm} onChange={(e) => onPatch?.(editorVar.id, { exposeToForm: e.target.checked })} />
                  Expose to form
                </label>
                <p className="ws-props-hint">Write the resolved value into the form controls after the chain runs.</p>
              </div>
            </div>
            <div className="ws-modal__footer">
              <button className="sails-btn sails-btn--primary sails-btn--sm" onClick={() => setEditorId(null)}>
                <CheckCircle2 size={14} /> Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LayoutVariablesPicker;
