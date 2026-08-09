/**
 * WorkflowVariablePicker — reusable variable reference picker.
 *
 * Control: [ {{ref}} ][…]  (like the Relation LookupControl).  The … button
 * opens a popup with a hierarchy tree of workflow variables:
 *
 *   > InvoiceId (Number)
 *   > Invoice (Record)
 *        > Id (Number)
 *        > InvoiceItems (Collection)
 *             > [N] (Number)  ← index input, then the item columns
 *                  > Amount (Number)
 *
 * Emits the reference as `{{var.path}}` (moustache) or `var.path` (jsonata)
 * via onChange.  Used anywhere a workflow variable reference is needed.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, ChevronDown, MoreHorizontal, Search, Plus, X, Hash, Database, Layers, Type, Calendar, Clock, User, ToggleLeft, Braces, FunctionSquare, CheckCircle2, Mail, Phone, Link2, List, FileText, DollarSign, Percent, MapPin, Paperclip, AlignLeft } from 'lucide-react';
import { STRUCTURED_TYPE_SUBFIELDS } from '@sails/shared';
import ExpressionEditor from './ExpressionEditor';

export interface PickerColumn {
  fieldName: string;
  label?: string;
  logicalType?: string;
  targetModel?: string;
}

export interface PickerVariable {
  id: string;
  name: string;
  fieldType: string;
  targetModel?: string;
  columns?: PickerColumn[];
}

export type PickerSchemaMap = Record<string, PickerColumn[]>;

interface Props {
  variables: PickerVariable[];
  recordSchemas?: PickerSchemaMap;
  value: string;
  onChange: (ref: string) => void;
  format?: 'moustache' | 'jsonata';
  placeholder?: string;
  disabled?: boolean;
  /** 'control' = input + trigger (default); 'trigger' = … button only (parent renders chips). */
  variant?: 'control' | 'trigger';
  /** When set, only whole top-level variables are selectable (children hidden) — for choosing a target variable itself, never a leaf. */
  topLevelOnly?: boolean;
  /** Workflow root model fields — enables `record.` / `oldRecord.` context branches. */
  triggerModelFields?: PickerColumn[];
  triggerModelName?: string;
  /** Show the `oldRecord` (previous values) branch — only meaningful on update. */
  includeOldRecord?: boolean;
  /** Show the `requestor` / `request_date` workflow-context branch. */
  includeRequestor?: boolean;
  /** When provided, the popup shows a "ƒ Expression…" button that opens the JSONata ExpressionEditor. */
  onExpression?: (expr: string) => void;
  /** When provided, the popup header shows a '+ Add' button that opens the variable creation flow.
   *  The anchor element (the picker trigger) is passed for popover positioning; a resolved
   *  variable name lets the caller auto-insert it (e.g. as a chip). */
  onAddVariable?: (anchorEl?: HTMLElement) => void | Promise<string | null>;
  /** Triggering record schema (columns) — enables `record.<field>` intellisense in the expression editor. */
  recordSchema?: PickerColumn[];
  /** External anchor for popup placement (e.g. a host toolbar button). Defaults to the internal trigger. */
  anchorOverride?: () => HTMLElement | null;
  /** When this number increments (>0), the popup opens at the current anchor. */
  openSignal?: number;
}

export interface TreeNode {
  key: string;
  label: string;
  typeLabel: string;
  kind: 'section' | 'leaf' | 'record' | 'collection' | 'index' | 'all';
  seg: string;
  indexKey?: string; // for 'index' nodes — collection variable/field name
  children?: TreeNode[];
  /** Structured source descriptor for mapping drags (record/oldRecord/requestor…). */
  source?: 'wf' | 'record' | 'record_old' | 'variable';
  fieldName?: string;
  varName?: string;
  logicalType?: string;
  /** Set on collection-item leaves — the owning collection variable's name (index via [N]). */
  itemKey?: string;
  /** Model the record/collection node belongs to (whole-record mapping gates on this). */
  modelName?: string;
}

