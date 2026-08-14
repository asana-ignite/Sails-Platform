/**
 * EventConfigPanel — per-type configuration editor for a FormEvent.
 * Rendered in the Layout Studio right properties panel when an event is
 * selected in the Events tab.
 */
import React from 'react';
import { Plus, X } from 'lucide-react';
import type { SailsFieldDefinition, FormEvent } from '@sails/shared';
import ExpressionEditor from '../../components/workflow/ExpressionEditor';
import { MOCK_SCRIPTS, MOCK_TEMPLATES } from './index';

interface EventConfigPanelProps {
  event: FormEvent;
  fields: SailsFieldDefinition[];
  onPatch: (patch: Partial<FormEvent>) => void;
  /** JSONata intellisense context — model column suggestions (record.<field>). */
  recordSchemas?: Record<string, { fieldName: string; label: string; logicalType: string; targetModel?: string }[]>;
  drillRoots?: Record<string, { fieldName: string; label: string; logicalType: string; targetModel?: string }[]>;
  triggerModelName?: string;
  sample?: Record<string, any>;
}

export const EventConfigPanel: React.FC<EventConfigPanelProps> = ({
  event,
  fields,
  onPatch,
  recordSchemas,
  drillRoots,
  triggerModelName,
  sample,
}) => {
  const usableFields = fields.filter((f) => !f.isSystem);
  const patchConfig = (config: Record<string, any>) => onPatch({ config: { ...event.config, ...config } });

  return (
    <div className="ls-evt-config">
      <div className="ls-prop-group">
        <label className="ls-prop-label">Label</label>
        <input className="sails-input" value={event.label} onChange={(e) => onPatch({ label: e.target.value })} />
      </div>

      <div className="ls-prop-group">
        <label className="ls-prop-label">Store result as (variable)</label>
        <input
          className="sails-input"
          value={event.storeAs || ''}
          placeholder="myVar — optional"
          onChange={(e) => onPatch({ storeAs: e.target.value || undefined })}
        />
        <p className="ls-prop-hint">Downstream events can reference the value via <code>variables.{event.storeAs || '…'}</code>.</p>
      </div>

      <div className="ls-prop-group">
        <label className="ls-prop-label">Condition (JSONata)</label>
        <ExpressionEditor
          compact
          hideVariablePicker
          variables={[]}
          recordSchemas={recordSchemas}
          drillRoots={drillRoots}
          triggerModelName={triggerModelName}
          value={event.condition || ''}
          onChange={(v) => onPatch({ condition: v || undefined })}
          sample={sample}
          placeholder="record.budget > 100000"
        />
        <p className="ls-prop-hint">Skips this event when the expression evaluates false.</p>
      </div>

      {event.type === 'record' && (
        <>
          <div className="ls-prop-group">
            <label className="ls-prop-label">Operation</label>
            <select
              className="sails-input"
              value={event.config.operation || 'update'}
              onChange={(e) => patchConfig({ operation: e.target.value })}
            >
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="upsert">Upsert</option>
              <option value="delete">Delete</option>
            </select>
          </div>
          {event.config.operation !== 'create' && event.config.operation !== 'delete' && (
            <div className="ls-prop-group">
              <label className="ls-prop-label">Field mapping</label>
              {(event.config.mappings || []).map((m: any, mi: number) => (
                <div key={mi} className="ls-evt-mapping">
                  <select
                    className="sails-input"
                    value={m.fieldId}
                    onChange={(e) => {
                      const mappings = [...(event.config.mappings || [])];
                      mappings[mi] = { ...mappings[mi], fieldId: e.target.value };
                      patchConfig({ mappings });
                    }}
                  >
                    <option value="">— field —</option>
                    {usableFields.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                  <input
                    className="sails-input"
                    value={m.value || ''}
                    placeholder="value"
                    onChange={(e) => {
                      const mappings = [...(event.config.mappings || [])];
                      mappings[mi] = { ...mappings[mi], value: e.target.value };
                      patchConfig({ mappings });
                    }}
                  />
                  <button
                    className="ls-block__btn ls-block__btn--danger"
                    title="Remove mapping"
                    onClick={() => {
                      const mappings = (event.config.mappings || []).filter((_: any, i: number) => i !== mi);
                      patchConfig({ mappings });
                    }}
                  ><X size={11} /></button>
                </div>
              ))}
              <button
                className="sails-btn sails-btn--ghost sails-btn--sm"
                onClick={() => {
                  const mappings = [...(event.config.mappings || []), { fieldId: usableFields[0]?.id || '', value: '' }];
                  patchConfig({ mappings });
                }}
                style={{ marginTop: 6 }}
              >
                <Plus size={11} /> Add field
              </button>
            </div>
          )}
        </>
      )}

      {event.type === 'expression' && (
        <div className="ls-prop-group">
          <label className="ls-prop-label">JSONata expression</label>
          <textarea
            className="sails-input"
            rows={4}
            style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11, resize: 'vertical' }}
            value={event.config.expression || ''}
            onChange={(e) => patchConfig({ expression: e.target.value })}
            placeholder="record.budget * 1.07"
          />
          <p className="ls-prop-hint">Available: <code>record</code> (current values), <code>variables</code> (prior events), <code>request_date</code>.</p>
        </div>
      )}

      {event.type === 'script' && (
        <>
          <div className="ls-prop-group">
            <label className="ls-prop-label">BYOC script</label>
            <select
              className="sails-input"
              value={event.config.scriptId || MOCK_SCRIPTS[0].id}
              onChange={(e) => patchConfig({ scriptId: e.target.value })}
            >
              {MOCK_SCRIPTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="ls-prop-group">
            <label className="ls-prop-label">Timeout (ms)</label>
            <input
              className="sails-input"
              type="number"
              min={500}
              step={500}
              value={event.config.timeoutMs ?? 10000}
              onChange={(e) => patchConfig({ timeoutMs: Number(e.target.value) })}
            />
          </div>
        </>
      )}

      {event.type === 'notification' && (
        <>
          <div className="ls-prop-group">
            <label className="ls-prop-label">Template</label>
            <select
              className="sails-input"
              value={event.config.templateId || ''}
              onChange={(e) => patchConfig({ templateId: e.target.value })}
            >
              <option value="">— template —</option>
              {MOCK_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="ls-prop-group">
            <label className="ls-prop-label">Channel</label>
            <select
              className="sails-input"
              value={event.config.channel || 'email'}
              onChange={(e) => patchConfig({ channel: e.target.value })}
            >
              <option value="email">Email</option>
              <option value="slack">Slack</option>
              <option value="both">Email + Slack</option>
            </select>
          </div>
          <div className="ls-prop-group">
            <label className="ls-prop-label">Recipients</label>
            <input
              className="sails-input"
              value={event.config.to || ''}
              placeholder="{{record.email}}, manager@sails.app"
              onChange={(e) => patchConfig({ to: e.target.value })}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default EventConfigPanel;
