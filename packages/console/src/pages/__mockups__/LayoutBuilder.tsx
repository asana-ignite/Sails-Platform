/**
 * MOCK UP — WYSIWYG Layout Builder with Pluggable Blocks
 *
 * Block types: field | related_list | tab_group
 * Each block is a plugin: it renders its own preview and has its own properties.
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  GripVertical, Plus, X, Eye, EyeOff, Trash2, MoveUp, MoveDown,
  LayoutGrid, Settings, ArrowRight, ListTree, FolderKanban, Columns,
  Table2, Filter, ShieldAlert, AlertCircle,
  Play, Pause, Minimize2, Maximize2,
} from 'lucide-react';
import type { SailsFieldDefinition } from '@sails/shared';
import { MOCK_LEADS_FIELDS } from './sample-layout-data';
import './LayoutBuilder.css';

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
  logic: 'and' | 'or'; // for chaining
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

// ─── Mock data ────────────────────────────────────────────────

const MOCK_RELATED_TASKS = [
  { title: 'Send proposal', status: 'Done', due_date: '2026-07-01' },
  { title: 'Schedule demo', status: 'In Progress', due_date: '2026-07-05' },
  { title: 'Contract review', status: 'Pending', due_date: '2026-07-15' },
];

const MOCK_RELATED_CONTACTS = [
  { name: 'Jane Doe', email: 'jane@acme.com', phone: '+66 81 234 5678' },
  { name: 'John Smith', email: 'john@acme.com', phone: '+66 89 876 5432' },
];

function renderFieldValue(field: SailsFieldDefinition, record: Record<string, any>): string {
  const val = record[field.fieldName];
  if (val === undefined || val === null) return '—';
  if (field.logicalType === 'currency') return `฿${val.toLocaleString()}`;
  if (field.logicalType === 'select') {
    const options = (field.config as any)?.options || [];
    return options.find((o: any) => o.value === val)?.label || val;
  }
  return String(val);
}

function buildPalette(placedFieldIds: string[]): PaletteItem[] {
  const items: PaletteItem[] = [];
  MOCK_LEADS_FIELDS.forEach((f) => {
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

export const LayoutBuilder: React.FC = () => {
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
  const [propsFloating, setPropsFloating] = useState(false);
  const [propsWidth, setPropsWidth] = useState(260);
  const [propsResizing, setPropsResizing] = useState(false);
  const [paletteFloating, setPaletteFloating] = useState(false);
  const [paletteWidth, setPaletteWidth] = useState(220);
  const [paletteResizing, setPaletteResizing] = useState(false);
  const [paletteVisible, setPaletteVisible] = useState(true);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [mockRecord, setMockRecord] = useState<Record<string, any>>({
    lead_name: 'ACME Corp Deal', company: 'ACME Corporation',
    email: 'j.doe@acme.com', phone: '+66 2 123 4567',
    status: 'qualified', source: 'website', budget: 250000,
    contact_date: '2026-06-15',
    notes: 'Met at Tech Summit. Interested in Enterprise plan. Follow up Q3.',
    assigned_to: 'Somsak Chaiyaporn',
  });
  const [resizing, setResizing] = useState<{ blockId: string; startX: number; startSpan: number; sectionElement: HTMLElement | null } | null>(null);

  const allFields = MOCK_LEADS_FIELDS;
  const placedFieldIds = blocks.filter((b) => b.blockType === 'field').map((b) => b.fieldId!).filter(Boolean);
  const palette = buildPalette(placedFieldIds);
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
          // Block came from a tab — move to section
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
          // Same section swap — move to target position
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
    const grid = (e.currentTarget as HTMLElement).closest('.wys-section__grid') as HTMLElement;
    setResizing({ blockId, startX: e.clientX, startSpan: currentSpan, sectionElement: grid });
  };

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

  useEffect(() => {
    if (!paletteResizing) return;
    const onMove = (e: MouseEvent) => {
      const newWidth = Math.max(160, Math.min(400, e.clientX + 4));
      setPaletteWidth(newWidth);
    };
    const onUp = () => setPaletteResizing(false);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [paletteResizing]);

  const doReset = () => {
    setSections([newSection()]);
    setBlocks([]);
    setSelectedBlockId(null);
    setActiveTabMap({});
    setDragOverTabBlockId(null);
    setDragOverChildBlockId(null);
    setPropsFloating(false);
    setPaletteFloating(false);
    setShowResetConfirm(false);
    sectionCounter = 0;
    blockCounter = 0;
  };

  // ── Render ─────────────────────────────────────────────────

  return (
      <div className={`wys-root ${previewMode ? 'wys-root--preview' : ''}`}>
      <div className="wys-toolbar">
        <span className="wys-toolbar__brand">Page Layout Builder</span>
        <div className="wys-toolbar__actions">
          {previewMode ? (
            <button className="sails-btn sails-btn--primary sails-btn--sm" onClick={() => setPreviewMode(false)}>
              <Pause size={14} /> Exit Preview
            </button>
          ) : (
            <>
              <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={() => setPreviewMode(true)}>
                <Play size={14} /> Preview
              </button>
              <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={() => setShowResetConfirm(true)}>
                Reset
              </button>
              <button className="sails-btn sails-btn--primary sails-btn--sm">Save Layout</button>
            </>
          )}
        </div>
      </div>

      <div className="wys-body" style={{ gridTemplateColumns: (() => {
        if (previewMode) return '1fr';
        const pw = showProperties ? propsWidth : 36;
        const lw = paletteFloating ? 0 : paletteWidth;
        const leftCol = paletteFloating ? '' : `${lw}px `;
        const rightCol = propsFloating ? '' : ` ${pw}px`;
        return `${leftCol}1fr${rightCol}`;
      })() }}>
        {/* ── LEFT: Palette ── */}
        {!previewMode && (
        <div className={`wys-palette-outer ${paletteFloating ? 'wys-palette-outer--floating' : ''} ${paletteVisible ? 'wys-palette-outer--open' : ''}`}
          style={{ width: paletteFloating ? (paletteVisible ? paletteWidth : 36) : '100%' }}
          onMouseEnter={() => { if (paletteFloating) setPaletteVisible(true); }}
          onMouseLeave={() => { if (paletteFloating) setPaletteVisible(false); }}
        >
          {paletteVisible && (
            <>
          <div className="wys-palette-resize" onMouseDown={(e) => { e.preventDefault(); setPaletteResizing(true); }} />
          <div className="wys-palette">
          <div className="wys-palette__header">
            <h3 className="wys-panel-title"><LayoutGrid size={13} /> Blocks</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="wys-palette__count">{palette.length}</span>
              <button className="wys-block__btn" onClick={() => setPaletteFloating(!paletteFloating)} title={paletteFloating ? 'Dock palette' : 'Float palette'}>
                {paletteFloating ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
              </button>
            </div>
          </div>
          <button className="sails-btn sails-btn--ghost sails-btn--sm wys-palette__add-section" onClick={addSection}>
            <Plus size={13} /> Add Section
          </button>
          <div className="wys-palette__fields">
            {palette.length === 0 ? (
              <p className="wys-empty">All blocks placed</p>
            ) : (
              <>
                {palette.some(p => p.blockType === 'field') && <div className="wys-palette__group-label">DATA FIELDS</div>}
                {palette.filter(p => p.blockType === 'field').map((item) => {
                  const fd = allFields.find((f) => f.id === item.fieldId);
                  return (
                    <div key={item.id} className="wys-palette-field" draggable
                      onDragStart={(e) => handleDragStart(e, { type: 'palette', blockType: item.blockType, fieldId: item.fieldId, paletteId: item.id })}
                      onClick={() => addBlock(item, sections[0]?.id || '')}>
                      <GripVertical size={12} /><span>{item.label}</span>
                      <span className="wys-type-tag">{fd?.logicalType}</span>
                      <ArrowRight size={12} className="wys-add-icon" />
                    </div>
                  );
                })}

                {palette.some(p => p.blockType === 'related_list') && <div className="wys-palette__group-label">RELATIONS</div>}
                {palette.filter(p => p.blockType === 'related_list').map((item) => (
                  <div key={item.id} className="wys-palette-field wys-palette-field--block" draggable
                    onDragStart={(e) => handleDragStart(e, { type: 'palette', blockType: item.blockType, paletteId: item.id })}
                    onClick={() => addBlock(item, sections[0]?.id || '')}>
                    <GripVertical size={12} />{item.icon}<span>{item.label}</span>
                    <span className="wys-type-tag">{item.description}</span>
                    <ArrowRight size={12} className="wys-add-icon" />
                  </div>
                ))}

                {palette.some(p => p.blockType === 'tab_group') && <div className="wys-palette__group-label">LAYOUT</div>}
                {palette.filter(p => p.blockType === 'tab_group').map((item) => (
                  <div key={item.id} className="wys-palette-field wys-palette-field--block" draggable
                    onDragStart={(e) => handleDragStart(e, { type: 'palette', blockType: item.blockType, paletteId: item.id })}
                    onClick={() => addBlock(item, sections[0]?.id || '')}>
                    <GripVertical size={12} />{item.icon}<span>{item.label}</span>
                    <span className="wys-type-tag">{item.description}</span>
                    <ArrowRight size={12} className="wys-add-icon" />
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
            </>
          )}
          {!paletteVisible && (
            <div className="wys-palette-tab" onClick={() => setPaletteVisible(true)}>
              <LayoutGrid size={14} />
            </div>
          )}
          </div>
        )}

        {/* ── CENTER: WYSIWYG Canvas ── */}
        <div className="wys-canvas">
          <div className="wys-canvas__scroll">
            <div className="wys-page">
              {/* ── Page Header ── */}
              <div className="wys-page__header">
                <h1 className="wys-page__title">{mockRecord.lead_name}</h1>
                <p className="wys-page__subtitle">Drag blocks from the palette to build your page layout</p>
              </div>

              {sections.map((section) => {
                const sectionBlocks = blocksBySection[section.id] || [];
                return (
                  <div key={section.id}
                    className={`wys-section ${dragOverSection === section.id ? 'wys-section--drag-over' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setDragOverSection(section.id); setDragOverBlockId(null); setDragOverTabBlockId(null); }}
                    onDrop={(e) => handleDrop(e, section.id)}>
                    <div className="wys-section__header">
                      <div className="wys-section__col-btn" title="12-column grid"><Columns size={13} /><span>12-col grid</span></div>
                      <input className="wys-section__title-input" value={section.title} onChange={(e) => updateSection(section.id, { title: e.target.value })} />
                      <button className="wys-section__remove" onClick={() => removeSection(section.id)} title="Delete section"><X size={14} /></button>
                    </div>
                    <div className="wys-section__grid">
                      {sectionBlocks.length === 0 ? (
                        <div className="wys-section__empty" style={{ gridColumn: '1 / -1' }}>Drop blocks here from the palette →</div>
                      ) : (
                        sectionBlocks.map((blk, idx) => {
                          const isSelected = selectedBlockId === blk.id;
                          const field = blk.fieldId ? allFields.find((f) => f.id === blk.fieldId) : null;
                          const total = sectionBlocks.length;

                          const controlsEl = (
                            <div className="wys-block__controls">
                              <button className="wys-block__btn" onClick={(e) => { e.stopPropagation(); moveBlockPosition(blk.id, section.id, 'up'); }} disabled={idx === 0}><MoveUp size={10} /></button>
                              <button className="wys-block__btn" onClick={(e) => { e.stopPropagation(); moveBlockPosition(blk.id, section.id, 'down'); }} disabled={idx === total - 1}><MoveDown size={10} /></button>
                              <button className="wys-block__btn" onClick={(e) => { e.stopPropagation(); updateBlock(blk.id, { visible: !blk.visible }); }}>{blk.visible ? <Eye size={10} /> : <EyeOff size={10} />}</button>
                              <button className="wys-block__btn wys-block__btn--danger" onClick={(e) => { e.stopPropagation(); removeBlock(blk.id); }}><Trash2 size={10} /></button>
                              <GripVertical size={12} className="wys-block__grip" />
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
                                className={`wys-block wys-block--field ${isSelected ? 'wys-block--selected' : ''} ${!blk.visible ? 'wys-block--hidden' : ''} ${dragOverBlockId === blk.id ? 'wys-block--drag-over' : ''} ${isConditionalHidden ? 'wys-block--conditional-hidden' : ''} ${resizing?.blockId === blk.id ? 'wys-block--resizing' : ''}`}
                                style={{ gridColumn: `span ${blk.width}` }}
                                draggable onDragStart={(e) => handleDragStart(e, { type: 'placed', blockId: blk.id, sourceSectionId: section.id })}
                                onDragOver={(e) => handleBlockDrop(e, blk.id, section.id)}
                                onDragLeave={() => setDragOverBlockId(null)}
                                onClick={() => setSelectedBlockId(blk.id)}>
                                <div className="wys-block__indicators">
                                  {hasConditions && <span className="wys-indicator wys-indicator--cond" title="Has conditions"><Filter size={10} /></span>}
                                  {hasValidations && <span className="wys-indicator wys-indicator--val" title="Has validation"><ShieldAlert size={10} /></span>}
                                </div>
                                {controlsEl}
                                <label className="wys-block__label">{blk.labelOverride || field.name}{field.isRequired && <span className="wys-block__required">*</span>}</label>
                                <div className="wys-block__value">{blk.visible ? renderFieldValue(field, mockRecord) : <em>hidden</em>}</div>
                                <span className="wys-block__width-badge">{blk.width} cols</span>
                                <span className="wys-block__type-badge">{field.logicalType}</span>
                                <div className="wys-block__resize-handle" onMouseDown={(e) => handleResizeStart(e, blk.id, blk.width)} />
                              </div>
                            );
                          }

                          // ── RELATED LIST BLOCK ──
                          if (blk.blockType === 'related_list') {
                            const data = blk.relatedTableId === 't_tasks' ? MOCK_RELATED_TASKS : MOCK_RELATED_CONTACTS;
                            const cols = blk.relatedDisplayFields || ['title', 'status'];
                            return (
                              <div key={blk.id}
                                className={`wys-block wys-block--related ${isSelected ? 'wys-block--selected' : ''} ${!blk.visible ? 'wys-block--hidden' : ''} ${dragOverBlockId === blk.id ? 'wys-block--drag-over' : ''} ${resizing?.blockId === blk.id ? 'wys-block--resizing' : ''}`}
                                style={{ gridColumn: `span ${blk.width}` }}
                                draggable onDragStart={(e) => handleDragStart(e, { type: 'placed', blockId: blk.id, sourceSectionId: section.id })}
                                onDragOver={(e) => handleBlockDrop(e, blk.id, section.id)}
                                onDragLeave={() => setDragOverBlockId(null)}
                                onClick={() => setSelectedBlockId(blk.id)}>
                                {controlsEl}
                                <div className="wys-related__header">
                                  <Table2 size={14} />
                                  <span className="wys-related__title">{blk.relatedTableId === 't_tasks' ? 'Tasks' : 'Contacts'}</span>
                                  <span className="wys-related__count">{data.length} records</span>
                                </div>
                                <table className="wys-related__table">
                                  <thead><tr>{cols.map((c) => <th key={c}>{c.replace(/_/g, ' ')}</th>)}</tr></thead>
                                  <tbody>{data.map((row: any, ri) => <tr key={ri}>{cols.map((c) => <td key={c}>{row[c]}</td>)}</tr>)}</tbody>
                                </table>
                                <span className="wys-block__width-badge">{blk.width} cols</span>
                                <span className="wys-block__type-badge">relation</span>
                                <div className="wys-block__resize-handle" onMouseDown={(e) => handleResizeStart(e, blk.id, blk.width)} />
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
                                className={`wys-block wys-block--tabs ${isSelected ? 'wys-block--selected' : ''} ${!blk.visible ? 'wys-block--hidden' : ''} ${dragOverBlockId === blk.id ? 'wys-block--drag-over' : ''} ${resizing?.blockId === blk.id ? 'wys-block--resizing' : ''}`}
                                style={{ gridColumn: `span ${blk.width}` }}
                                onDragOver={(e) => { e.stopPropagation(); handleBlockDrop(e, blk.id, section.id); }}
                                onDragLeave={() => setDragOverBlockId(null)}
                                onClick={(e) => { e.stopPropagation(); setSelectedBlockId(blk.id); }}>
                                <div className="wys-block__controls">
                                  <button className="wys-block__btn" onClick={(e) => { e.stopPropagation(); moveBlockPosition(blk.id, section.id, 'up'); }} disabled={idx === 0}><MoveUp size={10} /></button>
                                  <button className="wys-block__btn" onClick={(e) => { e.stopPropagation(); moveBlockPosition(blk.id, section.id, 'down'); }} disabled={idx === total - 1}><MoveDown size={10} /></button>
                                  <button className="wys-block__btn" onClick={(e) => { e.stopPropagation(); updateBlock(blk.id, { visible: !blk.visible }); }}>{blk.visible ? <Eye size={10} /> : <EyeOff size={10} />}</button>
                                  <button className="wys-block__btn wys-block__btn--danger" onClick={(e) => { e.stopPropagation(); removeBlock(blk.id); }}><Trash2 size={10} /></button>
                                  <span className="wys-block__grip" draggable
                                    onDragStart={(e) => handleDragStart(e, { type: 'placed', blockId: blk.id, sourceSectionId: section.id })}>
                                    <GripVertical size={12} />
                                  </span>
                                </div>
                                <div className="wys-tabs__bar">
                                  {tabs.map((tab, ti) => (
                                    <div key={tab.id}
                                      className={`wys-tabs__tab ${ti === activeTabIdx ? 'wys-tabs__tab--active' : ''}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveTabMap((prev) => ({ ...prev, [blk.id]: ti }));
                                      }}>
                                      {tab.label}
                                      {tab.blocks.length > 0 && <span className="wys-tabs__count">{tab.blocks.length}</span>}
                                    </div>
                                  ))}
                                </div>
                                <div
                                  className={`wys-tabs__body ${dragOverTabBlockId === blk.id ? 'wys-tabs__body--drag-over' : ''}`}
                                  onDragOver={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setDragOverTabBlockId(blk.id);
                                    setDragOverBlockId(null);
                                    setDragOverChildBlockId(null);
                                  }}>
                                  {activeBlocks.length === 0 ? (
                                    <p className="wys-tabs__hint">Drop fields here from the palette</p>
                                  ) : (
                                    <div className="wys-section__grid">
                                      {activeBlocks.map((tb, tIdx) => {
                                        const tbField = tb.fieldId ? allFields.find((f) => f.id === tb.fieldId) : null;
                                        const tbSelected = selectedBlockId === tb.id;
                                        const tbTotal = activeBlocks.length;
                                        const tbControls = (
                                          <div className="wys-block__controls">
                                            <button className="wys-block__btn" onClick={(e) => { e.stopPropagation(); moveBlockInTab(blk.id, activeTab.id, tb.id, 'up'); }} disabled={tIdx === 0}><MoveUp size={10} /></button>
                                            <button className="wys-block__btn" onClick={(e) => { e.stopPropagation(); moveBlockInTab(blk.id, activeTab.id, tb.id, 'down'); }} disabled={tIdx === tbTotal - 1}><MoveDown size={10} /></button>
                                            <button className="wys-block__btn" onClick={(e) => { e.stopPropagation(); updateBlock(tb.id, { visible: !tb.visible }); }}>{tb.visible ? <Eye size={10} /> : <EyeOff size={10} />}</button>
                                            <button className="wys-block__btn wys-block__btn--danger" onClick={(e) => { e.stopPropagation(); removeBlock(tb.id); }}><Trash2 size={10} /></button>
                                            <GripVertical size={12} className="wys-block__grip" />
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
                                              className={`wys-block wys-block--field ${tbSelected ? 'wys-block--selected' : ''} ${!tb.visible ? 'wys-block--hidden' : ''} ${isCondHidden ? 'wys-block--conditional-hidden' : ''} ${isDragOver ? 'wys-block--drag-over' : ''}`}
                                              style={{ gridColumn: `span ${tb.width}` }}
                                              draggable
                                              onDragStart={(e) => handleDragStart(e, { type: 'placed', blockId: tb.id, sourceTabBlockId: blk.id, sourceTabId: activeTab.id })}
                                              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverChildBlockId(tb.id); }}
                                              onDragLeave={(e) => { e.stopPropagation(); setDragOverChildBlockId(null); }}
                                              onClick={(e) => { e.stopPropagation(); setSelectedBlockId(tb.id); }}>
                                              {tbControls}
                                              <div className="wys-block__indicators">
                                                {hasConditions && <span className="wys-indicator wys-indicator--cond"><Filter size={10} /></span>}
                                                {hasValidations && <span className="wys-indicator wys-indicator--val"><ShieldAlert size={10} /></span>}
                                              </div>
                                              <label className="wys-block__label">{tb.labelOverride || tbField.name}{tbField.isRequired && <span className="wys-block__required">*</span>}</label>
                                              <div className="wys-block__value">{tb.visible ? renderFieldValue(tbField, mockRecord) : <em>hidden</em>}</div>
                                              <span className="wys-block__width-badge">{tb.width} cols</span>
                                              <span className="wys-block__type-badge">{tbField.logicalType}</span>
                                              <div className="wys-block__resize-handle" onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(e, tb.id, tb.width); }} />
                                            </div>
                                          );
                                        }

                                        if (tb.blockType === 'related_list') {
                                          const data = tb.relatedTableId === 't_tasks' ? MOCK_RELATED_TASKS : MOCK_RELATED_CONTACTS;
                                          const cols = tb.relatedDisplayFields || ['title', 'status'];
                                          const isDragOver = dragOverChildBlockId === tb.id;
                                          return (
                                            <div key={tb.id}
                                              className={`wys-block wys-block--related ${tbSelected ? 'wys-block--selected' : ''} ${!tb.visible ? 'wys-block--hidden' : ''} ${isDragOver ? 'wys-block--drag-over' : ''}`}
                                              style={{ gridColumn: `span ${tb.width}` }}
                                              draggable
                                              onDragStart={(e) => handleDragStart(e, { type: 'placed', blockId: tb.id, sourceTabBlockId: blk.id, sourceTabId: activeTab.id })}
                                              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverChildBlockId(tb.id); }}
                                              onDragLeave={(e) => { e.stopPropagation(); setDragOverChildBlockId(null); }}
                                              onClick={(e) => { e.stopPropagation(); setSelectedBlockId(tb.id); }}>
                                              {tbControls}
                                              <div className="wys-related__header">
                                                <Table2 size={14} />
                                                <span className="wys-related__title">{tb.relatedTableId === 't_tasks' ? 'Tasks' : 'Contacts'}</span>
                                                <span className="wys-related__count">{data.length} records</span>
                                              </div>
                                              <table className="wys-related__table">
                                                <thead><tr>{cols.map((c) => <th key={c}>{c.replace(/_/g, ' ')}</th>)}</tr></thead>
                                                <tbody>{data.map((row: any, ri) => <tr key={ri}>{cols.map((c) => <td key={c}>{row[c]}</td>)}</tr>)}</tbody>
                                              </table>
                                              <span className="wys-block__width-badge">{tb.width} cols</span>
                                              <span className="wys-block__type-badge">relation</span>
                                              <div className="wys-block__resize-handle" onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(e, tb.id, tb.width); }} />
                                            </div>
                                          );
                                        }
                                        return null;
                                      })}
                                    </div>
                                  )}
                                </div>
                                <span className="wys-block__width-badge">{blk.width} cols</span>
                                <span className="wys-block__type-badge">tabs</span>
                                <div className="wys-block__resize-handle" onMouseDown={(e) => handleResizeStart(e, blk.id, blk.width)} />
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
                <div className="wys-page__empty"><p>No sections yet. Click <strong>+ Add Section</strong>.</p></div>
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT: Properties ── */}
        {!previewMode && (
          <div
            className={`wys-props-outer ${showProperties ? 'wys-props-outer--open' : ''} ${propsFloating ? 'wys-props-outer--floating' : ''}`}
            style={{ width: propsFloating ? (showProperties ? propsWidth : 36) : '100%' }}
            onMouseEnter={() => { if (propsFloating) setShowProperties(true); }}
            onMouseLeave={() => { if (propsFloating) setShowProperties(false); }}
          >
            {showProperties && (
              <>
                <div className="wys-props-resize" onMouseDown={(e) => { e.preventDefault(); setPropsResizing(true); }} />
                <div className="wys-properties">
                  <div className="wys-props-header">
                    <h3 className="wys-panel-title"><Settings size={13} /> Properties</h3>
                    <button className="wys-block__btn" onClick={() => {
                      const next = !propsFloating;
                      setPropsFloating(next);
                      if (!next) setShowProperties(true);
                    }} title={propsFloating ? 'Dock panel' : 'Float panel over canvas'}>
                      {propsFloating ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
                    </button>
                  </div>
                  {selectedBlock ? (
                    <>
                <div className="wys-prop__name">
                  {selectedBlock.blockType === 'field' ? selectedField?.name :
                   selectedBlock.blockType === 'related_list' ? (selectedBlock.relatedTableId === 't_tasks' ? 'Related Tasks' : 'Related Contacts') :
                   'Tab Group'}
                </div>
                <div className="wys-prop__type">{selectedBlock.blockType}</div>

                <div className="wys-prop-group">
                  <label className="wys-prop-label">Width</label>
                  <span className="wys-prop-width-readout">{selectedBlock.width} / 12 columns</span>
                </div>

                <div className="wys-prop-group">
                  <label className="wys-prop-label">
                    <input type="checkbox" checked={selectedBlock.visible}
                      onChange={(e) => updateBlock(selectedBlock.id, { visible: e.target.checked })} />{' '}Visible
                  </label>
                </div>

                {selectedBlock.blockType === 'field' && (
                  <div className="wys-prop-group">
                    <label className="wys-prop-label">Label</label>
                    <input className="sails-input" value={selectedBlock.labelOverride || ''}
                      onChange={(e) => updateBlock(selectedBlock.id, { labelOverride: e.target.value })}
                      placeholder={selectedField?.name} style={{ fontSize: 12, padding: '6px 8px' }} />
                  </div>
                )}

                {selectedBlock.blockType === 'related_list' && (
                  <>
                    <div className="wys-prop-group">
                      <label className="wys-prop-label">Source Table</label>
                      <select className="sails-input" value={selectedBlock.relatedTableId}
                        onChange={(e) => updateBlock(selectedBlock.id, { relatedTableId: e.target.value })}
                        style={{ fontSize: 12, padding: '6px 8px' }}>
                        <option value="t_tasks">Tasks</option>
                        <option value="t_contacts">Contacts</option>
                      </select>
                    </div>
                    <div className="wys-prop-group">
                      <label className="wys-prop-label">Max Rows</label>
                      <input className="sails-input" type="number" value={selectedBlock.relatedMaxRows}
                        onChange={(e) => updateBlock(selectedBlock.id, { relatedMaxRows: Number(e.target.value) })}
                        style={{ fontSize: 12, padding: '6px 8px' }} />
                    </div>
                  </>
                )}

                {selectedBlock.blockType === 'tab_group' && (
                  <div className="wys-prop-group">
                    <label className="wys-prop-label">Tabs</label>
                    {(selectedBlock.tabs || []).map((tab, ti) => (
                      <div key={tab.id} style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                        <input className="sails-input" value={tab.label}
                          onChange={(e) => {
                            const tabs = [...(selectedBlock.tabs || [])];
                            tabs[ti] = { ...tabs[ti], label: e.target.value };
                            updateBlock(selectedBlock.id, { tabs });
                          }} style={{ fontSize: 12, padding: '4px 6px', flex: 1 }} />
                        <button className="wys-block__btn wys-block__btn--danger"
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
                <div className="wys-prop-group">
                  <div className="wys-prop-label" style={{ justifyContent: 'space-between' }}>
                    <span><Filter size={12} /> Conditions</span>
                    <button className="sails-btn sails-btn--ghost sails-btn--sm"
                      onClick={() => {
                        const conds = [...(selectedBlock.conditions || []), {
                          id: `cond_${Date.now()}`,
                          fieldId: MOCK_LEADS_FIELDS[0]?.id || '',
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
                      <div key={cond.id} className="wys-cond-card">
                        {ci > 0 && (
                          <div style={{ display: 'flex', gap: 2, marginBottom: 4 }}>
                            {(['and', 'or'] as const).map((l) => (
                              <button key={l}
                                className={`wys-cond-logic-btn ${cond.logic === l ? 'wys-cond-logic-btn--active' : ''}`}
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
                        <div className="wys-cond-body">
                          <select className="sails-input" value={cond.fieldId}
                            onChange={(e) => {
                              const conds = [...(selectedBlock.conditions || [])];
                              conds[ci] = { ...conds[ci], fieldId: e.target.value };
                              updateBlock(selectedBlock.id, { conditions: conds });
                            }} style={{ fontSize: 10, padding: '3px 4px', flex: 1 }}>
                            {MOCK_LEADS_FIELDS.map((f) => (
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
                          <button className="wys-block__btn wys-block__btn--danger"
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
                  <div className="wys-prop-group">
                    <div className="wys-prop-label" style={{ justifyContent: 'space-between' }}>
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
                        <div key={val.id} className="wys-cond-card">
                          <div className="wys-cond-body" style={{ flexWrap: 'wrap' }}>
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
                            <button className="wys-block__btn wys-block__btn--danger"
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
                                {MOCK_LEADS_FIELDS.filter((f) => f.id !== selectedBlock.fieldId).map((f) => (
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
              <p className="wys-empty">Select a block to edit its properties</p>
            )}
          </div>
              </>
            )}
            {!showProperties && (
              <div className="wys-props-tab" onClick={() => setShowProperties(true)}>
                <Settings size={14} />
              </div>
            )}
          </div>
        )}
      </div>

      {showResetConfirm && (
        <div className="wys-modal-overlay" onClick={() => setShowResetConfirm(false)}>
          <div className="wys-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="wys-modal__title">Reset Layout</h3>
            <p className="wys-modal__text">This will clear all sections, blocks, and tab configurations. This action cannot be undone.</p>
            <div className="wys-modal__actions">
              <button className="sails-btn sails-btn--ghost sails-btn--sm" onClick={() => setShowResetConfirm(false)}>Cancel</button>
              <button className="sails-btn sails-btn--danger sails-btn--sm" onClick={doReset}>Reset</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LayoutBuilder;
