/**
 * variableTree — shared hierarchy builder for variable references.
 *
 * Used by the {{ autocomplete popup and the variable-aware text controls.
 * Builds the same tree shape as the WorkflowVariablePicker popup: top-level
 * workflow variables → record columns → nested models (targetModel drill) →
 * collection [N] index → item columns.
 */
import React from 'react';
import { Hash, Database, Layers, Type, Calendar, Clock, User, ToggleLeft } from 'lucide-react';
import type { PickerColumn, PickerVariable, PickerSchemaMap } from './WorkflowVariablePicker';

export type { PickerColumn, PickerVariable, PickerSchemaMap };

export interface TreeNode {
  key: string;
  label: string;
  typeLabel: string;
  kind: 'leaf' | 'record' | 'collection' | 'index' | 'all';
  seg: string;
  indexKey?: string; // for 'index' nodes — the collection name whose items this indexes
  children?: TreeNode[];
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  number: <Hash size={12} />, decimal: <Hash size={12} />,
  date: <Calendar size={12} />, datetime: <Calendar size={12} />, time: <Clock size={12} />,
  user: <User size={12} />, boolean: <ToggleLeft size={12} />,
  record: <Database size={12} />, collection: <Layers size={12} />, relation: <Database size={12} />,
};

const TYPE_LABEL: Record<string, string> = {
  number: 'Number', decimal: 'Number', date: 'Date', datetime: 'Date & Time', time: 'Time',
  user: 'User', boolean: 'Boolean', text: 'Text', long_text: 'Text',
  record: 'Record', collection: 'Collection', relation: 'Record',
};

export function iconOf(t?: string): React.ReactNode {
  return TYPE_ICON[t || 'text'] || <Type size={12} />;
}
export function typeLabelOf(t?: string): string {
  return TYPE_LABEL[t || 'text'] || t || 'Value';
}

/** Build column child nodes for a record's columns. */
export function colNodes(cols: PickerColumn[] | undefined, schemas: PickerSchemaMap): TreeNode[] | undefined {
  if (!cols || cols.length === 0) return undefined;
  return cols.map((c) => {
    const seg = c.fieldName;
    const t = c.logicalType || 'text';
    if (t === 'collection') {
      const itemCols = c.targetModel ? schemas[c.targetModel] : undefined;
      return {
        key: `col:${seg}`, label: c.label || seg, typeLabel: 'Collection', kind: 'collection', seg,
        children: [
          // "All items" — fields without an index → maps over every row
          // (JSONata `parent.collection.field`).
          {
            key: `col:${seg}:all`, label: 'All items', typeLabel: 'All', kind: 'all', seg: '',
            children: itemCols ? colNodes(itemCols, schemas) : undefined,
          },
          {
            key: `col:${seg}:idx`, label: '[N]', typeLabel: 'Number', kind: 'index', seg, indexKey: seg,
            children: itemCols ? colNodes(itemCols, schemas) : undefined,
          },
        ],
      };
    }
    if (t === 'relation' || t === 'lookup') {
      const childCols = c.targetModel ? schemas[c.targetModel] : undefined;
      return {
        key: `col:${seg}`, label: c.label || seg, typeLabel: 'Record', kind: 'record', seg,
        children: childCols ? colNodes(childCols, schemas) : undefined,
      };
    }
    return { key: `col:${seg}`, label: c.label || seg, typeLabel: typeLabelOf(t), kind: 'leaf', seg };
  });
}

/** Build the top-level tree from workflow variables. */
export function topNodes(vars: PickerVariable[], schemas: PickerSchemaMap): TreeNode[] {
  return vars.filter((v) => v.name).map((v) => {
    const t = v.fieldType || 'text';
    if (t === 'collection') {
      const itemCols = v.columns && v.columns.length > 0 ? v.columns : (v.targetModel ? schemas[v.targetModel] : undefined);
      return {
        key: `var:${v.name}`, label: v.name, typeLabel: 'Collection', kind: 'collection', seg: v.name,
        children: [
          // "All items" — fields without an index → maps over every row.
          {
            key: `var:${v.name}:all`, label: 'All items', typeLabel: 'All', kind: 'all', seg: '',
            children: itemCols ? colNodes(itemCols, schemas) : undefined,
          },
          {
            key: `var:${v.name}:idx`, label: '[N]', typeLabel: 'Number', kind: 'index', seg: v.name, indexKey: v.name,
            children: itemCols ? colNodes(itemCols, schemas) : undefined,
          },
        ],
      };
    }
    if (t === 'record') {
      return {
        key: `var:${v.name}`, label: v.name, typeLabel: 'Record', kind: 'record', seg: v.name,
        children: colNodes(v.columns, schemas),
      };
    }
    return { key: `var:${v.name}`, label: v.name, typeLabel: typeLabelOf(t), kind: 'leaf', seg: v.name };
  });
}

export function refFromSegs(segs: string[], format: 'moustache' | 'jsonata'): string {
  // "All items" nodes contribute an empty segment — drop it so the ref reads
  // `invoice_item.line_total` (all rows) instead of `invoice_item..line_total`.
  const joined = segs.filter(Boolean).join('.');
  return format === 'jsonata' ? joined : `{{${joined}}}`;
}

/**
 * Resolve the current autocomplete level from a typed query.
 * Query forms: `rec` (filter top vars), `invoice.` (drill), `invoices.0.`
 * (collection index → item columns), `record.` etc.
 */
export function resolveAutocompleteLevel(
  nodes: TreeNode[],
  query: string,
): { list: TreeNode[]; prefix: string; path: string[] } {
  const segs = query.split('.').filter(Boolean);
  if (segs.length === 0) return { list: nodes, prefix: '', path: [] };
  const prefix = query.endsWith('.') ? '' : segs[segs.length - 1];
  const path = query.endsWith('.') ? segs : segs.slice(0, -1);
  let list = nodes;
  for (const seg of path) {
    let match = list.find((n) => n.seg === seg);
    if (!match) {
      // Numeric segment into a collection's [N] index node.
      const idx = list.find((n) => n.kind === 'index');
      if (idx && /^\d+$/.test(seg)) match = idx;
    }
    if (!match) return { list: [], prefix, path };
    if (match.kind === 'collection') {
      // Drilling into a collection shows the ITEM FIELDS directly (maps over
      // all rows — `invoice_item.line_total`) plus the [N] index node.
      const all = match.children?.find((c) => c.kind === 'all');
      const idx = match.children?.find((c) => c.kind === 'index');
      list = [...(all?.children || []), ...(idx ? [idx] : [])];
    } else {
      list = match.children || [];
    }
  }
  return { list, prefix, path };
}

/** Segments for a picked node at the given level (index nodes use the typed number). */
export function segsForPicked(node: TreeNode, path: string[], prefix: string): string[] {
  if (node.kind === 'index') {
    const idx = /^\d+$/.test(prefix) ? prefix : '0';
    return [...path, idx];
  }
  return [...path, node.seg];
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Display label for a variable chip: `{{var}}` / `{{$expr}}` → `var` / `$expr`. */
export function chipLabel(ref: string): string {
  return ref.replace(/^\{\{/, '').replace(/\}\}$/, '');
}