/** Requestor leaves (mirrors the engine's workflow context resolution). */
export const REQUESTOR_FIELDS: { field: string; label: string; logicalType: string }[] = [
  { field: 'name', label: 'Name', logicalType: 'text' },
  { field: 'email', label: 'Email', logicalType: 'email' },
  { field: 'role', label: 'Role', logicalType: 'text' },
  { field: 'title', label: 'Job Title', logicalType: 'text' },
  { field: 'team', label: 'Team', logicalType: 'text' },
  { field: 'position', label: 'Position', logicalType: 'text' },
];

const TYPE_ICON: Record<string, React.ReactNode> = {
  number: <Hash size={12} />, decimal: <Hash size={12} />, currency: <DollarSign size={12} />, percentage: <Percent size={12} />, auto_number: <Hash size={12} />,
  date: <Calendar size={12} />, datetime: <Calendar size={12} />, time: <Clock size={12} />,
  user: <User size={12} />, boolean: <ToggleLeft size={12} />,
  record: <Database size={12} />, collection: <Layers size={12} />, relation: <Database size={12} />,
  email: <Mail size={12} />, phone: <Phone size={12} />, url: <Link2 size={12} />, select: <List size={12} />,
  short_text: <Type size={12} />, long_text: <AlignLeft size={12} />, rich_text: <FileText size={12} />,
  address: <MapPin size={12} />, lat_lng: <MapPin size={12} />, attachment: <Paperclip size={12} />, uuid: <Hash size={12} />,
};

const TYPE_LABEL: Record<string, string> = {
  number: 'Number', decimal: 'Number', currency: 'Currency', percentage: 'Percentage', auto_number: 'Auto Number',
  date: 'Date', datetime: 'Date & Time', time: 'Time',
  user: 'User', boolean: 'Boolean', text: 'Text', long_text: 'Long Text', short_text: 'Short Text', rich_text: 'Rich Text',
  email: 'Email', phone: 'Phone', url: 'URL', select: 'Select',
  record: 'Record', collection: 'Collection', relation: 'Record', address: 'Address', lat_lng: 'Lat / Lng', attachment: 'Attachment', uuid: 'UUID',
};

function iconOf(t?: string): React.ReactNode {
  return TYPE_ICON[t || 'text'] || <Type size={12} />;
}
function typeLabelOf(t?: string): string {
  return TYPE_LABEL[t || 'text'] || t || 'Value';
}

/** Column child nodes; `parent` carries the owning variable's descriptor so
 * nested leaves (record fields, collection items) are mappable/draggable. */
function colNodes(
  cols: PickerColumn[] | undefined,
  schemas: PickerSchemaMap,
  parent?: { varName: string; inCollection: boolean },
): TreeNode[] | undefined {
  if (!cols || cols.length === 0) return undefined;
  return cols.map((c) => {
    const seg = c.fieldName;
    const t = c.logicalType || 'text';
    // Structured JSON types (address / lat_lng) drill into their sub-fields.
    const subs = STRUCTURED_TYPE_SUBFIELDS[t];
    if (subs && subs.length > 0) {
      return {
        key: `col:${seg}`, label: c.label || seg, typeLabel: typeLabelOf(t), kind: 'record', seg, source: 'variable', varName: parent?.varName, logicalType: t,
        children: subs.map((s) => ({
          key: `col:${seg}.${s.fieldName}`, label: s.label, typeLabel: typeLabelOf(s.logicalType), kind: 'leaf', seg: s.fieldName,
          source: 'variable', varName: parent?.varName, fieldName: `${seg}.${s.fieldName}`, logicalType: s.logicalType,
          itemKey: parent?.inCollection ? parent.varName : undefined,
        })),
      };
    }
    if (t === 'collection') {
      const itemCols = c.targetModel ? schemas[c.targetModel] : undefined;
      return {
        key: `col:${seg}`, label: c.label || seg, typeLabel: 'Collection', kind: 'collection', seg,
        children: [
          // "All items" — fields without an index → maps over every row
          // (JSONata `record.collection.field`, e.g. inside $sum(...)).
          {
            key: `col:${seg}:all`, label: 'All items', typeLabel: 'All', kind: 'all', seg: '', source: 'variable', varName: parent?.varName,
            children: itemCols ? colNodes(itemCols, schemas, parent) : undefined,
          },
          {
            key: `col:${seg}:idx`, label: '[N]', typeLabel: 'Number', kind: 'index', seg, indexKey: seg,
            children: itemCols ? colNodes(itemCols, schemas, parent) : undefined,
          },
        ],
      };
    }
    if (t === 'relation' || t === 'lookup') {
      const childCols = c.targetModel ? schemas[c.targetModel] : undefined;
      return {
        key: `col:${seg}`, label: c.label || seg, typeLabel: 'Record', kind: 'record', seg,
        children: childCols ? colNodes(childCols, schemas, parent) : undefined,
      };
    }
    return {
      key: `col:${seg}`, label: c.label || seg, typeLabel: typeLabelOf(t), kind: 'leaf', seg,
      source: 'variable', varName: parent?.varName, fieldName: seg, logicalType: t,
      itemKey: parent?.inCollection ? parent.varName : undefined,
    };
  });
}

