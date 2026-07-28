/**
 * Layout Studio — WYSIWYG Layout Designer
 *
 * Block types: field | related_list | tab_group
 * Each block is a plugin: it renders its own preview and has its own properties.
 *
 * Permission: requires SUPER_ADMIN or TENANT_ADMIN role.
 * TODO: refine when RBAC capability system supports 'layouts.design'
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  GripVertical, Plus, X, Eye, EyeOff, Trash2, MoveUp, MoveDown,
  LayoutGrid, Settings, ArrowRight, ListTree, FolderKanban, Columns,
  Table2, Filter, ShieldAlert, AlertCircle,
  ArrowLeft, Loader2, Play, Pause, Pin, PinOff,
} from 'lucide-react';
import type { SailsFieldDefinition } from '@sails/shared';
import { useAuth } from '../../contexts/AuthContext';
import Unauthorized from '../Unauthorized';
import './LayoutStudio.css';

// ─── Types ────────────────────────────────────────────────────

type Width = number;
type BlockType = 'field' | 'related_list' | 'tab_group';
type ConditionOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'empty' | 'not_empty';
type ValidationType = 'required' | 'cross_field' | 'regex' | 'range';

interface BlockCondition {
  id: string;
  fieldId: string;
  operator: ConditionOp;
  value: string;
  logic: 'and' | 'or';
}

interface FieldValidation {
  id: string;
  type: ValidationType;
  message: string;
  pattern?: string;
  min?: number;
  max?: number;
  dependentFieldId?: string;
  dependentOperator?: ConditionOp;
  dependentValue?: string;
}

interface PlacedBlock {
  id: string;
  blockType: BlockType;
  sectionId: string;
  position: number;
  width: Width;
  visible: boolean;
  fieldId?: string;
  labelOverride?: string;
  relatedTableId?: string;
  relatedDisplayFields?: string[];
  relatedMaxRows?: number;
  tabs?: { id: string; label: string; sectionIds: string[]; blocks: PlacedBlock[] }[];
  conditions?: BlockCondition[];
  validations?: FieldValidation[];
}

interface BuilderSection {
  id: string;
  title: string;
  columns: number;
}

interface DragPayload {
  type: 'palette' | 'placed';
  blockType?: BlockType;
  fieldId?: string;
  paletteId?: string;
  blockId?: string;
  sourceSectionId?: string;
  sourceTabBlockId?: string;
  sourceTabId?: string;
}

interface PaletteItem {
  id: string;
  blockType: BlockType;
  label: string;
  icon: React.ReactNode;
  fieldId?: string;
  description: string;
}

interface TableMeta {
  id: string;
  name: string;
  tableName: string;
  fields: SailsFieldDefinition[];
}

// ─── Helpers ──────────────────────────────────────────────────

let sectionCounter = 0;
function newSection(): BuilderSection {
  sectionCounter++;
  return { id: `sec_${Date.now()}_${sectionCounter}`, title: `Section ${sectionCounter}`, columns: 2 };
}
sectionCounter = 0;

let blockCounter = 0;
function blockId(): string { blockCounter++; return `blk_${Date.now()}_${blockCounter}`; }

function findBlockInArray(arr: PlacedBlock[], blockId: string): PlacedBlock | null {
  const top = arr.find((b) => b.id === blockId);
  if (top) return top;
  for (const blk of arr) {
    if (blk.blockType === 'tab_group' && blk.tabs) {
      for (const tab of blk.tabs) {
        const found = tab.blocks.find((tb) => tb.id === blockId);
        if (found) return found;
      }
    }
  }
  return null;
}

function defaultPropsForBlock(blockType: BlockType, fieldId?: string): Partial<PlacedBlock> {
  if (blockType === 'field') return { fieldId, labelOverride: '', width: 6 };
  if (blockType === 'related_list') return {
    relatedTableId: 't_tasks',
    relatedDisplayFields: ['title', 'status', 'due_date'],
    relatedMaxRows: 5,
    width: 12,
  };
  if (blockType === 'tab_group') return {
    tabs: [
      { id: 'tab1', label: 'Details', sectionIds: [], blocks: [] },
      { id: 'tab2', label: 'Activity', sectionIds: [], blocks: [] },
      { id: 'tab3', label: 'Files', sectionIds: [], blocks: [] },
    ],
    width: 12,
  };
  return {};
}

// ─── Mock related data ────────────────────────────────────────

const MOCK_RELATED_TASKS = [
  { title: 'Send proposal', status: 'Done', due_date: '2026-07-01' },
  { title: 'Schedule demo', status: 'In Progress', due_date: '2026-07-05' },
  { title: 'Contract review', status: 'Pending', due_date: '2026-07-15' },
];

const MOCK_RELATED_CONTACTS = [
  { name: 'Jane Doe', email: 'jane@acme.com', phone: '+66 81 234 5678' },
  { name: 'John Smith', email: 'john@acme.com', phone: '+66 89 876 5432' },
];

function buildMockRecord(fields: SailsFieldDefinition[]): Record<string, any> {
  const record: Record<string, any> = {};
  fields.forEach((f) => {
    switch (f.logicalType) {
      case 'text': record[f.fieldName] = 'Sample text'; break;
      case 'long_text': record[f.fieldName] = 'Lorem ipsum dolor sit amet.'; break;
      case 'email': record[f.fieldName] = 'user@example.com'; break;
      case 'phone': record[f.fieldName] = '+66 2 123 4567'; break;
      case 'currency': record[f.fieldName] = 250000; break;
      case 'number': record[f.fieldName] = 42; break;
      case 'date': record[f.fieldName] = '2026-07-28'; break;
      case 'select': {
        const opts = (f.config as any)?.options || [];
        record[f.fieldName] = opts[0]?.value ?? 'option_1';
        break;
      }
      case 'boolean': record[f.fieldName] = true; break;
      case 'url': record[f.fieldName] = 'https://example.com'; break;
      default: record[f.fieldName] = `Sample ${f.name}`; break;
    }
  });
  return record;
}

function renderFieldValue(field: SailsFieldDefinition, record: Record<string, any>): string {
  const val = record[field.fieldName];
  if (val === undefined || val === null) return '—';
  if (field.logicalType === 'currency') return `฿${val.toLocaleString()}`;
  if (field.logicalType === 'boolean') return val ? 'Yes' : 'No';
  if (field.logicalType === 'select') {
    const options = (field.config as any)?.options || [];
    return options.find((o: any) => o.value === val)?.label || String(val);
  }
  return String(val);
}

function buildPalette(fields: SailsFieldDefinition[], placedFieldIds: string[]): PaletteItem[] {
  const items: PaletteItem[] = [];
  fields.forEach((f) => {
    if (!placedFieldIds.includes(f.id)) {
      items.push({ id: `pf_${f.id}`, blockType: 'field', fieldId: f.id, label: f.name, icon: null, description: f.logicalType });
    }
  });
  items.push({ id: 'rel_tasks', blockType: 'related_list', label: 'Related Tasks', icon: <ListTree size={13} />, description: 'Inline child table' });
  items.push({ id: 'rel_contacts', blockType: 'related_list', label: 'Related Contacts', icon: <ListTree size={13} />, description: 'Inline child table' });
  items.push({ id: 'layout_tabs', blockType: 'tab_group', label: 'Tab Group', icon: <FolderKanban size={13} />, description: 'Tabbed container' });
  return items;
}

function evaluateCondition(cond: BlockCondition, record: Record<string, any>, fields: SailsFieldDefinition[]): boolean {
  const field = fields.find((f) => f.id === cond.fieldId);
  if (!field) return true;
  const val = record[field.fieldName];
  const compare = cond.value;

  switch (cond.operator) {
    case 'empty': return val === undefined || val === null || String(val).trim() === '';
    case 'not_empty': return val !== undefined && val !== null && String(val).trim() !== '';
    case 'eq': return String(val) === compare;
    case 'neq': return String(val) !== compare;
    case 'contains': return String(val || '').toLowerCase().includes((compare || '').toLowerCase());
    case 'gt': return Number(val) > Number(compare);
    case 'gte': return Number(val) >= Number(compare);
    case 'lt': return Number(val) < Number(compare);
    case 'lte': return Number(val) <= Number(compare);
    default: return true;
  }
}

function evaluateConditions(conditions: BlockCondition[] | undefined, record: Record<string, any>, fields: SailsFieldDefinition[]): boolean {
  if (!conditions || conditions.length === 0) return true;
  let result = evaluateCondition(conditions[0], record, fields);
  for (let i = 1; i < conditions.length; i++) {
    const next = evaluateCondition(conditions[i], record, fields);
    result = conditions[i].logic === 'or' ? (result || next) : (result && next);
  }
  return result;
}

// ─── Main Component ───────────────────────────────────────────

const LayoutStudio: React.FC = () => {
  const { tableId } = useParams<{ tableId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [tableMeta, setTableMeta] = useState<TableMeta | null>(null);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [sections, setSections] = useState<BuilderSection[]>([newSection()]);
  const [blocks, setBlocks] = useState<PlacedBlock[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [dragOverSection, setDragOverSection] = useState<string | null>(null);
  const [dragOverBlockId, setDragOverBlockId] = useState<string | null>(null);
  const [activeTabMap, setActiveTabMap] = useState<Record<string, number>>({});
  const [dragOverTabBlockId, setDragOverTabBlockId] = useState<string | null>(null);
  const [dragOverChildBlockId, setDragOverChildBlockId] = useState<string | null>(null);
  const [showProperties, setShowProperties] = useState(true);
  const [previewMode, setPreviewMode] = useState(false);
  const [propsPinned, setPropsPinned] = useState(true);
  const [propsWidth, setPropsWidth] = useState(260);
  const [propsResizing, setPropsResizing] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [mockRecord, setMockRecord] = useState<Record<string, any>>({});
  const [resizing, setResizing] = useState<{ blockId: string; startX: number; startSpan: number; sectionElement: HTMLElement | null } | null>(null);

  useEffect(() => {
    if (!tableId) { setFetchError('No table ID provided'); setFetchLoading(false); return; }
    const fetchTable = async () => {
      try {
        const res = await fetch('/api/metadata/objects');
        if (!res.ok) throw new Error('Failed to load objects');
        const data = await res.json();
        const tables: any[] = Array.isArray(data) ? data : (data.data || []);
        const found = tables.find((t: any) => t.id === tableId);
        if (!found) throw new Error('Table not found');
        setTableMeta({ id: found.id, name: found.name, tableName: found.tableName, fields: found.fields || [] });
        setMockRecord(buildMockRecord(found.fields || []));
      } catch (err: any) {
        setFetchError(err.message || 'Failed to load table metadata');
      } finally {
        setFetchLoading(false);
      }
    };
    fetchTable();
  }, [tableId]);

  const allFields = tableMeta?.fields ?? [];
  const placedFieldIds = blocks.filter((b) => b.blockType === 'field').map((b) => b.fieldId!).filter(Boolean);
  const palette = useMemo(() => buildPalette(allFields, placedFieldIds), [allFields, placedFieldIds]);
  const selectedBlock = useMemo(
    () => (selectedBlockId ? findBlockInArray(blocks, selectedBlockId) : null),
    [blocks, selectedBlockId],
  );
  const findBlockById = (blockId: string) => findBlockInArray(blocks, blockId);
  const selectedField = selectedBlock?.fieldId ? allFields.find((f) => f.id === selectedBlock.fieldId) : null;

  useEffect(() => {
    if (selectedBlockId && !findBlockInArray(blocks, selectedBlockId)) {
      setSelectedBlockId(null);
    }
  }, [blocks, selectedBlockId]);

  const blocksBySection = useMemo(() => {
    const map: Record<string, PlacedBlock[]> = {};
    sections.forEach((s) => { map[s.id] = []; });
    blocks.forEach((b) => {
      if (!map[b.sectionId]) map[b.sectionId] = [];
      map[b.sectionId].push(b);
    });
    Object.keys(map).forEach((k) => {
      map[k].sort((a, b) => a.position - b.position);
    });
    return map;
  }, [sections, blocks]);

  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: MouseEvent) => {
      if (!resizing) return;
      const grid = resizing.sectionElement;
      if (!grid) return;
      const colWidth = grid.offsetWidth / 12;
      const delta = e.clientX - resizing.startX;
      const colDelta = Math.round(delta / colWidth);
      const newSpan = Math.max(1, Math.min(12, resizing.startSpan + colDelta));
      updateBlock(resizing.blockId, { width: newSpan });
    };
    const onUp = () => setResizing(null);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [resizing]);

  useEffect(() => {
    if (!propsResizing) return;
    const onMove = (e: MouseEvent) => {
      const newWidth = Math.max(180, Math.min(500, window.innerWidth - e.clientX));
      setPropsWidth(newWidth);
    };
    const onUp = () => setPropsResizing(false);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [propsResizing]);

  const doReset = () => {
    setSections([newSection()]);
    setBlocks([]);
    setSelectedBlockId(null);
    setActiveTabMap({});
    setDragOverTabBlockId(null);
    setDragOverChildBlockId(null);
    setShowResetConfirm(false);
    sectionCounter = 0;
    blockCounter = 0;
  };

  const allowedRoles = ['SUPER_ADMIN', 'TENANT_ADMIN'];
  if (!allowedRoles.includes(user?.role || '')) {
    return <Unauthorized />;
  }

  if (fetchLoading) {
    return (
      <div className="ls-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 12 }}>
        <Loader2 size={24} style={{ animation: 'sails-spin 1s linear infinite' }} />
        <span style={{ color: 'var(--sails-text-muted)' }}>Loading model fields...</span>
      </div>
    );
  }

  if (fetchError || !tableMeta) {
    return (
      <div className="ls-root" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 12 }}>
        <AlertCircle size={32} style={{ color: 'var(--sails-danger)' }} />
        <span style={{ color: 'var(--sails-text-main)' }}>{fetchError || 'Table not found'}</span>
        <button className="sails-btn sails-btn--ghost" onClick={() => navigate(-1)}><ArrowLeft size={14} /> Go back</button>
      </div>
    );
  }

  // ── Actions ─────────────────────────────────────────────────

  const addSection = () => setSections((s) => [...s, newSection()]);

  const removeSection = (sectionId: string) => {
    setBlocks((b) => b.filter((blk) => blk.sectionId !== sectionId));
    setSections((s) => s.filter((sec) => sec.id !== sectionId));
    if (selectedBlock?.sectionId === sectionId) setSelectedBlockId(null);
  };

  const updateSection = (sectionId: string, patch: Partial<BuilderSection>) => {
    setSections((s) => s.map((sec) => (sec.id === sectionId ? { ...sec, ...patch } : sec)));
  };

  const addBlock = (item: PaletteItem, sectionId: string) => {
    const existing = blocks.filter((b) => b.sectionId === sectionId);
    const blk: PlacedBlock = {
      id: blockId(),
      blockType: item.blockType,
      sectionId,
      position: existing.length,
      width: 6,
      visible: true,
      ...defaultPropsForBlock(item.blockType, item.fieldId),
    };
    setBlocks((b) => [...b, blk]);
    setSelectedBlockId(blk.id);
  };

  const removeBlock = (blockId: string) => {
    setBlocks((prev) => {
      const topFiltered = prev.filter((blk) => blk.id !== blockId);
      if (topFiltered.length < prev.length) return topFiltered;
      return prev.map((blk) => {
        if (blk.blockType !== 'tab_group' || !blk.tabs) return blk;
        return {
          ...blk,
          tabs: blk.tabs.map((tab) => ({
            ...tab,
            blocks: tab.blocks.filter((tb) => tb.id !== blockId),
          })),
        };
      });
    });
    if (selectedBlockId === blockId) setSelectedBlockId(null);
  };

  const addBlockToTab = (tabGroupBlockId: string, tabId: string, item: PaletteItem) => {
    setBlocks((prev) =>
      prev.map((blk) => {
        if (blk.id !== tabGroupBlockId || !blk.tabs) return blk;
        return {
          ...blk,
          tabs: blk.tabs.map((tab) => {
            if (tab.id !== tabId) return tab;
            const newBlock: PlacedBlock = {
              id: blockId(),
              blockType: item.blockType,
              sectionId: '',
              position: tab.blocks.length,
              width: 6,
              visible: true,
              ...defaultPropsForBlock(item.blockType, item.fieldId),
            };
            return { ...tab, blocks: [...tab.blocks, newBlock] };
          }),
        };
      })
    );
  };

  const moveBlockInTab = (tabGroupBlockId: string, tabId: string, blockId: string, direction: 'up' | 'down') => {
    setBlocks((prev) =>
      prev.map((blk) => {
        if (blk.id !== tabGroupBlockId || !blk.tabs) return blk;
        return {
          ...blk,
          tabs: blk.tabs.map((tab) => {
            if (tab.id !== tabId) return tab;
            const list = [...tab.blocks];
            const idx = list.findIndex((b) => b.id === blockId);
            if (idx === -1) return tab;
            const otherIdx = direction === 'up' ? idx - 1 : idx + 1;
            if (otherIdx < 0 || otherIdx >= list.length) return tab;
            const updated = list.map((b, i) => {
              if (i === idx) return { ...b, position: otherIdx };
              if (i === otherIdx) return { ...b, position: idx };
              return b;
            });
            return { ...tab, blocks: updated };
          }),
        };
      })
    );
  };

  const moveBlockToTab = (blockId: string, tabGroupBlockId: string, tabId: string) => {
    setBlocks((prev) => {
      const sourceBlock = findBlockInArray(prev, blockId);
      if (!sourceBlock) return prev;

      const removed = prev
        .filter((blk) => blk.id !== blockId)
        .map((blk) => {
          if (blk.blockType !== 'tab_group' || !blk.tabs) return blk;
          return {
            ...blk,
            tabs: blk.tabs.map((tab) => ({
              ...tab,
              blocks: tab.blocks.filter((tb) => tb.id !== blockId),
            })),
          };
        });

      return removed.map((blk) => {
        if (blk.id !== tabGroupBlockId || !blk.tabs) return blk;
        return {
          ...blk,
          tabs: blk.tabs.map((tab) => {
            if (tab.id !== tabId) return tab;
            const placed: PlacedBlock = { ...sourceBlock, sectionId: '', position: tab.blocks.length };
            return { ...tab, blocks: [...tab.blocks, placed] };
          }),
        };
      });
    });
  };

  const moveBlockToSection = (blockId: string, targetSectionId: string) => {
    setBlocks((prev) => {
      const sourceBlock = findBlockInArray(prev, blockId);
      if (!sourceBlock) return prev;

      const existing = prev.filter((b) => b.sectionId === targetSectionId);
      const placed: PlacedBlock = { ...sourceBlock, sectionId: targetSectionId, position: existing.length };

      const mid = prev
        .filter((blk) => blk.id !== blockId)
        .map((blk) => {
          if (blk.blockType !== 'tab_group' || !blk.tabs) return blk;
          return {
            ...blk,
            tabs: blk.tabs.map((tab) => ({
              ...tab,
              blocks: tab.blocks.filter((tb) => tb.id !== blockId),
            })),
          };
        });

      return [...mid, placed];
    });
  };

  const moveBlockPosition = (blockId: string, sectionId: string, direction: 'up' | 'down') => {
    const list = [...(blocksBySection[sectionId] || [])];
    const idx = list.findIndex((b) => b.id === blockId);
    if (idx === -1) return;
    const otherIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (otherIdx < 0 || otherIdx >= list.length) return;
    const updated = blocks.map((blk) => {
      if (blk.id === list[idx].id) return { ...blk, position: otherIdx };
      if (blk.id === list[otherIdx].id) return { ...blk, position: idx };
      return blk;
    });
    setBlocks(updated);
  };

  const updateBlock = (blockId: string, patch: Partial<PlacedBlock>) => {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === blockId);
      if (idx !== -1) {
        return prev.map((b, i) => (i === idx ? { ...b, ...patch } : b));
      }
      return prev.map((blk) => {
        if (blk.blockType !== 'tab_group' || !blk.tabs) return blk;
        return {
          ...blk,
          tabs: blk.tabs.map((tab) => ({
            ...tab,
            blocks: tab.blocks.map((tb) => (tb.id === blockId ? { ...tb, ...patch } : tb)),
          })),
        };
      });
    });
  };

  const handleDragStart = (e: React.DragEvent, payload: DragPayload) => {
    if (previewMode) { e.preventDefault(); return; }
    e.dataTransfer.setData('application/json', JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetSectionId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverSection(null);
    setDragOverBlockId(null);
    setDragOverChildBlockId(null);
    try {
      const payload: DragPayload = JSON.parse(e.dataTransfer.getData('application/json'));

      if (dragOverTabBlockId && payload.type === 'palette') {
        const tabBlock = blocks.find((b) => b.id === dragOverTabBlockId);
        if (tabBlock?.tabs) {
          const activeIdx = activeTabMap[dragOverTabBlockId] ?? 0;
          const activeTab = tabBlock.tabs[activeIdx];
          if (activeTab) {
            const item = palette.find((p) => p.id === payload.paletteId);
            if (item && item.blockType !== 'tab_group') {
              addBlockToTab(dragOverTabBlockId, activeTab.id, item);
            }
          }
        }
        setDragOverTabBlockId(null);
        return;
      }

      if (dragOverTabBlockId && payload.type === 'placed' && payload.blockId && dragOverChildBlockId && payload.sourceTabBlockId === dragOverTabBlockId) {
        const tabBlock = blocks.find((b) => b.id === dragOverTabBlockId);
        if (tabBlock?.tabs) {
          const activeIdx = activeTabMap[dragOverTabBlockId] ?? 0;
          const activeTab = tabBlock.tabs[activeIdx];
          if (activeTab) {
            setBlocks((prev) =>
              prev.map((blk) => {
                if (blk.id !== dragOverTabBlockId || !blk.tabs) return blk;
                return {
                  ...blk,
                  tabs: blk.tabs.map((tab) => {
                    if (tab.id !== activeTab.id) return tab;
                    const list = [...tab.blocks];
                    const sourceIdx = list.findIndex((b) => b.id === payload.blockId);
                    const targetIdx = list.findIndex((b) => b.id === dragOverChildBlockId);
                    if (sourceIdx === -1 || targetIdx === -1) return tab;
                    const updated = list.map((b, i) => {
                      if (i === sourceIdx) return { ...b, position: targetIdx };
                      if (i === targetIdx) return { ...b, position: sourceIdx };
                      return b;
                    });
                    return { ...tab, blocks: updated };
                  }),
                };
              })
            );
          }
        }
        setDragOverTabBlockId(null);
        setDragOverChildBlockId(null);
        return;
      }

      if (dragOverTabBlockId && payload.type === 'placed' && payload.blockId) {
        const draggedBlock = findBlockById(payload.blockId);
        if (draggedBlock && draggedBlock.blockType !== 'tab_group') {
          const tabBlock = blocks.find((b) => b.id === dragOverTabBlockId);
          const activeIdx = activeTabMap[dragOverTabBlockId] ?? 0;
          const activeTab = tabBlock?.tabs?.[activeIdx];
          if (activeTab) {
            moveBlockToTab(payload.blockId, dragOverTabBlockId, activeTab.id);
          }
        }
        setDragOverTabBlockId(null);
        return;
      }

      if (payload.type === 'palette') {
        const item = palette.find((p) => p.id === payload.paletteId);
        if (item) addBlock(item, targetSectionId);
      } else if (payload.type === 'placed' && payload.blockId) {
        const draggedBlock = findBlockById(payload.blockId);
        if (!draggedBlock) return;

        if (payload.sourceTabBlockId) {
          if (dragOverBlockId) {
            setBlocks((prev) => {
              const mid = prev
                .filter((blk) => blk.id !== payload.blockId)
                .map((blk) => {
                  if (blk.blockType !== 'tab_group' || !blk.tabs) return blk;
                  return {
                    ...blk,
                    tabs: blk.tabs.map((tab) => ({
                      ...tab,
                      blocks: tab.blocks.filter((tb) => tb.id !== payload.blockId),
                    })),
                  };
                });
              const sectionBlocks = mid
                .filter((b) => b.sectionId === targetSectionId)
                .sort((a, b) => a.position - b.position);
              const targetIdx = sectionBlocks.findIndex((b) => b.id === dragOverBlockId);
              if (targetIdx === -1) return prev;
              const placed: PlacedBlock = { ...draggedBlock, sectionId: targetSectionId, position: targetIdx };
              return mid.map((blk) => {
                if (blk.sectionId !== targetSectionId) return blk;
                const pos = sectionBlocks.findIndex((b) => b.id === blk.id);
                if (pos >= targetIdx) return { ...blk, position: blk.position + 1 };
                return blk;
              }).concat(placed);
            });
          } else {
            moveBlockToSection(payload.blockId, targetSectionId);
          }
        } else if (targetSectionId === payload.sourceSectionId && dragOverBlockId) {
          const sectionBlocks = blocksBySection[targetSectionId] || [];
          const targetIdx = sectionBlocks.findIndex((b) => b.id === dragOverBlockId);
          if (targetIdx === -1) return;

          setBlocks((prev) => {
            const updated = prev.map((blk) => {
              if (blk.id === payload.blockId) return { ...blk, position: targetIdx };
              const sourceIdx = sectionBlocks.findIndex((b) => b.id === payload.blockId);
              if (sourceIdx < targetIdx) {
                const sectionPos = sectionBlocks.findIndex((b) => b.id === blk.id);
                if (blk.sectionId === targetSectionId && sectionPos > sourceIdx && sectionPos <= targetIdx) {
                  return { ...blk, position: blk.position - 1 };
                }
              } else if (sourceIdx > targetIdx) {
                const sectionPos = sectionBlocks.findIndex((b) => b.id === blk.id);
                if (blk.sectionId === targetSectionId && sectionPos >= targetIdx && sectionPos < sourceIdx) {
                  return { ...blk, position: blk.position + 1 };
                }
              }
              return blk;
            });
            return updated;
          });
        } else if (targetSectionId !== payload.sourceSectionId) {
          moveBlockToSection(payload.blockId, targetSectionId);
        }
      }
    } catch {}
  };

  const handleBlockDrop = (e: React.DragEvent, targetBlockId: string, sectionId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverBlockId(targetBlockId);
    setDragOverTabBlockId(null);
    setDragOverChildBlockId(null);
  };

  const handleResizeStart = (e: React.MouseEvent, blockId: string, currentSpan: number) => {
    e.preventDefault();
    e.stopPropagation();
    const grid = (e.currentTarget as HTMLElement).closest('.ls-section__grid') as HTMLElement;
    setResizing({ blockId, startX: e.clientX, startSpan: currentSpan, sectionElement: grid });
  };

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className={`ls-root ${previewMode ? 'ls-root--preview' : ''}`}>
      <div className="ls-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={() => navigate(-1)} title="Back">
            <ArrowLeft size={14} />
          </button>
          <span className="ls-toolbar__brand">Layout Studio</span>
          <span style={{ fontSize: 11, color: 'var(--sails-text-muted)' }}>— {tableMeta.name}</span>
        </div>
        <div className="ls-toolbar__actions">
          {previewMode ? (
            <button className="sails-btn sails-btn--primary sails-btn--sm" onClick={() => setPreviewMode(false)}>
              <Pause size={14} /> Exit Preview
            </button>
          ) : (
            <>
              <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={() => setPreviewMode(true)}>
                <Play size={14} /> Preview
              </button>
              <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={() => { setShowProperties(!showProperties); setPropsPinned(!showProperties); }}>
                <Settings size={14} /> {showProperties ? 'Hide' : 'Show'} Properties
              </button>
              <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={() => setShowResetConfirm(true)}>
                Reset
              </button>
              <button className="sails-btn sails-btn--primary sails-btn--sm">Save Layout</button>
            </>
          )}
        </div>
      </div>

      <div className="ls-body" style={previewMode ? { gridTemplateColumns: '1fr' } : undefined}>
        {/* ── LEFT: Palette ── */}
        {!previewMode && (
        <div className="ls-palette">
          <div className="ls-palette__header">
            <h3 className="ls-panel-title"><LayoutGrid size={13} /> Fields</h3>
            <span className="ls-palette__count">{palette.filter(p => p.blockType === 'field').length}</span>
          </div>
          <button className="sails-btn sails-btn--ghost sails-btn--sm ls-palette__add-section" onClick={addSection}>
            <Plus size={13} /> Add Section
          </button>
          <div className="ls-palette__fields">
            {palette.filter(p => p.blockType === 'field').length === 0 && palette.filter(p => p.blockType !== 'field').length === 0 ? (
              <p className="ls-empty">All blocks placed</p>
            ) : (
              <>
                {palette.some(p => p.blockType === 'field') && <div className="ls-palette__group-label">DATA FIELDS</div>}
                {palette.filter(p => p.blockType === 'field').map((item) => {
                  const fd = allFields.find((f) => f.id === item.fieldId);
                  return (
                    <div key={item.id} className="ls-palette-field" draggable
                      onDragStart={(e) => handleDragStart(e, { type: 'palette', blockType: item.blockType, fieldId: item.fieldId, paletteId: item.id })}
                      onClick={() => addBlock(item, sections[0]?.id || '')}>
                      <GripVertical size={12} /><span>{item.label}</span>
                      <span className="ls-type-tag">{fd?.logicalType}</span>
                      <ArrowRight size={12} className="ls-add-icon" />
                    </div>
                  );
                })}

                {palette.some(p => p.blockType === 'related_list') && <div className="ls-palette__group-label">RELATIONS</div>}
                {palette.filter(p => p.blockType === 'related_list').map((item) => (
                  <div key={item.id} className="ls-palette-field ls-palette-field--block" draggable
                    onDragStart={(e) => handleDragStart(e, { type: 'palette', blockType: item.blockType, paletteId: item.id })}
                    onClick={() => addBlock(item, sections[0]?.id || '')}>
                    <GripVertical size={12} />{item.icon}<span>{item.label}</span>
                    <span className="ls-type-tag">{item.description}</span>
                    <ArrowRight size={12} className="ls-add-icon" />
                  </div>
                ))}

                {palette.some(p => p.blockType === 'tab_group') && <div className="ls-palette__group-label">LAYOUT</div>}
                {palette.filter(p => p.blockType === 'tab_group').map((item) => (
                  <div key={item.id} className="ls-palette-field ls-palette-field--block" draggable
                    onDragStart={(e) => handleDragStart(e, { type: 'palette', blockType: item.blockType, paletteId: item.id })}
                    onClick={() => addBlock(item, sections[0]?.id || '')}>
                    <GripVertical size={12} />{item.icon}<span>{item.label}</span>
                    <span className="ls-type-tag">{item.description}</span>
                    <ArrowRight size={12} className="ls-add-icon" />
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
        )}

        {/* ── CENTER: Canvas ── */}
        <div className="ls-canvas">
          <div className="ls-canvas__scroll">
            <div className="ls-page">
              {/* ── Page Header ── */}
              <div className="ls-page__header">
                <h1 className="ls-page__title">{tableMeta.name} Detail</h1>
                <p className="ls-page__subtitle">Drag blocks from the palette to build your page layout</p>
              </div>

              {sections.map((section) => {
                const sectionBlocks = blocksBySection[section.id] || [];
                return (
                  <div key={section.id}
                    className={`ls-section ${dragOverSection === section.id ? 'ls-section--drag-over' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setDragOverSection(section.id); setDragOverBlockId(null); setDragOverTabBlockId(null); }}
                    onDrop={(e) => handleDrop(e, section.id)}>
                    <div className="ls-section__header">
                      <div className="ls-section__col-btn" title="12-column grid"><Columns size={13} /><span>12-col grid</span></div>
                      <input className="ls-section__title-input" value={section.title} onChange={(e) => updateSection(section.id, { title: e.target.value })} />
                      <button className="ls-section__remove" onClick={() => removeSection(section.id)} title="Delete section"><X size={14} /></button>
                    </div>
                    <div className="ls-section__grid">
                      {sectionBlocks.length === 0 ? (
                        <div className="ls-section__empty" style={{ gridColumn: '1 / -1' }}>Drop blocks here from the palette →</div>
                      ) : (
                        sectionBlocks.map((blk, idx) => {
                          const isSelected = selectedBlockId === blk.id;
                          const field = blk.fieldId ? allFields.find((f) => f.id === blk.fieldId) : null;
                          const total = sectionBlocks.length;

                          const controlsEl = (
                            <div className="ls-block__controls">
                              <button className="ls-block__btn" onClick={(e) => { e.stopPropagation(); moveBlockPosition(blk.id, section.id, 'up'); }} disabled={idx === 0}><MoveUp size={10} /></button>
                              <button className="ls-block__btn" onClick={(e) => { e.stopPropagation(); moveBlockPosition(blk.id, section.id, 'down'); }} disabled={idx === total - 1}><MoveDown size={10} /></button>
                              <button className="ls-block__btn" onClick={(e) => { e.stopPropagation(); updateBlock(blk.id, { visible: !blk.visible }); }}>{blk.visible ? <Eye size={10} /> : <EyeOff size={10} />}</button>
                              <button className="ls-block__btn ls-block__btn--danger" onClick={(e) => { e.stopPropagation(); removeBlock(blk.id); }}><Trash2 size={10} /></button>
                              <GripVertical size={12} className="ls-block__grip" />
                            </div>
                          );

                          // ── FIELD BLOCK ──
                          if (blk.blockType === 'field' && field) {
                            const condResult = evaluateConditions(blk.conditions, mockRecord, allFields);
                            const hasConditions = blk.conditions && blk.conditions.length > 0;
                            const hasValidations = blk.validations && blk.validations.length > 0;
                            const isConditionalHidden = hasConditions && !condResult;

                            return (
                              <div key={blk.id}
                                className={`ls-block ls-block--field ${isSelected ? 'ls-block--selected' : ''} ${!blk.visible ? 'ls-block--hidden' : ''} ${dragOverBlockId === blk.id ? 'ls-block--drag-over' : ''} ${isConditionalHidden ? 'ls-block--conditional-hidden' : ''} ${resizing?.blockId === blk.id ? 'ls-block--resizing' : ''}`}
                                style={{ gridColumn: `span ${blk.width}` }}
                                draggable onDragStart={(e) => handleDragStart(e, { type: 'placed', blockId: blk.id, sourceSectionId: section.id })}
                                onDragOver={(e) => handleBlockDrop(e, blk.id, section.id)}
                                onDragLeave={() => setDragOverBlockId(null)}
                                onClick={() => setSelectedBlockId(blk.id)}>
                                <div className="ls-block__indicators">
                                  {hasConditions && <span className="ls-indicator ls-indicator--cond" title="Has conditions"><Filter size={10} /></span>}
                                  {hasValidations && <span className="ls-indicator ls-indicator--val" title="Has validation"><ShieldAlert size={10} /></span>}
                                </div>
                                {controlsEl}
                                <label className="ls-block__label">{blk.labelOverride || field.name}{field.isRequired && <span className="ls-block__required">*</span>}</label>
                                <div className="ls-block__value">{blk.visible ? renderFieldValue(field, mockRecord) : <em>hidden</em>}</div>
                                <span className="ls-block__width-badge">{blk.width} cols</span>
                                <span className="ls-block__type-badge">{field.logicalType}</span>
                                <div className="ls-block__resize-handle" onMouseDown={(e) => handleResizeStart(e, blk.id, blk.width)} />
                              </div>
                            );
                          }

                          // ── RELATED LIST BLOCK ──
                          if (blk.blockType === 'related_list') {
                            const data = blk.relatedTableId === 't_tasks' ? MOCK_RELATED_TASKS : MOCK_RELATED_CONTACTS;
                            const cols = blk.relatedDisplayFields || ['title', 'status'];
                            return (
                              <div key={blk.id}
                                className={`ls-block ls-block--related ${isSelected ? 'ls-block--selected' : ''} ${!blk.visible ? 'ls-block--hidden' : ''} ${dragOverBlockId === blk.id ? 'ls-block--drag-over' : ''} ${resizing?.blockId === blk.id ? 'ls-block--resizing' : ''}`}
                                style={{ gridColumn: `span ${blk.width}` }}
                                draggable onDragStart={(e) => handleDragStart(e, { type: 'placed', blockId: blk.id, sourceSectionId: section.id })}
                                onDragOver={(e) => handleBlockDrop(e, blk.id, section.id)}
                                onDragLeave={() => setDragOverBlockId(null)}
                                onClick={() => setSelectedBlockId(blk.id)}>
                                {controlsEl}
                                <div className="ls-related__header">
                                  <Table2 size={14} />
                                  <span className="ls-related__title">{blk.relatedTableId === 't_tasks' ? 'Tasks' : 'Contacts'}</span>
                                  <span className="ls-related__count">{data.length} records</span>
                                </div>
                                <table className="ls-related__table">
                                  <thead><tr>{cols.map((c) => <th key={c}>{c.replace(/_/g, ' ')}</th>)}</tr></thead>
                                  <tbody>{data.map((row: any, ri) => <tr key={ri}>{cols.map((c) => <td key={c}>{row[c]}</td>)}</tr>)}</tbody>
                                </table>
                                <span className="ls-block__width-badge">{blk.width} cols</span>
                                <span className="ls-block__type-badge">relation</span>
                                <div className="ls-block__resize-handle" onMouseDown={(e) => handleResizeStart(e, blk.id, blk.width)} />
                              </div>
                            );
                          }

                          // ── TAB GROUP BLOCK ──
                          if (blk.blockType === 'tab_group') {
                            const tabs = blk.tabs || [];
                            const activeTabIdx = activeTabMap[blk.id] ?? 0;
                            const activeTab = tabs[activeTabIdx];
                            const activeBlocks = activeTab?.blocks || [];

                            return (
                              <div key={blk.id}
                                className={`ls-block ls-block--tabs ${isSelected ? 'ls-block--selected' : ''} ${!blk.visible ? 'ls-block--hidden' : ''} ${dragOverBlockId === blk.id ? 'ls-block--drag-over' : ''} ${resizing?.blockId === blk.id ? 'ls-block--resizing' : ''}`}
                                style={{ gridColumn: `span ${blk.width}` }}
                                onDragOver={(e) => { e.stopPropagation(); handleBlockDrop(e, blk.id, section.id); }}
                                onDragLeave={() => setDragOverBlockId(null)}
                                onClick={(e) => { e.stopPropagation(); setSelectedBlockId(blk.id); }}>
                                <div className="ls-block__controls">
                                  <button className="ls-block__btn" onClick={(e) => { e.stopPropagation(); moveBlockPosition(blk.id, section.id, 'up'); }} disabled={idx === 0}><MoveUp size={10} /></button>
                                  <button className="ls-block__btn" onClick={(e) => { e.stopPropagation(); moveBlockPosition(blk.id, section.id, 'down'); }} disabled={idx === total - 1}><MoveDown size={10} /></button>
                                  <button className="ls-block__btn" onClick={(e) => { e.stopPropagation(); updateBlock(blk.id, { visible: !blk.visible }); }}>{blk.visible ? <Eye size={10} /> : <EyeOff size={10} />}</button>
                                  <button className="ls-block__btn ls-block__btn--danger" onClick={(e) => { e.stopPropagation(); removeBlock(blk.id); }}><Trash2 size={10} /></button>
                                  <span className="ls-block__grip" draggable
                                    onDragStart={(e) => handleDragStart(e, { type: 'placed', blockId: blk.id, sourceSectionId: section.id })}>
                                    <GripVertical size={12} />
                                  </span>
                                </div>
                                <div className="ls-tabs__bar">
                                  {tabs.map((tab, ti) => (
                                    <div key={tab.id}
                                      className={`ls-tabs__tab ${ti === activeTabIdx ? 'ls-tabs__tab--active' : ''}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveTabMap((prev) => ({ ...prev, [blk.id]: ti }));
                                      }}>
                                      {tab.label}
                                      {tab.blocks.length > 0 && <span className="ls-tabs__count">{tab.blocks.length}</span>}
                                    </div>
                                  ))}
                                </div>
                                <div
                                  className={`ls-tabs__body ${dragOverTabBlockId === blk.id ? 'ls-tabs__body--drag-over' : ''}`}
                                  onDragOver={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setDragOverTabBlockId(blk.id);
                                    setDragOverBlockId(null);
                                    setDragOverChildBlockId(null);
                                  }}>
                                  {activeBlocks.length === 0 ? (
                                    <p className="ls-tabs__hint">Drop fields here from the palette</p>
                                  ) : (
                                    <div className="ls-section__grid">
                                      {activeBlocks.map((tb, tIdx) => {
                                        const tbField = tb.fieldId ? allFields.find((f) => f.id === tb.fieldId) : null;
                                        const tbSelected = selectedBlockId === tb.id;
                                        const tbTotal = activeBlocks.length;
                                        const tbControls = (
                                          <div className="ls-block__controls">
                                            <button className="ls-block__btn" onClick={(e) => { e.stopPropagation(); moveBlockInTab(blk.id, activeTab.id, tb.id, 'up'); }} disabled={tIdx === 0}><MoveUp size={10} /></button>
                                            <button className="ls-block__btn" onClick={(e) => { e.stopPropagation(); moveBlockInTab(blk.id, activeTab.id, tb.id, 'down'); }} disabled={tIdx === tbTotal - 1}><MoveDown size={10} /></button>
                                            <button className="ls-block__btn" onClick={(e) => { e.stopPropagation(); updateBlock(tb.id, { visible: !tb.visible }); }}>{tb.visible ? <Eye size={10} /> : <EyeOff size={10} />}</button>
                                            <button className="ls-block__btn ls-block__btn--danger" onClick={(e) => { e.stopPropagation(); removeBlock(tb.id); }}><Trash2 size={10} /></button>
                                            <GripVertical size={12} className="ls-block__grip" />
                                          </div>
                                        );

                                        if (tb.blockType === 'field' && tbField) {
                                          const condResult = evaluateConditions(tb.conditions, mockRecord, allFields);
                                          const hasConditions = tb.conditions && tb.conditions.length > 0;
                                          const hasValidations = tb.validations && tb.validations.length > 0;
                                          const isCondHidden = hasConditions && !condResult;
                                          const isDragOver = dragOverChildBlockId === tb.id;
                                          return (
                                            <div key={tb.id}
                                              className={`ls-block ls-block--field ${tbSelected ? 'ls-block--selected' : ''} ${!tb.visible ? 'ls-block--hidden' : ''} ${isCondHidden ? 'ls-block--conditional-hidden' : ''} ${isDragOver ? 'ls-block--drag-over' : ''}`}
                                              style={{ gridColumn: `span ${tb.width}` }}
                                              draggable
                                              onDragStart={(e) => handleDragStart(e, { type: 'placed', blockId: tb.id, sourceTabBlockId: blk.id, sourceTabId: activeTab.id })}
                                              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverChildBlockId(tb.id); }}
                                              onDragLeave={(e) => { e.stopPropagation(); setDragOverChildBlockId(null); }}
                                              onClick={(e) => { e.stopPropagation(); setSelectedBlockId(tb.id); }}>
                                              {tbControls}
                                              <div className="ls-block__indicators">
                                                {hasConditions && <span className="ls-indicator ls-indicator--cond"><Filter size={10} /></span>}
                                                {hasValidations && <span className="ls-indicator ls-indicator--val"><ShieldAlert size={10} /></span>}
                                              </div>
                                              <label className="ls-block__label">{tb.labelOverride || tbField.name}{tbField.isRequired && <span className="ls-block__required">*</span>}</label>
                                              <div className="ls-block__value">{tb.visible ? renderFieldValue(tbField, mockRecord) : <em>hidden</em>}</div>
                                              <span className="ls-block__width-badge">{tb.width} cols</span>
                                              <span className="ls-block__type-badge">{tbField.logicalType}</span>
                                              <div className="ls-block__resize-handle" onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(e, tb.id, tb.width); }} />
                                            </div>
                                          );
                                        }

                                        if (tb.blockType === 'related_list') {
                                          const data = tb.relatedTableId === 't_tasks' ? MOCK_RELATED_TASKS : MOCK_RELATED_CONTACTS;
                                          const cols = tb.relatedDisplayFields || ['title', 'status'];
                                          const isDragOver = dragOverChildBlockId === tb.id;
                                          return (
                                            <div key={tb.id}
                                              className={`ls-block ls-block--related ${tbSelected ? 'ls-block--selected' : ''} ${!tb.visible ? 'ls-block--hidden' : ''} ${isDragOver ? 'ls-block--drag-over' : ''}`}
                                              style={{ gridColumn: `span ${tb.width}` }}
                                              draggable
                                              onDragStart={(e) => handleDragStart(e, { type: 'placed', blockId: tb.id, sourceTabBlockId: blk.id, sourceTabId: activeTab.id })}
                                              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverChildBlockId(tb.id); }}
                                              onDragLeave={(e) => { e.stopPropagation(); setDragOverChildBlockId(null); }}
                                              onClick={(e) => { e.stopPropagation(); setSelectedBlockId(tb.id); }}>
                                              {tbControls}
                                              <div className="ls-related__header">
                                                <Table2 size={14} />
                                                <span className="ls-related__title">{tb.relatedTableId === 't_tasks' ? 'Tasks' : 'Contacts'}</span>
                                                <span className="ls-related__count">{data.length} records</span>
                                              </div>
                                              <table className="ls-related__table">
                                                <thead><tr>{cols.map((c) => <th key={c}>{c.replace(/_/g, ' ')}</th>)}</tr></thead>
                                                <tbody>{data.map((row: any, ri) => <tr key={ri}>{cols.map((c) => <td key={c}>{row[c]}</td>)}</tr>)}</tbody>
                                              </table>
                                              <span className="ls-block__width-badge">{tb.width} cols</span>
                                              <span className="ls-block__type-badge">relation</span>
                                              <div className="ls-block__resize-handle" onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(e, tb.id, tb.width); }} />
                                            </div>
                                          );
                                        }
                                        return null;
                                      })}
                                    </div>
                                  )}
                                </div>
                                <span className="ls-block__width-badge">{blk.width} cols</span>
                                <span className="ls-block__type-badge">tabs</span>
                                <div className="ls-block__resize-handle" onMouseDown={(e) => handleResizeStart(e, blk.id, blk.width)} />
                              </div>
                            );
                          }
                          return null;
                        })
                      )}
                    </div>
                  </div>
                );
              })}

              {sections.length === 0 && (
                <div className="ls-page__empty"><p>No sections yet. Click <strong>+ Add Section</strong>.</p></div>
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT: Properties ── */}
        {!previewMode && (
          <div
            className={`ls-props-outer ${propsPinned ? 'ls-props-outer--pinned' : ''} ${showProperties ? 'ls-props-outer--open' : ''}`}
            style={{ width: propsPinned || showProperties ? propsWidth : 36 }}
            onMouseEnter={() => { if (!propsPinned) setShowProperties(true); }}
            onMouseLeave={() => { if (!propsPinned) setShowProperties(false); }}
          >
            {showProperties && (
              <>
                <div className="ls-props-resize" onMouseDown={(e) => { e.preventDefault(); setPropsResizing(true); }} />
                <div className="ls-properties">
                  <div className="ls-props-header">
                    <h3 className="ls-panel-title"><Settings size={13} /> Properties</h3>
                    <button className="ls-block__btn" onClick={() => setPropsPinned(!propsPinned)} title={propsPinned ? 'Unpin panel' : 'Pin panel open'}>
                      {propsPinned ? <PinOff size={12} /> : <Pin size={12} />}
                    </button>
                  </div>
                  {selectedBlock ? (
                    <>
                <div className="ls-prop__name">
                  {selectedBlock.blockType === 'field' ? selectedField?.name :
                   selectedBlock.blockType === 'related_list' ? (selectedBlock.relatedTableId === 't_tasks' ? 'Related Tasks' : 'Related Contacts') :
                   'Tab Group'}
                </div>
                <div className="ls-prop__type">{selectedBlock.blockType}</div>

                <div className="ls-prop-group">
                  <label className="ls-prop-label">Width</label>
                  <span className="ls-prop-width-readout">{selectedBlock.width} / 12 columns</span>
                </div>

                <div className="ls-prop-group">
                  <label className="ls-prop-label">
                    <input type="checkbox" checked={selectedBlock.visible}
                      onChange={(e) => updateBlock(selectedBlock.id, { visible: e.target.checked })} />{' '}Visible
                  </label>
                </div>

                {selectedBlock.blockType === 'field' && (
                  <div className="ls-prop-group">
                    <label className="ls-prop-label">Label</label>
                    <input className="sails-input" value={selectedBlock.labelOverride || ''}
                      onChange={(e) => updateBlock(selectedBlock.id, { labelOverride: e.target.value })}
                      placeholder={selectedField?.name} style={{ fontSize: 12, padding: '6px 8px' }} />
                  </div>
                )}

                {selectedBlock.blockType === 'related_list' && (
                  <>
                    <div className="ls-prop-group">
                      <label className="ls-prop-label">Source Table</label>
                      <select className="sails-input" value={selectedBlock.relatedTableId}
                        onChange={(e) => updateBlock(selectedBlock.id, { relatedTableId: e.target.value })}
                        style={{ fontSize: 12, padding: '6px 8px' }}>
                        <option value="t_tasks">Tasks</option>
                        <option value="t_contacts">Contacts</option>
                      </select>
                    </div>
                    <div className="ls-prop-group">
                      <label className="ls-prop-label">Max Rows</label>
                      <input className="sails-input" type="number" value={selectedBlock.relatedMaxRows}
                        onChange={(e) => updateBlock(selectedBlock.id, { relatedMaxRows: Number(e.target.value) })}
                        style={{ fontSize: 12, padding: '6px 8px' }} />
                    </div>
                  </>
                )}

                {selectedBlock.blockType === 'tab_group' && (
                  <div className="ls-prop-group">
                    <label className="ls-prop-label">Tabs</label>
                    {(selectedBlock.tabs || []).map((tab, ti) => (
                      <div key={tab.id} style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                        <input className="sails-input" value={tab.label}
                          onChange={(e) => {
                            const tabs = [...(selectedBlock.tabs || [])];
                            tabs[ti] = { ...tabs[ti], label: e.target.value };
                            updateBlock(selectedBlock.id, { tabs });
                          }} style={{ fontSize: 12, padding: '4px 6px', flex: 1 }} />
                        <button className="ls-block__btn ls-block__btn--danger"
                          onClick={() => updateBlock(selectedBlock.id, { tabs: (selectedBlock.tabs || []).filter((_, i) => i !== ti) })}>
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                    <button className="sails-btn sails-btn--ghost sails-btn--sm"
                      onClick={() => {
                        const tabs = [...(selectedBlock.tabs || []), { id: `tab_${Date.now()}`, label: 'New Tab', sectionIds: [], blocks: [] }];
                        updateBlock(selectedBlock.id, { tabs });
                      }} style={{ marginTop: 4 }}>
                      <Plus size={12} /> Add Tab
                    </button>
                  </div>
                )}

                {/* ── Conditions (Show/Hide rules) ── */}
                <div className="ls-prop-group">
                  <div className="ls-prop-label" style={{ justifyContent: 'space-between' }}>
                    <span><Filter size={12} /> Conditions</span>
                    <button className="sails-btn sails-btn--ghost sails-btn--sm"
                      onClick={() => {
                        const conds = [...(selectedBlock.conditions || []), {
                          id: `cond_${Date.now()}`,
                          fieldId: allFields[0]?.id || '',
                          operator: 'eq' as ConditionOp,
                          value: '',
                          logic: 'and' as const,
                        }];
                        updateBlock(selectedBlock.id, { conditions: conds });
                      }}>
                      <Plus size={11} /> Add
                    </button>
                  </div>
                  {(selectedBlock.conditions || []).length === 0 ? (
                    <p style={{ fontSize: 11, color: 'var(--sails-text-muted)', fontStyle: 'italic', margin: 0 }}>
                      No conditions. Block always visible.
                    </p>
                  ) : (
                    (selectedBlock.conditions || []).map((cond, ci) => (
                      <div key={cond.id} className="ls-cond-card">
                        {ci > 0 && (
                          <div style={{ display: 'flex', gap: 2, marginBottom: 4 }}>
                            {(['and', 'or'] as const).map((l) => (
                              <button key={l}
                                className={`ls-cond-logic-btn ${cond.logic === l ? 'ls-cond-logic-btn--active' : ''}`}
                                onClick={() => {
                                  const conds = [...(selectedBlock.conditions || [])];
                                  conds[ci] = { ...conds[ci], logic: l };
                                  updateBlock(selectedBlock.id, { conditions: conds });
                                }}>
                                {l.toUpperCase()}
                              </button>
                            ))}
                          </div>
                        )}
                        <div className="ls-cond-body">
                          <select className="sails-input" value={cond.fieldId}
                            onChange={(e) => {
                              const conds = [...(selectedBlock.conditions || [])];
                              conds[ci] = { ...conds[ci], fieldId: e.target.value };
                              updateBlock(selectedBlock.id, { conditions: conds });
                            }} style={{ fontSize: 10, padding: '3px 4px', flex: 1 }}>
                            {allFields.map((f) => (
                              <option key={f.id} value={f.id}>{f.name}</option>
                            ))}
                          </select>
                          <select className="sails-input" value={cond.operator}
                            onChange={(e) => {
                              const conds = [...(selectedBlock.conditions || [])];
                              conds[ci] = { ...conds[ci], operator: e.target.value as ConditionOp };
                              updateBlock(selectedBlock.id, { conditions: conds });
                            }} style={{ fontSize: 10, padding: '3px 4px', width: 70 }}>
                            <option value="eq">=</option>
                            <option value="neq">≠</option>
                            <option value="gt">&gt;</option>
                            <option value="gte">≥</option>
                            <option value="lt">&lt;</option>
                            <option value="lte">≤</option>
                            <option value="contains">contains</option>
                            <option value="empty">is empty</option>
                            <option value="not_empty">not empty</option>
                          </select>
                          {!['empty', 'not_empty'].includes(cond.operator) && (
                            <input className="sails-input" value={cond.value}
                              onChange={(e) => {
                                const conds = [...(selectedBlock.conditions || [])];
                                conds[ci] = { ...conds[ci], value: e.target.value };
                                updateBlock(selectedBlock.id, { conditions: conds });
                              }} placeholder="value" style={{ fontSize: 10, padding: '3px 4px', width: 70 }} />
                          )}
                          <button className="ls-block__btn ls-block__btn--danger"
                            onClick={() => {
                              updateBlock(selectedBlock.id, {
                                conditions: (selectedBlock.conditions || []).filter((_, i) => i !== ci)
                              });
                            }}><X size={11} /></button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* ── Validation Rules ── */}
                {selectedBlock.blockType === 'field' && (
                  <div className="ls-prop-group">
                    <div className="ls-prop-label" style={{ justifyContent: 'space-between' }}>
                      <span><ShieldAlert size={12} /> Validation</span>
                      <button className="sails-btn sails-btn--ghost sails-btn--sm"
                        onClick={() => {
                          const vals = [...(selectedBlock.validations || []), {
                            id: `val_${Date.now()}`,
                            type: 'required' as ValidationType,
                            message: 'This field is required',
                          }];
                          updateBlock(selectedBlock.id, { validations: vals });
                        }}>
                        <Plus size={11} /> Add
                      </button>
                    </div>
                    {(selectedBlock.validations || []).length === 0 ? (
                      <p style={{ fontSize: 11, color: 'var(--sails-text-muted)', fontStyle: 'italic', margin: 0 }}>
                        No validation rules.
                      </p>
                    ) : (
                      (selectedBlock.validations || []).map((val, vi) => (
                        <div key={val.id} className="ls-cond-card">
                          <div className="ls-cond-body" style={{ flexWrap: 'wrap' }}>
                            <select className="sails-input" value={val.type}
                              onChange={(e) => {
                                const vals = [...(selectedBlock.validations || [])];
                                vals[vi] = { ...vals[vi], type: e.target.value as ValidationType };
                                updateBlock(selectedBlock.id, { validations: vals });
                              }} style={{ fontSize: 10, padding: '3px 4px', flex: 1, minWidth: 80 }}>
                              <option value="required">Required</option>
                              <option value="cross_field">Cross-Field</option>
                              <option value="regex">Regex Pattern</option>
                              <option value="range">Min / Max</option>
                            </select>
                            <button className="ls-block__btn ls-block__btn--danger"
                              onClick={() => {
                                updateBlock(selectedBlock.id, {
                                  validations: (selectedBlock.validations || []).filter((_, i) => i !== vi)
                                });
                              }}><X size={11} /></button>
                          </div>

                          {val.type === 'cross_field' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4 }}>
                              <select className="sails-input" value={val.dependentFieldId || ''}
                                onChange={(e) => {
                                  const vals = [...(selectedBlock.validations || [])];
                                  vals[vi] = { ...vals[vi], dependentFieldId: e.target.value };
                                  updateBlock(selectedBlock.id, { validations: vals });
                                }} style={{ fontSize: 10, padding: '3px 4px' }}>
                                <option value="">— depends on field —</option>
                                {allFields.filter((f) => f.id !== selectedBlock.fieldId).map((f) => (
                                  <option key={f.id} value={f.id}>{f.name}</option>
                                ))}
                              </select>
                              <div style={{ display: 'flex', gap: 3 }}>
                                <select className="sails-input" value={val.dependentOperator || 'eq'}
                                  onChange={(e) => {
                                    const vals = [...(selectedBlock.validations || [])];
                                    vals[vi] = { ...vals[vi], dependentOperator: e.target.value as ConditionOp };
                                    updateBlock(selectedBlock.id, { validations: vals });
                                  }} style={{ fontSize: 10, padding: '3px 4px', flex: 1 }}>
                                  <option value="eq">=</option>
                                  <option value="neq">≠</option>
                                  <option value="gt">&gt;</option>
                                  <option value="lt">&lt;</option>
                                </select>
                                <input className="sails-input" value={val.dependentValue || ''}
                                  onChange={(e) => {
                                    const vals = [...(selectedBlock.validations || [])];
                                    vals[vi] = { ...vals[vi], dependentValue: e.target.value };
                                    updateBlock(selectedBlock.id, { validations: vals });
                                  }} placeholder="value" style={{ fontSize: 10, padding: '3px 4px', flex: 1 }} />
                              </div>
                            </div>
                          )}

                          {val.type === 'regex' && (
                            <input className="sails-input" value={val.pattern || ''}
                              onChange={(e) => {
                                const vals = [...(selectedBlock.validations || [])];
                                vals[vi] = { ...vals[vi], pattern: e.target.value };
                                updateBlock(selectedBlock.id, { validations: vals });
                              }} placeholder="e.g. ^[A-Z]{3}-\d{4}$" style={{ fontSize: 10, padding: '3px 4px', marginTop: 4 }} />
                          )}

                          {val.type === 'range' && (
                            <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
                              <input className="sails-input" type="number" value={val.min ?? ''}
                                onChange={(e) => {
                                  const vals = [...(selectedBlock.validations || [])];
                                  vals[vi] = { ...vals[vi], min: e.target.value ? Number(e.target.value) : undefined };
                                  updateBlock(selectedBlock.id, { validations: vals });
                                }} placeholder="Min" style={{ fontSize: 10, padding: '3px 4px', flex: 1 }} />
                              <input className="sails-input" type="number" value={val.max ?? ''}
                                onChange={(e) => {
                                  const vals = [...(selectedBlock.validations || [])];
                                  vals[vi] = { ...vals[vi], max: e.target.value ? Number(e.target.value) : undefined };
                                  updateBlock(selectedBlock.id, { validations: vals });
                                }} placeholder="Max" style={{ fontSize: 10, padding: '3px 4px', flex: 1 }} />
                            </div>
                          )}

                          <input className="sails-input" value={val.message}
                            onChange={(e) => {
                              const vals = [...(selectedBlock.validations || [])];
                              vals[vi] = { ...vals[vi], message: e.target.value };
                              updateBlock(selectedBlock.id, { validations: vals });
                            }} placeholder="Error message" style={{ fontSize: 10, padding: '3px 4px', marginTop: 4 }} />
                        </div>
                      ))
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="ls-empty">Select a block to edit its properties</p>
            )}
          </div>
              </>
            )}
            {!showProperties && (
              <div className="ls-props-tab" onClick={() => { setShowProperties(true); setPropsPinned(true); }}>
                <Settings size={14} />
              </div>
            )}
          </div>
        )}
      </div>
      {showResetConfirm && (
        <div className="ls-modal-overlay" onClick={() => setShowResetConfirm(false)}>
          <div className="ls-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="ls-modal__title">Reset Layout</h3>
            <p className="ls-modal__text">This will clear all sections, blocks, and tab configurations. This action cannot be undone.</p>
            <div className="ls-modal__actions">
              <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={() => setShowResetConfirm(false)}>Cancel</button>
              <button className="sails-btn sails-btn--danger sails-btn--sm" onClick={doReset}>Reset</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LayoutStudio;
