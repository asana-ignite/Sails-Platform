/**
 * EventConfigPanel — per-type summary + "Open Editor…" button for a FormEvent.
 *
 * All event configuration now happens in per-type MODALS (record / expression /
 * script / notification / notification_message), so this panel only shows the
 * event's label, type and a concise config summary. Events have no conditions.
 */
import React from 'react';
import type { FormVariable, SailsFieldDefinition, FormEvent } from '@sails/shared';
import { EVENT_DEFS, NOTIFICATION_TYPES } from './index';

interface EventConfigPanelProps {
  event: FormEvent;
  fields: SailsFieldDefinition[];
  onPatch: (patch: Partial<FormEvent>) => void;
  /** Open this event's configuration modal. */
  onOpenEditor?: () => void;
  /** JSONata intellisense context — model column suggestions (record.<field>). */
  recordSchemas?: Record<string, { fieldName: string; label: string; logicalType: string; targetModel?: string }[]>;
  drillRoots?: Record<string, { fieldName: string; label: string; logicalType: string; targetModel?: string }[]>;
  triggerModelName?: string;
  /** Layout-level form variables — constrains storeAs to declared names. */
  formVariables?: FormVariable[];
}

/** One-line config summary per event type (mirrors what the modal edits). */
function summaryFor(event: FormEvent): string {
  const config = event.config || {};
  switch (event.type) {
    case 'record': {
      const mappingCount = (config.fieldMapping || config.mappings || []).length;
      return `Operation: ${config.operation || 'update'} · ${mappingCount} mapping${mappingCount !== 1 ? 's' : ''}`;
    }
    case 'expression':
      return config.expression
        ? `JSONata: ${String(config.expression).slice(0, 80)}${String(config.expression).length > 80 ? '…' : ''}`
        : 'No expression set.';
    case 'script':
      return config.scriptId ? `BYOC script ${config.scriptId}` : 'No script selected.';
    case 'notification':
      return `Channel: ${config.channel || 'email'}${config.to ? ` · to ${config.to}` : ''}`;
    case 'notification_message': {
      const mode = config.mode === 'notification' ? 'Notification (OK)' : 'Confirmation (Confirm / Cancel)';
      const type = NOTIFICATION_TYPES[config.notificationType]?.label || 'Information';
      return `Mode: ${mode} · Type: ${type}`;
    }
    default:
      return '';
  }
}

export const EventConfigPanel: React.FC<EventConfigPanelProps> = ({
  event,
  fields: _fields,
  onPatch: _onPatch,
  onOpenEditor,
  recordSchemas: _recordSchemas,
  drillRoots: _drillRoots,
  triggerModelName: _triggerModelName,
  formVariables: _formVariables,
}) => {
  const def = EVENT_DEFS[event.type];
  const Icon = def.Icon;

  return (
    <div className="ls-evt-config">
      <div className="ls-prop__type">{def.label}</div>
      <div className="ls-prop-group">
        <label className="ls-prop-label">Label</label>
        <span className="ls-prop-hint" style={{ fontWeight: 500, color: 'var(--sails-text-main)' }}>{event.label}</span>
      </div>
      <div className="ls-prop-group">
        <button
          type="button"
          className="sails-btn sails-btn--ghost sails-btn--sm"
          onClick={onOpenEditor}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          <Icon size={12} /> Open Editor…
        </button>
        <p className="ls-prop-hint">{summaryFor(event)}</p>
      </div>
    </div>
  );
};

export default EventConfigPanel;