function varNode(v: PickerVariable, schemas: PickerSchemaMap): TreeNode {
  const t = v.fieldType || 'text';
  if (t === 'collection') {
    const itemCols = v.columns && v.columns.length > 0 ? v.columns : (v.targetModel ? schemas[v.targetModel] : undefined);
    return {
      key: `var:${v.name}`, label: v.name, typeLabel: 'Collection', kind: 'collection', seg: v.name, source: 'variable', varName: v.name, modelName: v.targetModel,
      children: [
        // "All items" — fields without an index → maps over every row
        // (JSONata `var.field`, e.g. inside $sum(...)).
        {
          key: `var:${v.name}:all`, label: 'All items', typeLabel: 'All', kind: 'all', seg: '', source: 'variable', varName: v.name,
          children: itemCols ? colNodes(itemCols, schemas, { varName: v.name, inCollection: true }) : undefined,
        },
        {
          key: `var:${v.name}:idx`, label: '[N]', typeLabel: 'Number', kind: 'index', seg: v.name, indexKey: v.name,
          children: itemCols ? colNodes(itemCols, schemas, { varName: v.name, inCollection: true }) : undefined,
        },
      ],
    };
  }
  if (t === 'record') {
    return {
      key: `var:${v.name}`, label: v.name, typeLabel: 'Record', kind: 'record', seg: v.name, source: 'variable', varName: v.name, modelName: v.targetModel,
      children: colNodes(v.columns, schemas, { varName: v.name, inCollection: false }),
    };
  }
  return { key: `var:${v.name}`, label: v.name, typeLabel: typeLabelOf(t), kind: 'leaf', seg: v.name, source: 'variable', varName: v.name, logicalType: t };
}

function topNodes(vars: PickerVariable[], schemas: PickerSchemaMap): TreeNode[] {
  return vars.filter((v) => v.name).map((v) => varNode(v, schemas));
}

/** A record/oldRecord branch from the workflow root model's fields. */
function recordBranch(source: 'record' | 'record_old', label: string, modelName: string | undefined, fields: PickerColumn[]): TreeNode {
  const seg = source === 'record' ? 'record' : 'oldRecord';
  return {
    key: `${source}:root`, label, typeLabel: modelName ? `Record · ${modelName}` : 'Record', kind: 'record', seg, source, modelName,
    children: fields.flatMap((f): TreeNode[] => {
      const fn = f.fieldName || f.label || 'field';
      const lt = f.logicalType || 'text';
      const subs = STRUCTURED_TYPE_SUBFIELDS[lt];
      if (subs && subs.length > 0) {
        return [{
          key: `${source}:${fn}`, label: f.label || fn, typeLabel: typeLabelOf(lt), kind: 'record', seg: fn, source, fieldName: fn, logicalType: lt,
          children: subs.map((s) => ({
            key: `${source}:${fn}.${s.fieldName}`, label: s.label, typeLabel: typeLabelOf(s.logicalType), kind: 'leaf', seg: s.fieldName,
            source, fieldName: `${fn}.${s.fieldName}`, logicalType: s.logicalType,
          })),
        }];
      }
      return [{
        key: `${source}:${fn}`, label: f.label || fn, typeLabel: typeLabelOf(lt), kind: 'leaf', seg: fn, source, fieldName: fn, logicalType: lt,
      }];
    }),
  };
}

