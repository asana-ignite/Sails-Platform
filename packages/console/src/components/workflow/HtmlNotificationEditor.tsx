/**
 * HtmlNotificationEditor — rich-text (full HTML) body editor for the
 * notification message.  Uses @tiptap/react with the full extension set
 * (StarterKit, Underline, Link, FontFamily, TextStyle, Tables, Color).
 *
 * Variable integration mirrors the plain VariableTextInput:
 *  - `{{` intellisense popup with record/collection drill-down
 *  - `…` picker (hierarchy, drag) inserts Variable chips at the caret
 *  - ƒ Expression button opens the JSONata editor ({{$expr}} evaluated at
 *    runtime by renderTemplate)
 *  - Variables render as inline chips (`<span data-ref>`), stored inside the
 *    HTML so renderTemplate's marker replacement still works.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import type { Editor } from '@tiptap/core';
import { Node } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import FontFamily from '@tiptap/extension-font-family';
import { TextStyle } from '@tiptap/extension-text-style';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { Hash, Bold, Italic, UnderlineIcon, List, ListOrdered, Quote, Code2, Strikethrough, Table2, FunctionSquare, X } from 'lucide-react';
import { WorkflowVariablePicker, type PickerColumn } from './WorkflowVariablePicker';
import { VariableAutocomplete } from './VariableAutocomplete';
import { escapeHtml, type PickerVariable, type PickerSchemaMap } from './variableTree';
import { createPortal } from 'react-dom';
import ExpressionEditor from './ExpressionEditor';

interface Props {
  value: string;
  variables: PickerVariable[];
  recordSchemas?: PickerSchemaMap;
  recordSchema?: PickerColumn[];
  /** Triggering record model fields — enables `record.` / `oldRecord.` context branches. */
  triggerModelFields?: PickerColumn[];
  triggerModelName?: string;
  includeOldRecord?: boolean;
  includeRequestor?: boolean;
  onChange: (html: string) => void;
}

/** Inline chip node for {{var}} references. */
const VariableNode = Node.create({
  name: 'variable',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes: () => ({ ref: { default: null } }),
  parseHTML: () => [{ tag: 'span[data-ref]' }],
  renderHTML: ({ node }) => ['span', { class: 'wve-chip', 'data-ref': node.attrs.ref }, node.attrs.ref],
});

