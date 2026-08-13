/**
 * MOCK UP — Form Event Builder (compact single-column variant)
 *
 * Compact design: fits inside Layout Studio's right config panel.
 * Horizontal chip strip selects the action; pre-validations + event sections
 * are collapsible accordions; the preview + run simulation live inline
 * (toggled), no side columns. Mirrors the LIST view's Actions card pattern.
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, X, Trash2, MoveUp, MoveDown, ChevronDown, ChevronRight,
  Settings, Zap, Database, Code, Workflow as WorkflowIcon, Bell, CircleCheck,
  CircleX, Copy, Send, Eye, EyeOff, Play, RotateCcw, ShieldAlert,
  MousePointerClick, Sparkles, Check, Braces, CircleAlert, LoaderCircle,
  Archive, Download, Printer, KeyRound, GitBranch, ExternalLink,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { SailsFieldDefinition } from '@sails/shared';
import { MOCK_LEADS_FIELDS } from './sample-layout-data';
import './FormEventBuilder.css';

// ─── Types ────────────────────────────────────────────────────

type EventType = 'record' | 'expression' | 'script' | 'notification';
type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type RunState = 'idle' | 'running' | 'completed';
type EventRunStatus = 'idle' | 'running' | 'done' | 'skipped';

interface FormEvent {
  id: string;
  type: EventType;
  label: string;
  condition?: string;
  storeAs?: string;
  config: Record<string, any>;
}

interface ActionSection {
  id: string;
  condition?: string;
  events: FormEvent[];
  collapsed?: boolean;
}

interface PreValidation {
  id: string;
  fieldId: string;
  rule: string;
  value?: string;
  message: string;
}

interface FormAction {
  id: string;
  label: string;
  variant: ButtonVariant;
  iconName: string;
  visible: boolean;
  preValidations: PreValidation[];
  sections: ActionSection[];
}

// ─── Event type definitions (mirrors workflow EVENT_DEFS, no approval) ──

const EVENT_DEFS: Record<EventType, { label: string; desc: string; Icon: LucideIcon; color: string }> = {
  record:       { label: 'Record Event',    desc: 'Create / Update / Delete', Icon: Database,     color: '#3b82f6' },
  expression:   { label: 'Expression',      desc: 'JSONata computation',       Icon: Code,        color: '#a855f7' },
  script:       { label: 'Script',          desc: 'BYOC script (sandbox)',     Icon: WorkflowIcon, color: '#8b5cf6' },
  notification: { label: 'Notification',    desc: 'Email / Slack',             Icon: Bell,        color: '#f59e0b' },
};

const EVENT_TYPE_ORDER: EventType[] = ['record', 'expression', 'script', 'notification'];

const ACTION_ICON_OPTIONS: { value: string; label: string; Icon: LucideIcon }[] = [
  { value: 'CircleCheck', label: 'Approve', Icon: CircleCheck },
  { value: 'CircleX',     label: 'Reject',  Icon: CircleX },
  { value: 'Send',        label: 'Send',    Icon: Send },
  { value: 'Copy',        label: 'Clone',   Icon: Copy },
  { value: 'Archive',     label: 'Archive', Icon: Archive },
  { value: 'Download',    label: 'Export',  Icon: Download },
  { value: 'Printer',     label: 'Print',   Icon: Printer },
  { value: 'Zap',         label: 'Action',  Icon: Zap },
  { value: 'KeyRound',    label: 'Key',     Icon: KeyRound },
];

const VARIANT_OPTIONS: { value: ButtonVariant; label: string }[] = [
  { value: 'primary', label: 'Primary' },
  { value: 'secondary', label: 'Secondary' },
  { value: 'danger', label: 'Danger' },
  { value: 'ghost', label: 'Ghost' },
];

const VALIDATION_RULES = [
  { value: 'required', label: 'Is required' },
  { value: 'eq', label: 'Equals' },
  { value: 'neq', label: 'Not equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'gt', label: 'Greater than' },
  { value: 'gte', label: 'Greater / equal' },
  { value: 'lt', label: 'Less than' },
  { value: 'lte', label: 'Less / equal' },
];

const MOCK_SCRIPTS = [
  { id: 'scr_send_confirmation', name: 'send_confirmation.ts' },
  { id: 'scr_calc_commission', name: 'calculate_commission.js' },
  { id: 'scr_sync_crm', name: 'sync_crm.ts' },
];

const MOCK_TEMPLATES = [
  { id: 'tpl_approved', name: 'Lead Approved', subject: 'Your lead was approved' },
  { id: 'tpl_rejected', name: 'Lead Rejected', subject: 'Lead rejected — reason attached' },
  { id: 'tpl_big_deal', name: 'Large Deal Alert', subject: 'High-value lead needs attention' },
  { id: 'tpl_cloned', name: 'Record Cloned', subject: 'A copy of the record was created' },
];

// ─── Mock data ────────────────────────────────────────────────

let uidCounter = 0;
const uid = (p: string): string => `${p}_${Date.now().toString(36)}_${++uidCounter}`;

const MOCK_RECORD: Record<string, any> = {
  lead_name: 'ACME Corp Deal',
  status: 'pending',
  budget: 250000,
  email: 'j.doe@acme.com',
  assigned_to: 'Somsak Chaiyaporn',
};

function buildMockActions(): FormAction[] {
  return [
    {
      id: uid('act'),
      label: 'Approve',
      variant: 'primary',
      iconName: 'CircleCheck',
      visible: true,
      preValidations: [
        { id: uid('pv'), fieldId: 'f_005', rule: 'eq', value: 'pending', message: 'Only pending leads can be approved.' },
      ],
      sections: [
        {
          id: uid('sec'),
          events: [
            {
              id: uid('ev'), type: 'record', label: 'Update status',
              config: { operation: 'update', mappings: [{ fieldId: 'f_005', value: 'approved' }] },
            },
            {
              id: uid('ev'), type: 'expression', label: 'Compute total with tax',
              config: { expression: 'record.budget * 1.07' }, storeAs: 'totalWithTax',
            },
            {
              id: uid('ev'), type: 'notification', label: 'Notify assigned rep',
              config: { templateId: 'tpl_approved', channel: 'email', to: '{{record.assigned_to}}' },
            },
          ],
        },
        {
          id: uid('sec'),
          condition: '{{record.budget >= 100000}}',
          events: [
            {
              id: uid('ev'), type: 'notification', label: 'Alert manager',
              config: { templateId: 'tpl_big_deal', channel: 'email', to: 'manager@sails.app' },
            },
          ],
        },
      ],
    },
    {
      id: uid('act'),
      label: 'Reject',
      variant: 'danger',
      iconName: 'CircleX',
      visible: true,
      preValidations: [
        { id: uid('pv'), fieldId: 'f_005', rule: 'neq', value: 'lost', message: 'Already lost — no need to reject.' },
      ],
      sections: [
        {
          id: uid('sec'),
          events: [
            {
              id: uid('ev'), type: 'record', label: 'Update status',
              config: { operation: 'update', mappings: [{ fieldId: 'f_005', value: 'rejected' }] },
            },
            {
              id: uid('ev'), type: 'notification', label: 'Notify reporter',
              config: { templateId: 'tpl_rejected', channel: 'email', to: '{{record.email}}' },
            },
          ],
        },
      ],
    },
    {
      id: uid('act'),
      label: 'Clone & Notify',
      variant: 'secondary',
      iconName: 'Copy',
      visible: true,
      preValidations: [],
      sections: [
        {
          id: uid('sec'),
          condition: '{{record.budget > 300000}}',
          events: [
            {
              id: uid('ev'), type: 'record', label: 'Create copy',
              config: { operation: 'create', copyFrom: 'record' },
            },
            {
              id: uid('ev'), type: 'notification', label: 'Notify manager',
              config: { templateId: 'tpl_big_deal', channel: 'slack', to: '#managers' },
            },
          ],
        },
        {
          id: uid('sec'),
          events: [
            {
              id: uid('ev'), type: 'notification', label: 'Confirm to reporter',
              config: { templateId: 'tpl_cloned', channel: 'email', to: '{{record.email}}' },
            },
          ],
        },
      ],
    },
  ];
}

function mockEval(cond: string, rec: Record<string, any>): boolean {
  if (!cond.trim()) return true;
  const m = cond.match(/record\.(\w+)\s*(>=|<=|==|!=|>|<)\s*(-?\d+)/);
  if (!m) return true;
  const val = rec[m[1]];
  if (typeof val !== 'number') return false;
  const op = m[2];
  const num = Number(m[3]);
  switch (op) {
    case '>':  return val > num;
    case '<':  return val < num;
    case '>=': return val >= num;
    case '<=': return val <= num;
    case '==': return val === num;
    default:   return val !== num;
  }
}

// ─── Sub-components ───────────────────────────────────────────

const ActionIcon: React.FC<{ name: string; size?: number }> = ({ name, size = 14 }) => {
  const opt = ACTION_ICON_OPTIONS.find((o) => o.value === name);
  const Icon = opt?.Icon || Zap;
  return <Icon size={size} />;
};

const RunChip: React.FC<{ tone: 'passed' | 'skipped' | 'running'; children: React.ReactNode }> = ({ tone, children }) => (
  <span className={`feb-run-chip feb-run-chip--${tone}`}>{children}</span>
);

interface EventConfigPanelProps {
  event: FormEvent;
  onPatch: (patch: Partial<FormEvent>) => void;
}

const EventConfigPanel: React.FC<EventConfigPanelProps> = ({ event, onPatch }) => {
  return (
    <div className="feb-event__config">
      <div className="feb-grid feb-grid--2">
        <label className="feb-field">
          <span className="feb-field__label">Label</span>
          <input className="feb-input" value={event.label} onChange={(e) => onPatch({ label: e.target.value })} />
        </label>
        <label className="feb-field">
          <span className="feb-field__label">Store result as</span>
          <input className="feb-input feb-input--mono" value={event.storeAs || ''} placeholder="myVar — optional" onChange={(e) => onPatch({ storeAs: e.target.value || undefined })} />
        </label>
      </div>

      {event.type === 'record' && (
        <>
          <label className="feb-field">
            <span className="feb-field__label">Operation</span>
            <select
              className="feb-input"
              value={event.config.operation || 'update'}
              onChange={(e) => onPatch({ config: { ...event.config, operation: e.target.value } })}
            >
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="upsert">Upsert</option>
              <option value="delete">Delete</option>
            </select>
          </label>
          {event.config.operation !== 'create' && event.config.operation !== 'delete' && (
            <div className="feb-mappings">
              <span className="feb-field__label">Field mapping</span>
              {(event.config.mappings || []).map((m: any, mi: number) => (
                <div key={mi} className="feb-mapping">
                  <select
                    className="feb-input"
                    value={m.fieldId}
                    onChange={(e) => {
                      const mappings = [...(event.config.mappings || [])];
                      mappings[mi] = { ...mappings[mi], fieldId: e.target.value };
                      onPatch({ config: { ...event.config, mappings } });
                    }}
                  >
                    {MOCK_LEADS_FIELDS.filter((f) => !f.isSystem).map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                  <input
                    className="feb-input feb-input--mono"
                    value={m.value || ''}
                    placeholder="value"
                    onChange={(e) => {
                      const mappings = [...(event.config.mappings || [])];
                      mappings[mi] = { ...mappings[mi], value: e.target.value };
                      onPatch({ config: { ...event.config, mappings } });
                    }}
                  />
                  <button
                    className="feb-icon-btn feb-icon-btn--danger"
                    onClick={() => {
                      const mappings = (event.config.mappings || []).filter((_: any, i: number) => i !== mi);
                      onPatch({ config: { ...event.config, mappings } });
                    }}
                  ><X size={11} /></button>
                </div>
              ))}
              <button
                className="feb-btn feb-btn--mini"
                onClick={() => {
                  const mappings = [...(event.config.mappings || []), { fieldId: MOCK_LEADS_FIELDS[0].id, value: '' }];
                  onPatch({ config: { ...event.config, mappings } });
                }}
              ><Plus size={11} /> Add field</button>
            </div>
          )}
        </>
      )}

      {event.type === 'expression' && (
        <>
          <label className="feb-field">
            <span className="feb-field__label">JSONata expression</span>
            <textarea
              className="feb-input feb-input--mono feb-input--area"
              rows={3}
              value={event.config.expression || ''}
              onChange={(e) => onPatch({ config: { ...event.config, expression: e.target.value } })}
            />
          </label>
          <p className="feb-hint">Available: <code>record</code> (current values) · <code>variables</code> (prior events) · date helpers.</p>
        </>
      )}

      {event.type === 'script' && (
        <div className="feb-grid feb-grid--2">
          <label className="feb-field">
            <span className="feb-field__label">BYOC script</span>
            <select
              className="feb-input"
              value={event.config.scriptId || MOCK_SCRIPTS[0].id}
              onChange={(e) => onPatch({ config: { ...event.config, scriptId: e.target.value } })}
            >
              {MOCK_SCRIPTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="feb-field">
            <span className="feb-field__label">Timeout (ms)</span>
            <input
              className="feb-input"
              type="number"
              value={event.config.timeoutMs ?? 10000}
              onChange={(e) => onPatch({ config: { ...event.config, timeoutMs: Number(e.target.value) } })}
            />
          </label>
        </div>
      )}

      {event.type === 'notification' && (
        <div className="feb-grid feb-grid--2">
          <label className="feb-field">
            <span className="feb-field__label">Template</span>
            <select
              className="feb-input"
              value={event.config.templateId || MOCK_TEMPLATES[0].id}
              onChange={(e) => onPatch({ config: { ...event.config, templateId: e.target.value } })}
            >
              {MOCK_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <label className="feb-field">
            <span className="feb-field__label">Channel</span>
            <select
              className="feb-input"
              value={event.config.channel || 'email'}
              onChange={(e) => onPatch({ config: { ...event.config, channel: e.target.value } })}
            >
              <option value="email">Email</option>
              <option value="slack">Slack</option>
              <option value="both">Email + Slack</option>
            </select>
          </label>
          <label className="feb-field feb-field--wide">
            <span className="feb-field__label">Recipients</span>
            <input className="feb-input feb-input--mono" value={event.config.to || ''} onChange={(e) => onPatch({ config: { ...event.config, to: e.target.value } })} />
          </label>
        </div>
      )}
    </div>
  );
};

interface CompactSectionProps {
  section: ActionSection;
  index: number;
  total: number;
  runSection: 'idle' | 'passed' | 'skipped' | 'running';
  eventStatus: Record<string, EventRunStatus>;
  expandedEventId: string | null;
  onExpandEvent: (id: string | null) => void;
  onPatch: (patch: Partial<ActionSection>) => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
  onAddEvent: (type: EventType) => void;
  onPatchEvent: (eventId: string, patch: Partial<FormEvent>) => void;
  onMoveEvent: (eventId: string, dir: -1 | 1) => void;
  onDeleteEvent: (eventId: string) => void;
}

const CompactSection: React.FC<CompactSectionProps> = ({
  section, index, total, runSection, eventStatus, expandedEventId,
  onExpandEvent, onPatch, onMove, onDelete, onAddEvent,
  onPatchEvent, onMoveEvent, onDeleteEvent,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const condOn = !!section.condition;

  return (
    <div className="feb-section">
      <div className="feb-section__head">
        <span className="feb-section__num">S{index + 1}</span>
        <span className="feb-section__title">Section {index + 1}</span>
        {section.collapsed && (
          <span className="feb-section__summary">
            {section.events.length} event{section.events.length !== 1 ? 's' : ''}
            {condOn ? ' · conditioned' : ''}
          </span>
        )}
        {runSection === 'passed' && <RunChip tone="passed"><Check size={10} /> passed</RunChip>}
        {runSection === 'skipped' && <RunChip tone="skipped">condition not met</RunChip>}
        {runSection === 'running' && <RunChip tone="running"><LoaderCircle size={10} className="feb-spin" /> running</RunChip>}
        <div className="feb-section__tools">
          <button
            className={`feb-cond-toggle ${condOn ? 'feb-cond-toggle--on' : ''}`}
            title={condOn ? 'Remove section condition' : 'Gate this whole section on a condition'}
            onClick={() => onPatch({ condition: condOn ? undefined : '{{record.status = \'pending\'}}' })}
          >
            <GitBranch size={11} /> {condOn ? 'Conditioned' : 'Condition'}
          </button>
          <button
            className="feb-icon-btn"
            title={section.collapsed ? 'Expand section' : 'Collapse section'}
            onClick={() => onPatch({ collapsed: !section.collapsed })}
          >
            {section.collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          </button>
          <button className="feb-icon-btn" disabled={index === 0} onClick={() => onMove(-1)} title="Move section up"><MoveUp size={12} /></button>
          <button className="feb-icon-btn" disabled={index === total - 1} onClick={() => onMove(1)} title="Move section down"><MoveDown size={12} /></button>
          <button className="feb-icon-btn feb-icon-btn--danger" onClick={onDelete} title="Delete section"><Trash2 size={12} /></button>
        </div>
      </div>

      {!section.collapsed && (
        <>
          {condOn && (
            <div className="feb-section__cond">
              <span className="feb-section__cond-label">Condition</span>
              <input
                className="feb-input feb-input--mono"
                value={section.condition || ''}
                onChange={(e) => onPatch({ condition: e.target.value })}
                placeholder="{{record.status = 'pending'}}"
              />
            </div>
          )}

          <div className="feb-events">
            {section.events.length === 0 && (
              <p className="feb-events__empty">No events in this section. Click “Add Event”.</p>
            )}
            {section.events.map((ev, ei) => {
              const def = EVENT_DEFS[ev.type];
              const status = eventStatus[ev.id] || 'idle';
              const expanded = expandedEventId === ev.id;
              return (
                <div key={ev.id} className={`feb-event ${expanded ? 'feb-event--expanded' : ''} ${status === 'done' ? 'feb-event--done' : ''} ${status === 'running' ? 'feb-event--running' : ''}`}>
                  <div className="feb-event__head" onClick={() => onExpandEvent(expanded ? null : ev.id)}>
                    <span className="feb-event__icon" style={{ background: `${def.color}22`, color: def.color }}>{<def.Icon size={13} />}</span>
                    <span className="feb-event__label">{ev.label}</span>
                    {ev.condition && <span className="feb-event__chip feb-event__chip--cond"><GitBranch size={9} /> cond</span>}
                    {ev.storeAs && <span className="feb-event__chip feb-event__chip--store"><Braces size={9} /> {ev.storeAs}</span>}
                    {status === 'running' && <LoaderCircle size={12} className="feb-spin feb-event__runstate" />}
                    {status === 'done' && <CircleCheck size={12} className="feb-event__runstate feb-event__runstate--done" />}
                    {status === 'skipped' && <span className="feb-event__runstate feb-event__runstate--skipped">skipped</span>}
                    <span className="feb-event__type">{def.label}</span>
                    <div className="feb-event__tools" onClick={(e) => e.stopPropagation()}>
                      <button className="feb-icon-btn" disabled={ei === 0} onClick={() => onMoveEvent(ev.id, -1)} title="Move up"><MoveUp size={11} /></button>
                      <button className="feb-icon-btn" disabled={ei === section.events.length - 1} onClick={() => onMoveEvent(ev.id, 1)} title="Move down"><MoveDown size={11} /></button>
                      <button className="feb-icon-btn feb-icon-btn--danger" onClick={() => onDeleteEvent(ev.id)} title="Delete event"><X size={11} /></button>
                    </div>
                    {expanded ? <ChevronDown size={13} className="feb-event__chev" /> : <ChevronRight size={13} className="feb-event__chev" />}
                  </div>
                  {expanded && <EventConfigPanel event={ev} onPatch={(patch) => onPatchEvent(ev.id, patch)} />}
                </div>
              );
            })}
          </div>

          <div className="feb-add-event">
            <button className="feb-btn feb-btn--dashed feb-btn--sm" onClick={() => setMenuOpen((o) => !o)}>
              <Plus size={12} /> Add Event
            </button>
            {menuOpen && (
              <div className="feb-add-menu">
                {EVENT_TYPE_ORDER.map((t) => {
                  const d = EVENT_DEFS[t];
                  return (
                    <button
                      key={t}
                      className="feb-add-menu__item"
                      onClick={() => {
                        onAddEvent(t);
                        setMenuOpen(false);
                      }}
                    >
                      <span className="feb-event__icon" style={{ background: `${d.color}22`, color: d.color }}>{<d.Icon size={12} />}</span>
                      <span className="feb-add-menu__info">
                        <span className="feb-add-menu__name">{d.label}</span>
                        <span className="feb-add-menu__desc">{d.desc}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────

const FormEventBuilder: React.FC = () => {
  const [actions, setActions] = useState<FormAction[]>(buildMockActions);
  const [selectedId, setSelectedId] = useState<string>(() => '');
  const [runState, setRunState] = useState<RunState>('idle');
  const [stepIndex, setStepIndex] = useState(-1);
  const [eventStatus, setEventStatus] = useState<Record<string, EventRunStatus>>({});
  const [sectionRun, setSectionRun] = useState<Record<string, 'idle' | 'passed' | 'skipped' | 'running'>>({});
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pvOpen, setPvOpen] = useState(true);
  const [secOpen, setSecOpen] = useState(true);

  const action = actions.find((a) => a.id === selectedId) || null;
  const initialSelectedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!initialSelectedRef.current && actions.length > 0) {
      initialSelectedRef.current = actions[0].id;
      setSelectedId(actions[0].id);
    }
  }, [actions]);

  useEffect(() => {
    setExpandedEventId(null);
    setPreviewOpen(false);
    resetRun();
  }, [selectedId]);

  const resetRun = () => {
    setRunState('idle');
    setStepIndex(-1);
    setEventStatus({});
    setSectionRun({});
  };

  const updateAction = (patch: Partial<FormAction>) => {
    setActions((prev) => prev.map((a) => (a.id === selectedId ? { ...a, ...patch } : a)));
  };

  const addAction = () => {
    const na: FormAction = {
      id: uid('act'),
      label: 'New Action',
      variant: 'secondary',
      iconName: 'Zap',
      visible: true,
      preValidations: [],
      sections: [{ id: uid('sec'), events: [] }],
    };
    setActions((prev) => [...prev, na]);
    setSelectedId(na.id);
  };

  const deleteAction = (id: string) => {
    setActions((prev) => {
      const next = prev.filter((a) => a.id !== id);
      if (id === selectedId) setSelectedId(next[0]?.id || '');
      return next;
    });
  };

  const addSection = () => {
    if (!action) return;
    updateAction({ sections: [...action.sections, { id: uid('sec'), events: [] }] });
  };

  const updateSection = (sectionId: string, patch: Partial<ActionSection>) => {
    if (!action) return;
    updateAction({ sections: action.sections.map((s) => (s.id === sectionId ? { ...s, ...patch } : s)) });
  };

  const moveSection = (sectionId: string, dir: -1 | 1) => {
    if (!action) return;
    const idx = action.sections.findIndex((s) => s.id === sectionId);
    const next = [...action.sections];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    updateAction({ sections: next });
  };

  const deleteSection = (sectionId: string) => {
    if (!action) return;
    updateAction({ sections: action.sections.filter((s) => s.id !== sectionId) });
  };

  const addEvent = (sectionId: string, type: EventType) => {
    if (!action) return;
    const n: FormEvent = {
      id: uid('ev'),
      type,
      label: type === 'record' ? 'Record update'
        : type === 'expression' ? 'Compute value'
        : type === 'script' ? 'Run script'
        : 'Send notification',
      config: type === 'record' ? { operation: 'update', mappings: [{ fieldId: MOCK_LEADS_FIELDS[0].id, value: '' }] }
        : type === 'notification' ? { templateId: MOCK_TEMPLATES[0].id, channel: 'email', to: '' }
        : type === 'script' ? { scriptId: MOCK_SCRIPTS[0].id, timeoutMs: 10000 }
        : { expression: '' },
    };
    updateAction({
      sections: action.sections.map((s) => (s.id === sectionId ? { ...s, events: [...s.events, n] } : s)),
    });
    setExpandedEventId(n.id);
  };

  const updateEvent = (sectionId: string, eventId: string, patch: Partial<FormEvent>) => {
    if (!action) return;
    updateAction({
      sections: action.sections.map((s) =>
        s.id === sectionId
          ? { ...s, events: s.events.map((e) => (e.id === eventId ? { ...e, ...patch } : e)) }
          : s
      ),
    });
  };

  const moveEvent = (sectionId: string, eventId: string, dir: -1 | 1) => {
    if (!action) return;
    updateAction({
      sections: action.sections.map((s) => {
        if (s.id !== sectionId) return s;
        const idx = s.events.findIndex((e) => e.id === eventId);
        const next = [...s.events];
        const j = idx + dir;
        if (j < 0 || j >= next.length) return s;
        [next[idx], next[j]] = [next[j], next[idx]];
        return { ...s, events: next };
      }),
    });
  };

  const deleteEvent = (sectionId: string, eventId: string) => {
    if (!action) return;
    updateAction({
      sections: action.sections.map((s) =>
        s.id === sectionId ? { ...s, events: s.events.filter((e) => e.id !== eventId) } : s
      ),
    });
    if (expandedEventId === eventId) setExpandedEventId(null);
  };

  // ── Run simulation ──
  const steps = useMemo(() => {
    if (!action) return [];
    const out: { sectionId: string; eventId: string; skipped: boolean; firstInSection: boolean }[] = [];
    for (const s of action.sections) {
      const skipped = s.condition ? !mockEval(s.condition, MOCK_RECORD) : false;
      s.events.forEach((e, i) => out.push({ sectionId: s.id, eventId: e.id, skipped, firstInSection: i === 0 }));
    }
    return out;
  }, [action]);

  const startRun = () => {
    setEventStatus({});
    setSectionRun({});
    setStepIndex(0);
    setRunState('running');
    setPreviewOpen(true);
  };

  useEffect(() => {
    if (runState !== 'running') return;
    if (stepIndex >= steps.length) {
      setRunState('completed');
      return;
    }
    const step = steps[stepIndex];
    const t1 = window.setTimeout(() => {
      setEventStatus((prev) => ({ ...prev, [step.eventId]: step.skipped ? 'skipped' : 'running' }));
      if (step.firstInSection) {
        setSectionRun((prev) => ({ ...prev, [step.sectionId]: step.skipped ? 'skipped' : 'running' }));
      }
    }, 80);
    const t2 = window.setTimeout(() => {
      setEventStatus((prev) => ({ ...prev, [step.eventId]: step.skipped ? 'skipped' : 'done' }));
      if (step.firstInSection) {
        setSectionRun((prev) => ({ ...prev, [step.sectionId]: step.skipped ? 'skipped' : 'passed' }));
      }
      setStepIndex((i) => i + 1);
    }, 700);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [runState, stepIndex, steps]);

  const totalEvents = action ? action.sections.reduce((n, s) => n + s.events.length, 0) : 0;
  const doneCount = action
    ? action.sections.reduce((n, s) => n + s.events.filter((e) => eventStatus[e.id] === 'done').length, 0)
    : 0;
  const skippedCount = action
    ? action.sections.reduce((n, s) => n + s.events.filter((e) => eventStatus[e.id] === 'skipped').length, 0)
    : 0;

  return (
    <div className="feb-root">
      <header className="feb-toolbar">
        <span className="feb-brand"><Sparkles size={15} /> Sails</span>
        <h1 className="feb-title">Form Event Builder</h1>
        <span className="feb-badge">compact · Layout Studio</span>
        <div className="feb-toolbar__actions">
          <span className="feb-toolbar__hint">Fits the right config panel (~420px)</span>
          <button className="feb-btn feb-btn--ghost" onClick={() => { setActions(buildMockActions()); resetRun(); }}>
            <RotateCcw size={13} /> Reset
          </button>
          <button className="feb-btn feb-btn--primary"><Check size={13} /> Save Layout</button>
        </div>
      </header>

      <div className="feb-body">
        <main className="feb-center feb-center--compact">
          {/* ── Action chips strip ── */}
          <div className="feb-card">
            <div className="feb-card__header">
              <MousePointerClick size={13} />
              <span className="feb-card__title">Action Buttons</span>
              <span className="feb-card__badge">{actions.length}</span>
              <span className="feb-card__hint">Header buttons on the Detail View</span>
              <button className="feb-btn feb-btn--mini feb-btn--ghost" style={{ marginLeft: 'auto' }} onClick={addAction}>
                <Plus size={11} /> Add
              </button>
            </div>
            <div className="feb-chip-strip">
              {actions.map((a) => (
                <div
                  key={a.id}
                  className={`feb-chip ${a.id === selectedId ? 'feb-chip--selected' : ''}`}
                  onClick={() => setSelectedId(a.id)}
                >
                  <span className="feb-chip__icon"><ActionIcon name={a.iconName} size={12} /></span>
                  <span className="feb-chip__label">{a.label}</span>
                  <span className={`feb-chip__variant feb-chip__variant--${a.variant}`}>{a.variant}</span>
                  <button
                    className="feb-chip__del"
                    title="Delete action"
                    onClick={(e) => { e.stopPropagation(); deleteAction(a.id); }}
                  ><X size={10} /></button>
                </div>
              ))}
            </div>
          </div>

          {!action ? (
            <div className="feb-empty">
              <MousePointerClick size={28} className="feb-empty__icon" />
              <p className="feb-empty__title">Select or create an action button</p>
              <p className="feb-empty__sub">Configure its pre-validations and event sections here.</p>
            </div>
          ) : (
            <>
              {/* ── Selected action: button props ── */}
              <div className="feb-card">
                <div className="feb-card__header">
                  <Settings size={13} />
                  <span className="feb-card__title">{action.label}</span>
                  <button
                    className="feb-btn feb-btn--mini feb-btn--ghost"
                    style={{ marginLeft: 'auto' }}
                    onClick={() => setPreviewOpen((o) => !o)}
                  >
                    {previewOpen ? <EyeOff size={11} /> : <Eye size={11} />} Preview
                  </button>
                  <a className="feb-builder-link" href="/form-event-builder" title="Open in full builder">
                    <ExternalLink size={11} /> Builder
                  </a>
                </div>
                <div className="feb-grid feb-grid--4">
                  <label className="feb-field feb-field--wide">
                    <span className="feb-field__label">Label</span>
                    <input className="feb-input" value={action.label} onChange={(e) => updateAction({ label: e.target.value })} />
                  </label>
                  <label className="feb-field">
                    <span className="feb-field__label">Variant</span>
                    <select className="feb-input" value={action.variant} onChange={(e) => updateAction({ variant: e.target.value as ButtonVariant })}>
                      {VARIANT_OPTIONS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
                    </select>
                  </label>
                  <label className="feb-field">
                    <span className="feb-field__label">Icon</span>
                    <select className="feb-input" value={action.iconName} onChange={(e) => updateAction({ iconName: e.target.value })}>
                      {ACTION_ICON_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </label>
                  <label className="feb-field feb-field--wide">
                    <span className="feb-field__label">Visibility</span>
                    <div className="feb-seg">
                      <button
                        className={`feb-seg__btn ${action.visible ? 'feb-seg__btn--on' : ''}`}
                        onClick={() => updateAction({ visible: true })}
                      ><Eye size={12} /> Visible</button>
                      <button
                        className={`feb-seg__btn ${!action.visible ? 'feb-seg__btn--on' : ''}`}
                        onClick={() => updateAction({ visible: false })}
                      ><EyeOff size={12} /> Hidden</button>
                    </div>
                  </label>
                </div>
              </div>

              {/* ── Pre-validations accordion ── */}
              <div className="feb-card">
                <div className="feb-card__header feb-acc__head" onClick={() => setPvOpen((o) => !o)}>
                  <ShieldAlert size={13} />
                  <span className="feb-card__title">Pre-Validations</span>
                  <span className="feb-card__badge">{action.preValidations.length}</span>
                  <span className="feb-card__hint">Gate the whole chain — failure stops it</span>
                  {pvOpen ? <ChevronDown size={13} className="feb-acc__chev" /> : <ChevronRight size={13} className="feb-acc__chev" />}
                </div>
                {pvOpen && (
                  <>
                    <div className="feb-validations">
                      {action.preValidations.length === 0 && (
                        <p className="feb-events__empty">No pre-validations — the chain runs immediately on click.</p>
                      )}
                      {action.preValidations.map((pv) => (
                        <div key={pv.id} className="feb-validation">
                          <select
                            className="feb-input"
                            value={pv.fieldId}
                            onChange={(e) => updateAction({ preValidations: action.preValidations.map((p) => p.id === pv.id ? { ...p, fieldId: e.target.value } : p) })}
                          >
                            {MOCK_LEADS_FIELDS.filter((f) => !f.isSystem).map((f) => (
                              <option key={f.id} value={f.id}>{f.name}</option>
                            ))}
                          </select>
                          <select
                            className="feb-input"
                            value={pv.rule}
                            onChange={(e) => updateAction({ preValidations: action.preValidations.map((p) => p.id === pv.id ? { ...p, rule: e.target.value } : p) })}
                          >
                            {VALIDATION_RULES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                          </select>
                          <input
                            className="feb-input"
                            placeholder="value"
                            value={pv.value || ''}
                            onChange={(e) => updateAction({ preValidations: action.preValidations.map((p) => p.id === pv.id ? { ...p, value: e.target.value } : p) })}
                          />
                          <input
                            className="feb-input feb-input--wide"
                            placeholder="Failure message"
                            value={pv.message}
                            onChange={(e) => updateAction({ preValidations: action.preValidations.map((p) => p.id === pv.id ? { ...p, message: e.target.value } : p) })}
                          />
                          <button
                            className="feb-icon-btn feb-icon-btn--danger"
                            onClick={() => updateAction({ preValidations: action.preValidations.filter((p) => p.id !== pv.id) })}
                          ><X size={11} /></button>
                        </div>
                      ))}
                    </div>
                    <button
                      className="feb-btn feb-btn--mini feb-btn--ghost"
                      style={{ alignSelf: 'flex-start' }}
                      onClick={() => updateAction({ preValidations: [...action.preValidations, { id: uid('pv'), fieldId: MOCK_LEADS_FIELDS[0].id, rule: 'required', message: '' }] })}
                    ><Plus size={11} /> Add rule</button>
                  </>
                )}
              </div>

              {/* ── Event sections accordion ── */}
              <div className="feb-card">
                <div className="feb-card__header feb-acc__head" onClick={() => setSecOpen((o) => !o)}>
                  <GitBranch size={13} />
                  <span className="feb-card__title">Event Sections</span>
                  <span className="feb-card__badge">{action.sections.length}</span>
                  <span className="feb-card__hint">Top-to-bottom · false condition skips a section</span>
                  <div className="feb-card__header-tools" onClick={(e) => e.stopPropagation()}>
                    <button className="feb-btn feb-btn--mini feb-btn--ghost" onClick={addSection}>
                      <Plus size={11} /> Add Section
                    </button>
                  </div>
                  {secOpen ? <ChevronDown size={13} className="feb-acc__chev" /> : <ChevronRight size={13} className="feb-acc__chev" />}
                </div>
                {secOpen && (
                  <div className="feb-sections">
                    {action.sections.map((s, si) => (
                      <CompactSection
                        key={s.id}
                        section={s}
                        index={si}
                        total={action.sections.length}
                        runSection={sectionRun[s.id] || 'idle'}
                        eventStatus={eventStatus}
                        expandedEventId={expandedEventId}
                        onExpandEvent={setExpandedEventId}
                        onPatch={(patch) => updateSection(s.id, patch)}
                        onMove={(dir) => moveSection(s.id, dir)}
                        onDelete={() => deleteSection(s.id)}
                        onAddEvent={(type) => addEvent(s.id, type)}
                        onPatchEvent={(eid, patch) => updateEvent(s.id, eid, patch)}
                        onMoveEvent={(eid, dir) => moveEvent(s.id, eid, dir)}
                        onDeleteEvent={(eid) => deleteEvent(s.id, eid)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* ── Run bar ── */}
              <div className="feb-runbar">
                {runState === 'idle' && (
                  <button className="feb-btn feb-btn--primary feb-btn--sm" onClick={startRun}>
                    <Play size={12} /> Run Simulation
                  </button>
                )}
                {runState === 'running' && (
                  <button className="feb-btn feb-btn--sm" disabled>
                    <LoaderCircle size={12} className="feb-spin" /> Running {doneCount}/{totalEvents || steps.length}…
                  </button>
                )}
                {runState === 'completed' && (
                  <div className={`feb-banner feb-banner--${skippedCount > 0 ? 'warn' : 'ok'}`} style={{ flex: 1 }}>
                    {skippedCount > 0 ? (
                      <><CircleAlert size={13} /> {doneCount} succeeded · {skippedCount} skipped by condition</>
                    ) : (
                      <><CircleCheck size={13} /> {doneCount} event{doneCount !== 1 ? 's' : ''} succeeded</>
                    )}
                  </div>
                )}
                {runState !== 'idle' && (
                  <button className="feb-btn feb-btn--ghost feb-btn--sm" onClick={resetRun}>
                    <RotateCcw size={12} /> Reset
                  </button>
                )}
              </div>

              {/* ── Inline preview ── */}
              {previewOpen && (
                <div className="feb-preview-inline">
                  <div className="feb-preview__record">
                    <div className="feb-preview__record-title">{MOCK_RECORD.lead_name}</div>
                    <div className="feb-preview__record-meta">Status: {MOCK_RECORD.status} · Budget: ฿{MOCK_RECORD.budget.toLocaleString()}</div>
                    <div className="feb-preview__actions">
                      <button className={`feb-preview-btn feb-preview-btn--${action.variant}`}>
                        <ActionIcon name={action.iconName} size={13} /> {action.label}
                      </button>
                      <span className="feb-preview-btn feb-preview-btn--ghost-ish">Edit</span>
                    </div>
                  </div>

                  <div className="feb-preview__chain">
                    {action.preValidations.length > 0 && (
                      <div className="feb-preview__gate">
                        <span className="feb-preview__gate-icon"><ShieldAlert size={12} /></span>
                        <span className="feb-preview__gate-label">Pre-validations ({action.preValidations.length})</span>
                        {runState !== 'idle' && (
                          <span className={`feb-run-chip ${runState === 'completed' ? 'feb-run-chip--passed' : 'feb-run-chip--running'}`}>
                            {runState === 'completed' ? <><Check size={10} /> passed</> : <><LoaderCircle size={10} className="feb-spin" /> checking</>}
                          </span>
                        )}
                      </div>
                    )}

                    {action.sections.map((s, si) => {
                      const skip = s.condition ? !mockEval(s.condition, MOCK_RECORD) : false;
                      return (
                        <div key={s.id} className={`feb-preview__section ${sectionRun[s.id] === 'skipped' ? 'feb-preview__section--skipped' : ''}`}>
                          <div className="feb-preview__section-head">
                            <span className="feb-preview__section-title">Section {si + 1}</span>
                            {s.condition && (
                              <span className="feb-preview__section-cond">
                                <GitBranch size={9} /> {s.condition}
                                {runState !== 'idle' && skip && <span className="feb-run-chip feb-run-chip--skipped">not met</span>}
                              </span>
                            )}
                            {runState === 'completed' && !skip && <span className="feb-run-chip feb-run-chip--passed"><Check size={10} /> passed</span>}
                          </div>
                          <div className="feb-preview__steps">
                            {s.events.map((e, ei) => {
                              const def = EVENT_DEFS[e.type];
                              const status = eventStatus[e.id] || 'idle';
                              return (
                                <div key={e.id} className="feb-preview__step">
                                  <span className="feb-preview__step-num">{ei + 1}</span>
                                  <span className="feb-preview__step-icon" style={{ background: `${def.color}22`, color: def.color }}>{<def.Icon size={12} />}</span>
                                  <span className="feb-preview__step-label">{e.label}</span>
                                  {e.storeAs && <span className="feb-event__chip feb-event__chip--store"><Braces size={9} /> {e.storeAs}</span>}
                                  <span className="feb-preview__step-status">
                                    {status === 'running' && <LoaderCircle size={12} className="feb-spin" />}
                                    {status === 'done' && <CircleCheck size={12} className="feb-ok" />}
                                    {status === 'skipped' && <span className="feb-skip-text">skipped</span>}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="feb-preview__hint">Simulated record: budget ฿250,000 — “Clone &amp; Notify” section 1 (budget &gt; 300,000) is skipped.</p>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default FormEventBuilder;