export interface ContextTreeInput {
  variables: PickerVariable[];
  recordSchemas?: PickerSchemaMap;
  triggerModelFields?: PickerColumn[];
  triggerModelName?: string;
  includeOldRecord?: boolean;
  includeRequestor?: boolean;
  /** Result-target mode: no context branches, variables without drill-down. */
  topLevelOnly?: boolean;
}

/**
 * Build the unified workflow context tree:
 * Workflow Context (Requestor / Request Date / Record / OldRecord), Variables, Collections.
 */
export function buildContextRoot(input: ContextTreeInput): TreeNode[] {
  const { variables, recordSchemas = {}, triggerModelFields, triggerModelName, includeOldRecord, includeRequestor, topLevelOnly } = input;
  const nodes: TreeNode[] = [];

  const ctxChildren: TreeNode[] = [];
  if (includeRequestor) {
    ctxChildren.push({
      key: 'wf:requestor', label: 'Requestor', typeLabel: 'Record', kind: 'record', seg: 'requestor', source: 'wf',
      children: REQUESTOR_FIELDS.map((rf) => ({
        key: `wf:requestor.${rf.field}`, label: rf.label, typeLabel: typeLabelOf(rf.logicalType), kind: 'leaf',
        seg: rf.field, source: 'wf', fieldName: `requestor.${rf.field}`, logicalType: rf.logicalType,
      })),
    });
    ctxChildren.push({
      key: 'wf:request_date', label: 'Request Date', typeLabel: 'Date', kind: 'leaf', seg: 'request_date',
      source: 'wf', fieldName: 'request_date', logicalType: 'date',
    });
  }
  if (triggerModelFields && triggerModelFields.length > 0) {
    ctxChildren.push(recordBranch('record', 'Record', triggerModelName, triggerModelFields));
    if (includeOldRecord) ctxChildren.push(recordBranch('record_old', 'OldRecord', triggerModelName, triggerModelFields));
  }
  if (ctxChildren.length > 0 && !topLevelOnly) {
    nodes.push({ key: 'sec:wf', label: 'Workflow Context', typeLabel: 'Context', kind: 'section', seg: '', children: ctxChildren });
  }

  const scalarsRecords = topNodes(variables, recordSchemas).filter((n) => n.kind !== 'collection');
  const collections = topNodes(variables, recordSchemas).filter((n) => n.kind === 'collection');
  if (scalarsRecords.length > 0) {
    nodes.push({
      key: 'sec:vars', label: 'Variables', typeLabel: 'Variables', kind: 'section', seg: '',
      children: topLevelOnly ? scalarsRecords.map((n) => ({ ...n, children: undefined })) : scalarsRecords,
    });
  }
  if (collections.length > 0) {
    nodes.push({
      key: 'sec:collections', label: 'Collections', typeLabel: 'Collections', kind: 'section', seg: '',
      children: topLevelOnly ? collections.map((n) => ({ ...n, children: undefined })) : collections,
    });
  }
  return nodes;
}

/** Flat render-order row list with indentation depth (children only when expanded). */
export function flattenTree(nodes: TreeNode[], expanded: Set<string>): { node: TreeNode; depth: number }[] {
  const out: { node: TreeNode; depth: number }[] = [];
  const walk = (list: TreeNode[], depth: number) => {
    for (const n of list) {
      out.push({ node: n, depth });
      if (n.children && n.children.length > 0 && expanded.has(n.key)) walk(n.children, depth + 1);
    }
  };
  walk(nodes, 0);
  return out;
}

/** Recursive name filter (keeps parents of matches). */
export function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;
  const out: TreeNode[] = [];
  for (const n of nodes) {
    const self = n.label.toLowerCase().includes(q);
    const children = n.children ? filterTree(n.children, q) : undefined;
    if (self || (children && children.length > 0)) out.push({ ...n, children });
  }
  return out;
}

