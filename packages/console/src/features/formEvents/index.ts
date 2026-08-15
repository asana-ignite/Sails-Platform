/**
 * Form Events — shared constants + editors for action-button event chains.
 *
 * Event types mirror the workflow event plugins (record / expression / script /
 * notification — approval is excluded: it needs a task lifecycle that does not
 * fit an inline click chain). Used by the Layout Studio Events tab and by the
 * standalone Form Event Builder mockup.
 */
import React from 'react';
import {
  Zap, Database, Code, Workflow as WorkflowIcon, Bell, CircleCheck, CircleX,
  Send, Copy, Archive, Download, Printer, KeyRound, MessageSquare,
  Info, CheckCircle2, AlertTriangle, AlertOctagon, XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { FormEvent, ActionSection } from '@sails/shared';

export type FormEventType = 'record' | 'expression' | 'script' | 'notification' | 'notification_message';
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export interface EventTypeDef {
  label: string;
  desc: string;
  Icon: LucideIcon;
  color: string;
}

export const EVENT_TYPE_ORDER: FormEventType[] = ['record', 'expression', 'script', 'notification', 'notification_message'];

export const EVENT_DEFS: Record<FormEventType, EventTypeDef> = {
  record:       { label: 'Record Event',    desc: 'Create / Update / Delete', Icon: Database,     color: '#3b82f6' },
  expression:   { label: 'Expression',      desc: 'JSONata computation',       Icon: Code,        color: '#a855f7' },
  script:       { label: 'Script',          desc: 'BYOC script (sandbox)',     Icon: WorkflowIcon, color: '#8b5cf6' },
  notification: { label: 'Notification',    desc: 'Email / Slack',             Icon: Bell,        color: '#f59e0b' },
  notification_message: { label: 'Notification Message', desc: 'Modal confirm / alert', Icon: MessageSquare, color: '#0ea5e9' },
};

/**
 * Notification Message severity styles — the icon + color shown on the modal
 * and in the config picker (extensible: add a key here and both surfaces
 * follow).
 */
export interface NotificationTypeDef {
  label: string;
  Icon: LucideIcon;
  color: string;
}

export const NOTIFICATION_TYPES: Record<string, NotificationTypeDef> = {
  information: { label: 'Information', Icon: Info,         color: '#3b82f6' },
  success:     { label: 'Success',     Icon: CheckCircle2, color: '#10b981' },
  warning:     { label: 'Warning',     Icon: AlertTriangle, color: '#f59e0b' },
  caution:     { label: 'Caution',     Icon: AlertOctagon, color: '#f97316' },
  error:       { label: 'Error',       Icon: XCircle,      color: '#ef4444' },
};

export const NOTIFICATION_TYPE_ORDER = Object.keys(NOTIFICATION_TYPES);

export const ACTION_ICON_OPTIONS: { value: string; label: string; Icon: LucideIcon }[] = [
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

export const VARIANT_OPTIONS: { value: ButtonVariant; label: string }[] = [
  { value: 'primary', label: 'Primary' },
  { value: 'secondary', label: 'Secondary' },
  { value: 'danger', label: 'Danger' },
  { value: 'ghost', label: 'Ghost' },
];

/**
 * Curated icon set for action buttons — canonical lucide names (aliases also
 * work). Kept small so the picker stays scannable; chips/preview render any
 * valid name via DynamicIcon, so adding a name here is always safe.
 */
export const ACTION_BUTTON_ICONS = [
  'Zap', 'CircleCheck', 'CircleX', 'Send', 'Copy', 'Archive', 'Download', 'Printer', 'KeyRound',
  'Plus', 'Check', 'X', 'Trash2', 'Pen', 'RefreshCw', 'Save', 'Play', 'Power', 'Undo2',
  'Mail', 'Bell', 'Phone', 'Share2',
  'Star', 'Heart', 'Flag', 'Shield', 'Lock', 'Eye', 'FileText', 'Calendar', 'Users',
  'Settings', 'ExternalLink',
];

export const VALIDATION_RULES = [
  { value: 'required', label: 'Is required' },
  { value: 'eq', label: 'Equals' },
  { value: 'neq', label: 'Not equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'gt', label: 'Greater than' },
  { value: 'gte', label: 'Greater / equal' },
  { value: 'lt', label: 'Less than' },
  { value: 'lte', label: 'Less / equal' },
];

export const MOCK_SCRIPTS = [
  { id: 'scr_send_confirmation', name: 'send_confirmation.ts' },
  { id: 'scr_calc_commission', name: 'calculate_commission.js' },
  { id: 'scr_sync_crm', name: 'sync_crm.ts' },
];

export const MOCK_TEMPLATES = [
  { id: 'tpl_approved', name: 'Lead Approved', subject: 'Your lead was approved' },
  { id: 'tpl_rejected', name: 'Lead Rejected', subject: 'Lead rejected — reason attached' },
  { id: 'tpl_big_deal', name: 'Large Deal Alert', subject: 'High-value deal needs attention' },
  { id: 'tpl_cloned', name: 'Record Cloned', subject: 'A copy of the record was created' },
];

export function defaultEventLabel(type: FormEventType): string {
  switch (type) {
    case 'record':              return 'Record update';
    case 'expression':          return 'Compute value';
    case 'script':              return 'Run script';
    case 'notification':        return 'Send notification';
    case 'notification_message': return 'Show notification message';
  }
}

/**
 * Record event config (plugin-compatible):
 *   operation: create | update | upsert | delete | read | list
 *   model: target tableName
 *   fieldMapping: [{ targetCol, source: 'record'|'variable'|'value'|'record_old'|'wf', sourceVar?, sourceField?, value? }]
 *   filterGroups: QueryStudio filters (batch read/update/delete)
 *   storeToVariable / FormEvent.storeAs: result binding
 *   formOutputMapping (Layout Studio): [{ sourceField, targetFieldId }] — map
 *     the result record's fields onto the layout's form controls at runtime.
 */
export function defaultEventConfig(type: FormEventType): Record<string, any> {
  switch (type) {
    case 'record':              return { operation: 'update', fieldMapping: [{ targetCol: '', source: 'record', sourceField: '' }] };
    case 'notification':        return { templateId: '', channel: 'email', to: '' };
    case 'script':              return { scriptId: '', timeoutMs: 10000 };
    case 'expression':          return { expression: '' };
    case 'notification_message': return {
      mode: 'confirm',
      notificationType: 'information',
      title: '',
      message: '',
      confirmLabel: 'Confirm',
      cancelLabel: 'Cancel',
      okLabel: 'OK',
    };
  }
}

export function defaultPreValidation(): { id: string; expression: string; message: string } {
  return { id: `pv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`, expression: '', message: '' };
}

export function newFormEvent(type: FormEventType, label?: string): FormEvent {
  return {
    id: `ev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    type,
    label: label || defaultEventLabel(type),
    config: defaultEventConfig(type),
  };
}

export function newActionSection(): ActionSection {
  return { id: `sec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`, events: [] };
}

export function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Mock condition evaluation for the studio's run simulation.
 * Supports numeric comparisons on record fields; anything unrecognised
 * evaluates to true (the chain proceeds).
 */
export function mockEval(cond: string | undefined, rec: Record<string, any>): boolean {
  if (!cond || !cond.trim()) return true;
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

export type EventRunStatus = 'idle' | 'running' | 'done' | 'skipped';
export type SectionRunStatus = 'idle' | 'passed' | 'skipped' | 'running';