export const HtmlNotificationEditor: React.FC<Props> = ({
  value, variables, recordSchemas = {}, recordSchema,
  triggerModelFields, triggerModelName, includeOldRecord, includeRequestor, onChange,
}) => {
  const [auto, setAuto] = useState<{ anchor: { left: number; top: number }; query: string } | null>(null);
  const closeAuto = useCallback(() => setAuto(null), []);
  const [exprOpen, setExprOpen] = useState(false);
  const [exprDraft, setExprDraft] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastValueRef = useRef(value);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Link.configure({ openOnClick: false }),
      FontFamily,
      TextStyle,
      (Table as any).configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      VariableNode,
    ],
    content: value && /<\/?[a-z][\s\S]*>/i.test(value) ? value : `<p>${escapeHtml(value || '')}</p>`,
    onUpdate: ({ editor }: { editor: any }) => {
      const html = editor.getHTML();
      lastValueRef.current = html;
      onChange(html);
      checkAutocomplete();
    },
    editorProps: {
      attributes: { class: 'wfe-html-editor' },
      handleDOMEvents: {
        drop: (view: any, event: any) => {
          const ref = readRef(event as DragEvent);
          if (!ref) return false;
          const coords = view.posAtCoords({ left: (event as DragEvent).clientX, top: (event as DragEvent).clientY });
          if (coords) {
            view.dispatch(view.state.tr.insert(coords.pos, view.state.schema.nodes.variable.create({ ref })));
            return true;
          }
          return false;
        },
      },
    },
  });

  function readRef(e: DragEvent): string {
    let ref = e.dataTransfer?.getData('text/plain') || '';
    if (!ref) {
      try { ref = JSON.parse(e.dataTransfer?.getData('application/json') || '{}')?.ref || ''; } catch { /* ignore */ }
    }
    return ref;
  }

  const checkAutocomplete = useCallback(() => {
    const ed = editor;
    if (!ed || ed.isDestroyed) return;
    const sel = ed.state.selection;
    const before = ed.state.doc.textBetween(0, sel.from, '\n', '');
    const m = before.match(/\{\{([^{}]*)$/);
    if (!m) { setAuto(null); return; }
    const rect = ed.view.coordsAtPos(sel.from);
    setAuto({ anchor: { left: rect.left, top: rect.bottom }, query: m[1] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  const insertRef = useCallback((ref: string) => {
    const ed = editor;
    if (!ed || ed.isDestroyed) return;
    // Replace the typed `{{query` (before the caret) with the chip node.
    const sel = ed.state.selection;
    const before = ed.state.doc.textBetween(0, sel.from, '\n', '');
    const m = before.match(/\{\{([^{}]*)$/);
    const from = m ? sel.from - m[0].length : sel.from;
    ed.chain().focus().deleteRange({ from, to: sel.from }).insertContent(
      `<span data-ref="${ref}">${escapeHtml(ref)}</span>`,
    ).run();
    setAuto(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  const pickerOnExpression = (expr: string) => insertRef(`{{$${expr}}}`);

  // ── Expression modal (ƒ) ──
  const exprVariables = useMemo(() => {
    const list: any[] = variables.map((v) => ({
      id: v.id, name: v.name, fieldType: v.fieldType, targetModel: v.targetModel,
      columns: (v.columns || []).map((c) => ({ fieldName: c.fieldName, label: c.label || c.fieldName, logicalType: c.logicalType || 'text', ...(c.targetModel ? { targetModel: c.targetModel } : {}) })),
    }));
    if (recordSchema && recordSchema.length > 0) {
      list.unshift({ id: '__record__', name: 'record', fieldType: 'record', columns: recordSchema });
    }
    return list;
  }, [variables, recordSchema]);

  /** Strict column shape expected by the ExpressionEditor's suggestion types. */
  const strictCols = (cols?: PickerColumn[]): { fieldName: string; label: string; logicalType: string; targetModel?: string }[] =>
    (cols || []).map((c) => ({
      fieldName: c.fieldName,
      label: c.label || c.fieldName,
      logicalType: c.logicalType || 'text',
      ...(c.targetModel ? { targetModel: c.targetModel } : {}),
    }));

  const exprSchemas = useMemo(() => {
    const out: Record<string, { fieldName: string; label: string; logicalType: string; targetModel?: string }[]> = {};
    for (const [k, cols] of Object.entries(recordSchemas)) out[k] = strictCols(cols);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordSchemas]);

  const exprSample = useMemo(() => {    const sample: Record<string, any> = {};
    for (const v of variables) {
      if (!v.name) continue;
      const t = v.fieldType || 'text';
      if (t === 'number' || t === 'decimal') sample[v.name] = 0;
      else if (t === 'boolean') sample[v.name] = false;
      else if (t === 'record' && v.columns?.length) { const row: Record<string, any> = {}; for (const c of v.columns) row[c.fieldName] = ''; sample[v.name] = row; }
      else if (t === 'collection') sample[v.name] = [];
      else sample[v.name] = 'sample value';
    }
    if (recordSchema && recordSchema.length > 0) { const rec: Record<string, any> = {}; for (const c of recordSchema) rec[c.fieldName] = ''; sample.record = rec; }
    return sample;
  }, [variables, recordSchema]);

  const activeVars = variables.filter((v) => v.name);

  const tb = (action: string, attrs: any, icon: React.ReactNode, title?: string) => (
    <button type="button" key={action + (attrs?.level ?? '')}
      className={`tiptap-editor__btn${editor?.isActive(action, attrs) ? ' tiptap-editor__btn--active' : ''}`}
      onClick={() => { if (editor) editor.chain().focus()[action as any](attrs).run(); }}
      title={title || action}>
      {icon}
    </button>
  );

  return (
    <div ref={containerRef} style={{ border: '1px solid var(--sails-border,#e2e8f0)', borderRadius: 6, overflow: 'hidden' }}>
      {/* Toolbar */}
      <div className="tiptap-editor__toolbar">
        {tb('toggleBold', {}, <Bold size={14} />)}
        {tb('toggleItalic', {}, <Italic size={14} />)}
        {tb('toggleUnderline', {}, <UnderlineIcon size={14} />)}
        {tb('toggleStrike', {}, <Strikethrough size={14} />)}
        <span className="tiptap-editor__divider" />
        {tb('toggleHeading', { level: 2 }, <strong>H2</strong>)}
        {tb('toggleHeading', { level: 3 }, <strong>H3</strong>)}
        <span className="tiptap-editor__divider" />
        {tb('toggleBulletList', {}, <List size={14} />)}
        {tb('toggleOrderedList', {}, <ListOrdered size={14} />)}
        {tb('toggleBlockquote', {}, <Quote size={14} />)}
        {tb('toggleCodeBlock', {}, <Code2 size={14} />)}
        {tb('insertTable', { rows: 2, cols: 2, withHeaderRow: true }, <Table2 size={14} />, 'Insert table')}
        <span className="tiptap-editor__divider" />
        <WorkflowVariablePicker
          variables={variables}
          recordSchemas={recordSchemas}
          recordSchema={recordSchema}
          triggerModelFields={triggerModelFields}
          triggerModelName={triggerModelName}
          includeOldRecord={includeOldRecord}
          includeRequestor={includeRequestor}
          value=""
          variant="trigger"
          onChange={insertRef}
          onExpression={pickerOnExpression}
        />
        <button type="button" className="tiptap-editor__btn" title="Formulate a JSONata expression"
          onClick={() => { setExprDraft(''); setExprOpen(true); }}>
          <FunctionSquare size={14} />
        </button>
      </div>

      {/* Variable chip bar (quick top-level variables) */}
      {activeVars.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '5px 8px', background: 'var(--sails-bg-secondary,#f8fafc)', borderBottom: '1px solid var(--sails-border,#e2e8f0)', fontSize: 11, alignItems: 'center' }}>
          <Hash size={12} style={{ color: 'var(--sails-text-muted,#94a3b8)', marginRight: 2 }} />
          {activeVars.map((v) => (
            <button key={v.id} type="button"
              onClick={() => insertRef(`{{${v.name}}}`)}
              title={`Insert {{${v.name}}}`}
              style={{ fontSize: 10, fontWeight: 500, padding: '2px 6px', border: '1px solid var(--sails-border,#e2e8f0)', borderRadius: 4, background: 'var(--sails-bg-card,#fff)', color: 'var(--sails-text-primary,#1e293b)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {v.name}
            </button>
          ))}
          <span style={{ fontSize: 10, color: 'var(--sails-text-muted,#94a3b8)', marginLeft: 'auto' }}>type {'{{'} for intellisense</span>
        </div>
      )}

      {/* Editor */}
      <div style={{ padding: 0, minHeight: 120 }}>
        <EditorContent editor={editor} />
      </div>

      <VariableAutocomplete
        open={!!auto}
        anchor={auto?.anchor || null}
        query={auto?.query || ''}
        variables={variables}
        recordSchemas={recordSchemas}
        onPick={insertRef}
        onClose={closeAuto}
      />

      {/* ƒ Expression modal */}
      {exprOpen && createPortal(
        <div className="ws-modal-overlay" style={{ zIndex: 90 }} onClick={() => setExprOpen(false)}>
          <div className="ws-modal" style={{ width: 860 }} onClick={(e) => e.stopPropagation()}>
            <div className="ws-modal__header">
              <span className="ws-modal__icon" style={{ background: 'rgba(168,85,247,.12)', color: '#a855f7' }}><FunctionSquare size={16} /></span>
              <div className="ws-modal__titles">
                <span className="ws-modal__title">Expression</span>
                <span className="ws-modal__sub">Evaluate against workflow variables and the triggering record</span>
              </div>
              <button className="ws-icon-btn" onClick={() => setExprOpen(false)}><X size={15} /></button>
            </div>
            <div className="ws-modal__body">
              <ExpressionEditor
                showSnippets
                variables={exprVariables}
                recordSchemas={recordSchemas as any}
                value={exprDraft}
                onChange={setExprDraft}
                sample={exprSample}
              />
            </div>
            <div className="ws-modal__footer">
              <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={() => setExprOpen(false)}>Cancel</button>
              <button className="sails-btn sails-btn--primary sails-btn--sm" disabled={!exprDraft.trim()}
                onClick={() => { pickerOnExpression(exprDraft.trim()); setExprOpen(false); }}>
                Use Expression
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};

export default HtmlNotificationEditor;
