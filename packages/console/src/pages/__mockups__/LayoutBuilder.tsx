/**
 * MOCK UP — WYSIWYG Layout Builder with Pluggable Blocks
 *
 * Block types: field | related_list | tab_group
 * Each block is a plugin: it renders its own preview and has its own properties.
 */
import React, { useState, useMemo } from 'react';
import {
  GripVertical, Plus, X, Eye, EyeOff, Trash2, MoveUp, MoveDown,
  LayoutGrid, Settings, ArrowRight, ListTree, FolderKanban, Columns,
  Table2, Filter, ShieldAlert, AlertCircle, ChevronDown, ChevronRight,
} from 'lucide-react';
import type { KlaoFieldDefinition } from '@klao/shared';
import { MOCK_LEADS_FIELDS } from './sample-layout-data';
import './LayoutBuilder.css';

// ─── Types ────────────────────────────────────────────────────

type Width = 'full' | 'third' | 'half' | 'quarter';
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
  tabs?: { id: string; label: string; sectionIds: string[] }[];
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

function defaultPropsForBlock(blockType: BlockType, fieldId?: string): Partial<PlacedBlock> {
  if (blockType === 'field') return { fieldId, labelOverride: '', width: 'half' as Width };
  if (blockType === 'related_list') return {
    relatedTableId: 't_tasks',
    relatedDisplayFields: ['title', 'status', 'due_date'],
    relatedMaxRows: 5,
    width: 'full' as Width,
  };
  if (blockType === 'tab_group') return {
    tabs: [
      { id: 'tab1', label: 'Details', sectionIds: [] },
      { id: 'tab2', label: 'Activity', sectionIds: [] },
      { id: 'tab3', label: 'Files', sectionIds: [] },
    ],
    width: 'full' as Width,
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

function renderFieldValue(field: KlaoFieldDefinition, record: Record<string, any>): string {
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

function evaluateCondition(cond: BlockCondition, record: Record<string, any>, fields: KlaoFieldDefinition[]): boolean {
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

function evaluateConditions(conditions: BlockCondition[] | undefined, record: Record<string, any>, fields: KlaoFieldDefinition[]): boolean {
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
  const [showProperties, setShowProperties] = useState(true);
  const [mockRecord, setMockRecord] = useState<Record<string, any>>({
    lead_name: 'ACME Corp Deal', company: 'ACME Corporation',
    email: 'j.doe@acme.com', phone: '+66 2 123 4567',
    status: 'qualified', source: 'website', budget: 250000,
    contact_date: '2026-06-15',
    notes: 'Met at Tech Summit. Interested in Enterprise plan. Follow up Q3.',
    assigned_to: 'Somsak Chaiyaporn',
  });
  const [showDataEditor, setShowDataEditor] = useState(false);

  const allFields = MOCK_LEADS_FIELDS;
  const placedFieldIds = blocks.filter((b) => b.blockType === 'field').map((b) => b.fieldId!).filter(Boolean);
  const palette = buildPalette(placedFieldIds);
  const selectedBlock = blocks.find((b) => b.id === selectedBlockId) || null;
  const selectedField = selectedBlock?.fieldId ? allFields.find((f) => f.id === selectedBlock.fieldId) : null;

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
      visible: true,
      ...defaultPropsForBlock(item.blockType, item.fieldId),
    };
    setBlocks((b) => [...b, blk]);
    setSelectedBlockId(blk.id);
  };

  const removeBlock = (blockId: string) => {
    setBlocks((b) => b.filter((blk) => blk.id !== blockId));
    if (selectedBlockId === blockId) setSelectedBlockId(null);
  };

  const moveBlockToSection = (blockId: string, targetSectionId: string) => {
    const existing = blocks.filter((b) => b.sectionId === targetSectionId);
    setBlocks((prev) => prev.map((blk) => blk.id === blockId ? { ...blk, sectionId: targetSectionId, position: existing.length } : blk));
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
    setBlocks((prev) => prev.map((blk) => blk.id === blockId ? { ...blk, ...patch } : blk));
  };

  const handleDragStart = (e: React.DragEvent, payload: DragPayload) => {
    e.dataTransfer.setData('application/json', JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetSectionId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverSection(null);
    setDragOverBlockId(null);
    try {
      const payload: DragPayload = JSON.parse(e.dataTransfer.getData('application/json'));

      if (payload.type === 'palette') {
        const item = palette.find((p) => p.id === payload.paletteId);
        if (item) addBlock(item, targetSectionId);
      } else if (payload.type === 'placed' && payload.blockId) {
        const draggedBlock = blocks.find((b) => b.id === payload.blockId);
        if (!draggedBlock) return;

        // Same section swap — move to target position
        if (targetSectionId === payload.sourceSectionId && dragOverBlockId) {
          const sectionBlocks = blocksBySection[targetSectionId] || [];
          const targetIdx = sectionBlocks.findIndex((b) => b.id === dragOverBlockId);
          if (targetIdx === -1) return;

          setBlocks((prev) => {
            const updated = prev.map((blk) => {
              if (blk.id === payload.blockId) return { ...blk, position: targetIdx };
              // Shift others: if target is after source, shift down; if before, shift up
              const sourceIdx = sectionBlocks.findIndex((b) => b.id === payload.blockId);
              if (sourceIdx < targetIdx) {
                // Moving down: shift blocks between source+1..target up by 1
                const sectionPos = sectionBlocks.findIndex((b) => b.id === blk.id);
                if (blk.sectionId === targetSectionId && sectionPos > sourceIdx && sectionPos <= targetIdx) {
                  return { ...blk, position: blk.position - 1 };
                }
              } else if (sourceIdx > targetIdx) {
                // Moving up: shift blocks between target..source-1 down by 1
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
          // Different section — move to end
          moveBlockToSection(payload.blockId, targetSectionId);
        }
      }
    } catch {}
  };

  const handleBlockDrop = (e: React.DragEvent, targetBlockId: string, sectionId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverBlockId(targetBlockId);
  };

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="wys-root">
      <div className="wys-toolbar">
        <span className="wys-toolbar__brand">Page Layout Builder</span>
        <div className="wys-toolbar__actions">
          <button className="klao-btn klao-btn--ghost klao-btn--sm" onClick={() => setShowProperties(!showProperties)}>
            <Settings size={14} /> {showProperties ? 'Hide' : 'Show'} Properties
          </button>
          <button className="klao-btn klao-btn--ghost klao-btn--sm" onClick={() => { setSections([newSection()]); setBlocks([]); setSelectedBlockId(null); sectionCounter = 0; blockCounter = 0; }}>
            Reset
          </button>
          <button className="klao-btn klao-btn--primary klao-btn--sm">Save Layout</button>
        </div>
      </div>

      <div className="wys-body">
        {/* ── LEFT: Palette ── */}
        <div className="wys-palette">
          <div className="wys-palette__header">
            <h3 className="wys-panel-title"><LayoutGrid size={13} /> Blocks</h3>
            <span className="wys-palette__count">{palette.length}</span>
          </div>
          <button className="klao-btn klao-btn--ghost klao-btn--sm wys-palette__add-section" onClick={addSection}>
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

        {/* ── CENTER: WYSIWYG Canvas ── */}
        <div className="wys-canvas">
          <div className="wys-canvas__scroll">
            <div className="wys-page">
              {/* ── Mock Data Editor (for testing conditions) ── */}
              <div className="klao-card" style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}>
                <button className="wys-section__header" onClick={() => setShowDataEditor(!showDataEditor)} style={{ width: '100%', border: 'none', textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {showDataEditor ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    <span style={{ fontSize: 12, fontWeight: 600 }}>Test Data Editor</span>
                    <span style={{ fontSize: 10, color: 'var(--klao-text-muted)' }}>— change values to see conditions react</span>
                  </div>
                </button>
                {showDataEditor && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, padding: '8px 16px 12px' }}>
                    {MOCK_LEADS_FIELDS.map((field) => {
                      const val = mockRecord[field.fieldName] ?? '';
                      return (
                        <div key={field.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <label style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: 'var(--klao-text-muted)' }}>{field.name}</label>
                          {field.logicalType === 'select' ? (
                            <select className="klao-input" value={val} onChange={(e) => setMockRecord((r) => ({ ...r, [field.fieldName]: e.target.value }))}
                              style={{ fontSize: 11, padding: '4px 6px' }}>
                              {(field.config as any)?.options?.map((o: any) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                          ) : field.logicalType === 'currency' ? (
                            <input className="klao-input" type="number" value={val} onChange={(e) => setMockRecord((r) => ({ ...r, [field.fieldName]: Number(e.target.value) }))}
                              style={{ fontSize: 11, padding: '4px 6px' }} />
                          ) : (
                            <input className="klao-input" value={val} onChange={(e) => setMockRecord((r) => ({ ...r, [field.fieldName]: e.target.value }))}
                              style={{ fontSize: 11, padding: '4px 6px' }} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

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
                    onDragOver={(e) => { e.preventDefault(); setDragOverSection(section.id); setDragOverBlockId(null); }}
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
                                className={`wys-block wys-block--field wys-block--${blk.width} ${isSelected ? 'wys-block--selected' : ''} ${!blk.visible ? 'wys-block--hidden' : ''} ${dragOverBlockId === blk.id ? 'wys-block--drag-over' : ''} ${isConditionalHidden ? 'wys-block--conditional-hidden' : ''}`}
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
                                <span className={`wys-block__width-badge wys-block__width-badge--${blk.width}`}>{blk.width}</span>
                                <span className="wys-block__type-badge">{field.logicalType}</span>
                              </div>
                            );
                          }

                          // ── RELATED LIST BLOCK ──
                          if (blk.blockType === 'related_list') {
                            const data = blk.relatedTableId === 't_tasks' ? MOCK_RELATED_TASKS : MOCK_RELATED_CONTACTS;
                            const cols = blk.relatedDisplayFields || ['title', 'status'];
                            return (
                              <div key={blk.id}
                                className={`wys-block wys-block--related wys-block--${blk.width} ${isSelected ? 'wys-block--selected' : ''} ${!blk.visible ? 'wys-block--hidden' : ''} ${dragOverBlockId === blk.id ? 'wys-block--drag-over' : ''}`}
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
                                <span className={`wys-block__width-badge wys-block__width-badge--${blk.width}`}>{blk.width}</span>
                                <span className="wys-block__type-badge">relation</span>
                              </div>
                            );
                          }

                          // ── TAB GROUP BLOCK ──
                          if (blk.blockType === 'tab_group') {
                            const tabs = blk.tabs || [];
                            return (
                              <div key={blk.id}
                                className={`wys-block wys-block--tabs wys-block--${blk.width} ${isSelected ? 'wys-block--selected' : ''} ${!blk.visible ? 'wys-block--hidden' : ''} ${dragOverBlockId === blk.id ? 'wys-block--drag-over' : ''}`}
                                draggable onDragStart={(e) => handleDragStart(e, { type: 'placed', blockId: blk.id, sourceSectionId: section.id })}
                                onDragOver={(e) => handleBlockDrop(e, blk.id, section.id)}
                                onDragLeave={() => setDragOverBlockId(null)}
                                onClick={() => setSelectedBlockId(blk.id)}>
                                {controlsEl}
                                <div className="wys-tabs__bar">
                                  {tabs.map((tab, ti) => (
                                    <div key={tab.id} className={`wys-tabs__tab ${ti === 0 ? 'wys-tabs__tab--active' : ''}`}>{tab.label}</div>
                                  ))}
                                </div>
                                <div className="wys-tabs__body">
                                  <p className="wys-tabs__hint">{tabs[0]?.label || 'Tab'} content — drop fields/sections into each tab</p>
                                </div>
                                <span className={`wys-block__width-badge wys-block__width-badge--${blk.width}`}>{blk.width}</span>
                                <span className="wys-block__type-badge">tabs</span>
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
        {showProperties && (
          <div className="wys-properties">
            <h3 className="wys-panel-title"><Settings size={13} /> Properties</h3>
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
                  <div className="wys-prop-width-grid">
                    {(['full', 'third', 'half', 'quarter'] as Width[]).map((w) => (
                      <button key={w} className={`wys-prop-width-btn ${selectedBlock.width === w ? 'wys-prop-width-btn--active' : ''}`}
                        onClick={() => updateBlock(selectedBlock.id, { width: w })}>{w}</button>
                    ))}
                  </div>
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
                    <input className="klao-input" value={selectedBlock.labelOverride || ''}
                      onChange={(e) => updateBlock(selectedBlock.id, { labelOverride: e.target.value })}
                      placeholder={selectedField?.name} style={{ fontSize: 12, padding: '6px 8px' }} />
                  </div>
                )}

                {selectedBlock.blockType === 'related_list' && (
                  <>
                    <div className="wys-prop-group">
                      <label className="wys-prop-label">Source Table</label>
                      <select className="klao-input" value={selectedBlock.relatedTableId}
                        onChange={(e) => updateBlock(selectedBlock.id, { relatedTableId: e.target.value })}
                        style={{ fontSize: 12, padding: '6px 8px' }}>
                        <option value="t_tasks">Tasks</option>
                        <option value="t_contacts">Contacts</option>
                      </select>
                    </div>
                    <div className="wys-prop-group">
                      <label className="wys-prop-label">Max Rows</label>
                      <input className="klao-input" type="number" value={selectedBlock.relatedMaxRows}
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
                        <input className="klao-input" value={tab.label}
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
                    <button className="klao-btn klao-btn--ghost klao-btn--sm"
                      onClick={() => {
                        const tabs = [...(selectedBlock.tabs || []), { id: `tab_${Date.now()}`, label: 'New Tab', sectionIds: [] }];
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
                    <button className="klao-btn klao-btn--ghost klao-btn--sm"
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
                    <p style={{ fontSize: 11, color: 'var(--klao-text-muted)', fontStyle: 'italic', margin: 0 }}>
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
                          <select className="klao-input" value={cond.fieldId}
                            onChange={(e) => {
                              const conds = [...(selectedBlock.conditions || [])];
                              conds[ci] = { ...conds[ci], fieldId: e.target.value };
                              updateBlock(selectedBlock.id, { conditions: conds });
                            }} style={{ fontSize: 10, padding: '3px 4px', flex: 1 }}>
                            {MOCK_LEADS_FIELDS.map((f) => (
                              <option key={f.id} value={f.id}>{f.name}</option>
                            ))}
                          </select>
                          <select className="klao-input" value={cond.operator}
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
                            <input className="klao-input" value={cond.value}
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
                      <button className="klao-btn klao-btn--ghost klao-btn--sm"
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
                      <p style={{ fontSize: 11, color: 'var(--klao-text-muted)', fontStyle: 'italic', margin: 0 }}>
                        No validation rules.
                      </p>
                    ) : (
                      (selectedBlock.validations || []).map((val, vi) => (
                        <div key={val.id} className="wys-cond-card">
                          <div className="wys-cond-body" style={{ flexWrap: 'wrap' }}>
                            <select className="klao-input" value={val.type}
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
                              <select className="klao-input" value={val.dependentFieldId || ''}
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
                                <select className="klao-input" value={val.dependentOperator || 'eq'}
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
                                <input className="klao-input" value={val.dependentValue || ''}
                                  onChange={(e) => {
                                    const vals = [...(selectedBlock.validations || [])];
                                    vals[vi] = { ...vals[vi], dependentValue: e.target.value };
                                    updateBlock(selectedBlock.id, { validations: vals });
                                  }} placeholder="value" style={{ fontSize: 10, padding: '3px 4px', flex: 1 }} />
                              </div>
                            </div>
                          )}

                          {val.type === 'regex' && (
                            <input className="klao-input" value={val.pattern || ''}
                              onChange={(e) => {
                                const vals = [...(selectedBlock.validations || [])];
                                vals[vi] = { ...vals[vi], pattern: e.target.value };
                                updateBlock(selectedBlock.id, { validations: vals });
                              }} placeholder="e.g. ^[A-Z]{3}-\d{4}$" style={{ fontSize: 10, padding: '3px 4px', marginTop: 4 }} />
                          )}

                          {val.type === 'range' && (
                            <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
                              <input className="klao-input" type="number" value={val.min ?? ''}
                                onChange={(e) => {
                                  const vals = [...(selectedBlock.validations || [])];
                                  vals[vi] = { ...vals[vi], min: e.target.value ? Number(e.target.value) : undefined };
                                  updateBlock(selectedBlock.id, { validations: vals });
                                }} placeholder="Min" style={{ fontSize: 10, padding: '3px 4px', flex: 1 }} />
                              <input className="klao-input" type="number" value={val.max ?? ''}
                                onChange={(e) => {
                                  const vals = [...(selectedBlock.validations || [])];
                                  vals[vi] = { ...vals[vi], max: e.target.value ? Number(e.target.value) : undefined };
                                  updateBlock(selectedBlock.id, { validations: vals });
                                }} placeholder="Max" style={{ fontSize: 10, padding: '3px 4px', flex: 1 }} />
                            </div>
                          )}

                          <input className="klao-input" value={val.message}
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
        )}
      </div>
    </div>
  );
};

export default LayoutBuilder;