export const WorkflowVariablePicker: React.FC<Props> = ({
  variables, recordSchemas = {}, value, onChange, format = 'moustache', placeholder = 'Select variable…', disabled, variant = 'control',
  onExpression, recordSchema, topLevelOnly, triggerModelFields, triggerModelName, includeOldRecord, includeRequestor,
  onAddVariable, anchorOverride, openSignal,
}) => {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [indexValues, setIndexValues] = useState<Record<string, string>>({});
  const [selection, setSelection] = useState<string[] | null>(null);
  const [popupPos, setPopupPos] = useState<{ top: number; left: number } | null>(null);
  const [exprOpen, setExprOpen] = useState(false);
  const [exprDraft, setExprDraft] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  /** The internal trigger button — the popover anchor for '+' Add variable. */
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  /** The anchor the popup measures/stays-attached to: the external override
   *  (e.g. a host toolbar button) or this picker's own trigger button. */
  const anchorEl = (): HTMLElement | null => anchorOverride?.() || anchorRef.current;

  // Open programmatically from the host (SunEditor toolbar button).
  useEffect(() => {
    if (!openSignal) return;
    openPopup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSignal]);

  // ── Expression editor (ƒ) ──
  /** Strict column shape expected by the ExpressionEditor's suggestion types. */
  const strictCols = (cols?: PickerColumn[]): { fieldName: string; label: string; logicalType: string; targetModel?: string }[] =>
    (cols || []).map((c) => ({
      fieldName: c.fieldName,
      label: c.label || c.fieldName,
      logicalType: c.logicalType || 'text',
      ...(c.targetModel ? { targetModel: c.targetModel } : {}),
    }));

  const exprVariables = useMemo(() => {
    const list: any[] = variables.map((v) => ({
      id: v.id, name: v.name, fieldType: v.fieldType, targetModel: v.targetModel,
      columns: strictCols(v.columns),
    }));
    if (recordSchema && recordSchema.length > 0) {
      list.unshift({ id: '__record__', name: 'record', fieldType: 'record', columns: strictCols(recordSchema) });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variables, recordSchema]);

  const exprSchemas = useMemo(() => {
    const out: Record<string, { fieldName: string; label: string; logicalType: string; targetModel?: string }[]> = {};
    for (const [k, cols] of Object.entries(recordSchemas)) out[k] = strictCols(cols);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordSchemas]);

  const exprSample = useMemo(() => {
    const sample: Record<string, any> = {};
    for (const v of variables) {
      if (!v.name) continue;
      const t = v.fieldType || 'text';
      if (t === 'number' || t === 'decimal') sample[v.name] = 0;
      else if (t === 'boolean') sample[v.name] = false;
      else if (t === 'record' && v.columns?.length) {
        const row: Record<string, any> = {};
        for (const c of v.columns) row[c.fieldName] = '';
        sample[v.name] = row;
      } else if (t === 'collection') sample[v.name] = [];
      else sample[v.name] = 'sample value';
    }
    if (recordSchema && recordSchema.length > 0) {
      const rec: Record<string, any> = {};
      for (const c of recordSchema) rec[c.fieldName] = '';
      sample.record = rec;
    }
    return sample;
  }, [variables, recordSchema]);

  const openExpression = () => {
    setOpen(false);
    setExprDraft('');
    setExprOpen(true);
  };

  const rawTree = useMemo(
    () => buildContextRoot({
      variables,
      recordSchemas,
      triggerModelFields,
      triggerModelName,
      includeOldRecord,
      includeRequestor,
      topLevelOnly,
    }),
    [variables, recordSchemas, triggerModelFields, triggerModelName, includeOldRecord, includeRequestor, topLevelOnly]
  );
  // Search narrows nodes by name; parents of matches are kept.
  const tree = useMemo(() => filterTree(rawTree, searchQuery), [rawTree, searchQuery]);
  const searching = searchQuery.trim().length > 0;

  // Close on outside click / Escape (popup is portaled to document.body).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (anchorEl()?.contains(t)) return;
      if (popupRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  /** Placement is decided ONCE (from anchor + measured height) and then locked,
   *  so corrections on scroll/resize can never flip it back and forth. */
  const placementRef = useRef<'below' | 'above'>('below');
  /** Horizontal position is decided once too. Re-deriving it from the anchor
   *  each pass caused an infinite loop when the popup sat exactly on the
   *  clamp boundary (pr.right == innerWidth - 8): clamped → "fits" → reset to
   *  anchor.left → clamped → … ("Maximum update depth exceeded", popup shake). */
  const leftRef = useRef<number | null>(null);

  /** Measure the portaled popup and correct its position against the viewport. */
  const correctPopupPos = () => {
    const popup = popupRef.current;
    const anchor = anchorEl();
    if (!popup || !anchor) return;
    const pr = popup.getBoundingClientRect();
    const ar = anchor.getBoundingClientRect();
    const top = placementRef.current === 'above'
      ? Math.max(8, ar.top - pr.height - 6)
      : ar.bottom + 6;
    if (leftRef.current == null) {
      let left = ar.left;
      if (left + pr.width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - pr.width - 8);
      if (left < 8) left = 8;
      leftRef.current = left;
    } else {
      // Re-clamp the locked left on resize (monotonic — never returns to the anchor).
      leftRef.current = Math.max(8, Math.min(leftRef.current, window.innerWidth - pr.width - 8));
    }
    const left = leftRef.current;
    setPopupPos((prev) => (prev && prev.top === top && prev.left === left ? prev : { top, left }));
  };

  // Decide the placement once (measured height vs room below), then follow scroll/resize.
  useEffect(() => {
    if (!open) {
      leftRef.current = null;
      return;
    }
    const popup = popupRef.current;
    const anchor = anchorEl();
    if (popup && anchor) {
      const pr = popup.getBoundingClientRect();
      const ar = anchor.getBoundingClientRect();
      placementRef.current = ar.bottom + 6 + pr.height > window.innerHeight - 8 ? 'above' : 'below';
    }
    correctPopupPos();
    const reposition = () => correctPopupPos();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, popupPos]);

  // Seed the selection from the current value when the popup opens.
  const openPopup = () => {
    const anchor = anchorEl();
    if (anchor) {
      // Open below the trigger (no height guessing) — corrected after mount.
      const r = anchor.getBoundingClientRect();
      setPopupPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - 408)) });
    } else {
      setPopupPos(null);
    }
    setOpen(true);
    setSearchQuery('');
    const raw = value.trim();
    const inner = raw.startsWith('{{') && raw.endsWith('}}') ? raw.slice(2, -2) : raw;
    const segs = inner ? inner.split('.').filter(Boolean) : [];
    if (segs.length > 0) {
      setSelection(segs);
      // Expand the path so the current node is visible (context branches use
      // their source prefix: record/oldRecord/requestor).
      const exp = new Set<string>();
      let key = '';
      for (const s of segs) {
        if (!key) {
          const prefix = s === 'record' || s === 'oldRecord' || s === 'requestor' ? s : 'var';
          key = `${prefix}:${s}`;
        } else {
          key = `${key}.${s}`;
        }
        exp.add(key);
      }
      setExpanded(exp);
      // Seed indices from numeric segments.
      const idx: Record<string, string> = {};
      for (const s of segs) {
        const m = s.match(/^(\d+)$/);
        if (m) { /* index belongs to the preceding collection — resolve lazily */ }
      }
      setIndexValues(idx);
    } else {
      setSelection(null);
    }
  };

  const segFor = (node: TreeNode): string => {
    if (node.kind === 'index') {
      const v = (indexValues[node.indexKey || node.key] || '').trim();
      return v === '' ? '0' : v;
    }
    // "All items" contributes no path segment (invoice_item.line_total).
    if (node.kind === 'all') return '';
    return node.seg;
  };

  const refFrom = (path: string[]): string => {
    const joined = path.filter(Boolean).join('.');
    return format === 'jsonata' ? joined : `{{${joined}}}`;
  };

  const toggleExpand = (node: TreeNode) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(node.key)) next.delete(node.key);
      else next.add(node.key);
      return next;
    });
  };

  const isSelectedPath = (path: string[]): boolean => {
    if (!selection) return false;
    if (path.length !== selection.length) return false;
    return path.every((s, i) => s === selection![i]);
  };

  const renderNode = (node: TreeNode, path: string[]): React.ReactNode => {
    const seg = segFor(node);
    const nodePath = [...path, seg];
    const isOpen = searching || expanded.has(node.key);
    const hasChildren = !!node.children && node.children.length > 0;
    const selected = isSelectedPath(nodePath);
    const dragRef = refFrom(nodePath);

    return (
      <div key={node.key}>
        <div
          className={`wvp-node ${selected ? 'wvp-node--selected' : ''} ${node.kind === 'index' ? 'wvp-node--index' : ''} ${node.kind === 'section' ? 'wvp-node--section' : ''}`}
          draggable={!disabled && !!node.source}
          onDragStart={(e) => {
            e.dataTransfer.setData('text/plain', dragRef);
            e.dataTransfer.setData('application/json', JSON.stringify({
              type: 'var-ref',
              ref: dragRef,
              source: node.source,
              fieldName: node.fieldName,
              varName: node.varName,
            }));
            e.dataTransfer.effectAllowed = 'copy';
          }}
          onClick={() => {
            if (node.kind === 'section' || node.kind === 'all') {
              if (hasChildren) toggleExpand(node);
              return;
            }
            if (node.kind === 'index') {
              // Selectable (the item at [N]); not expandable on its own click.
              setSelection(nodePath);
            } else {
              setSelection(nodePath);
              if (hasChildren) toggleExpand(node);
            }
          }}
        >
          <span className="wvp-node__chevron" onClick={(e) => { e.stopPropagation(); if (hasChildren) toggleExpand(node); }}>
            {hasChildren ? (isOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />) : <span style={{ width: 11 }} />}
          </span>
          <span className="wvp-node__icon" style={{ color: node.kind === 'collection' || node.kind === 'all' ? '#ec4899' : node.kind === 'record' ? '#3b82f6' : node.kind === 'section' ? 'var(--sails-text-muted)' : 'var(--sails-text-muted)' }}>
            {iconOf(node.kind === 'index' ? 'number' : node.kind === 'collection' || node.kind === 'all' ? 'collection' : node.kind === 'record' ? 'record' : node.typeLabel)}
          </span>
          {node.kind === 'index' ? (
            <span className="wvp-node__label" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <code style={{ color: 'var(--sails-text-muted,#94a3b8)' }}>[</code>
              <input
                className="wvp-node__index"
                value={indexValues[node.indexKey || node.key] ?? ''}
                placeholder="N"
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setIndexValues((m) => ({ ...m, [node.indexKey || node.key]: e.target.value.replace(/[^0-9]/g, '') }))}
              />
              <code style={{ color: 'var(--sails-text-muted,#94a3b8)' }}>]</code>
            </span>
          ) : (
            <span className="wvp-node__label">{node.label}</span>
          )}
          <span className="wvp-node__type">{node.typeLabel}</span>
        </div>
        {isOpen && hasChildren && (
          <div className="wvp-node__children">
            {node.children!.map((child) => renderNode(child, nodePath))}
          </div>
        )}
      </div>
    );
  };

  const preview = selection ? refFrom(selection) : '';
  // Index nodes default to '0', so a selected path is always resolvable —
  // OK is enabled as soon as a node is selected.
  const isIndexPending = false;

  return (
    <div className="wvp" ref={anchorRef} style={{ position: 'relative' }}>
      {variant === 'control' ? (
        <div className="sails-input" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: 0, overflow: 'hidden' }}>
          {value ? (
            <span className="wvp-chip" title={value}>{value}</span>
          ) : (
            <span className="wvp-placeholder">{placeholder}</span>
          )}
          {value && (
            <button type="button" className="wvp-btn" title="Clear" disabled={disabled} onClick={() => onChange('')}>
              <X size={12} />
            </button>
          )}
          <button ref={triggerRef} type="button" className="wvp-btn" title="Pick variable" disabled={disabled} onClick={openPopup}>
            <MoreHorizontal size={14} />
          </button>
        </div>
      ) : (
        <button ref={triggerRef} type="button" className="sails-searchlist__trigger" title="Pick variable reference" disabled={disabled} onClick={openPopup}>
          <MoreHorizontal size={16} />
        </button>
      )}

      {open && popupPos && createPortal(
        <div
          ref={popupRef}
          className="ws-var-add-pop wvp-pop"
          style={{ position: 'fixed', top: popupPos.top, left: popupPos.left, width: 400, zIndex: 2147483000 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="wvp-head" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Braces size={12} /> Select Variable</span>
            {onAddVariable && (
              <button
                type="button"
                className="sails-btn sails-btn--ghost sails-btn--sm"
                style={{ marginLeft: 'auto', padding: '1px 8px' }}
                title="Add a new workflow variable"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => { e.stopPropagation(); setOpen(false); onAddVariable(triggerRef.current ?? undefined); }}
              >
                <Plus size={12} /> Add
              </button>
            )}
          </div>
          <div className="wvp-search">
            <Search size={11} />
            <input
              className="wvp-search-input"
              placeholder="Search fields & variables…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="wvp-tree">
            {tree.length === 0 ? (
              <p className="wvp-empty">No matches — try a different search.</p>
            ) : (
              tree.map((n) => renderNode(n, []))
            )}
          </div>
          <div className="wvp-preview">
            <span className="wvp-preview__label">Reference</span>
            <code className="wvp-preview__code">{preview || '—'}</code>
          </div>
          <div className="ws-var-add-pop__footer">
            {onExpression && (
              <button className="sails-btn sails-btn--ghost sails-btn--sm" title="Formulate a JSONata expression instead"
                onMouseDown={(e) => e.preventDefault()}
                onClick={openExpression}>
                <FunctionSquare size={12} /> Expression…
              </button>
            )}
            <button className="sails-btn sails-btn--ghost sails-btn--sm" onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen(false)}>Cancel</button>
            <button className="sails-btn sails-btn--primary sails-btn--sm" disabled={!preview}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(preview); setOpen(false); }}>
              OK
            </button>
          </div>
        </div>,
        document.body,
      )}

      {/* Expression editor modal (ƒ) */}
      {exprOpen && createPortal(
        <div className="ws-modal-overlay" style={{ zIndex: 2147483000 }} onClick={() => setExprOpen(false)}>
          <div className="ws-modal" style={{ width: 860 }} onClick={(e) => e.stopPropagation()}>
            <div className="ws-modal__header">
              <span className="ws-modal__icon" style={{ background: 'rgba(168,85,247,.12)', color: '#a855f7' }}><FunctionSquare size={16} /></span>
              <div className="ws-modal__titles">
                <span className="ws-modal__title">Expression — {format === 'jsonata' ? 'JSONata value' : 'Reference value'}</span>
                <span className="ws-modal__sub">Evaluate against workflow variables and the triggering record</span>
              </div>
              <button className="ws-icon-btn" onClick={() => setExprOpen(false)}><X size={15} /></button>
            </div>
            <div className="ws-modal__body">
              <ExpressionEditor
                showSnippets
                variables={exprVariables}
                recordSchemas={exprSchemas}
                value={exprDraft}
                onChange={setExprDraft}
                sample={exprSample}
              />
              <p className="ws-props-hint" style={{ paddingTop: 0 }}>
                Type <code>record.</code> for the triggering record's fields, or a collection name for its rows
                (<code>$sum(invoices.amount)</code>). Use <strong>Test</strong> to evaluate against sample values.
              </p>
            </div>
            <div className="ws-modal__footer">
              <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={() => setExprOpen(false)}>Cancel</button>
              <button className="sails-btn sails-btn--primary sails-btn--sm" disabled={!exprDraft.trim()}
                onClick={() => { onExpression?.(exprDraft.trim()); setExprOpen(false); }}>
                <CheckCircle2 size={14} /> Use Expression
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};

export default WorkflowVariablePicker;
