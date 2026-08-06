import React from 'react';
import { Braces, Code2 } from 'lucide-react';
import { MOCK_MODELS, ROUTER_TYPES } from '../constants';
import type { WorkflowEvent, WorkflowVariable } from '../types';

export interface EventConfigFormProps {
  event: WorkflowEvent;
  variables: WorkflowVariable[];
  onUpdateLabel: (label: string) => void;
  onUpdateConfig: (patch: Record<string, any>) => void;
  onOpenExpressionModal: () => void;
}

/** Per-event-type configuration form rendered in the Stage properties panel. */
export const EventConfigForm: React.FC<EventConfigFormProps> = ({
  event, variables, onUpdateLabel, onUpdateConfig, onOpenExpressionModal,
}) => {
  return (
    <div className="rb2-form">
      <div className="rb2-form-row">
        <label className="rb2-label">Event Label</label>
        <input className="sails-input" value={event.label} onChange={(e) => onUpdateLabel(e.target.value)} />
      </div>

      {event.type === 'record' && (
        <>
          <div className="rb2-form-row">
            <label className="rb2-label">Target Model</label>
            <select className="sails-input" value={event.config.model || ''}
              onChange={(e) => onUpdateConfig({ model: e.target.value })}>
              {MOCK_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="rb2-form-row">
            <label className="rb2-label">Operation</label>
            <select className="sails-input" value={event.config.operation || 'update'}
              onChange={(e) => onUpdateConfig({ operation: e.target.value })}>
              {['create', 'read', 'update', 'delete'].map((op) => <option key={op} value={op}>{op}</option>)}
            </select>
          </div>
          <div className="rb2-form-row">
            <label className="rb2-label">Store result to variable</label>
            <select className="sails-input" value={event.config.storeToVariable || ''}
              onChange={(e) => onUpdateConfig({ storeToVariable: e.target.value })}>
              <option value="">— none —</option>
              {variables.map((v) => <option key={v.id} value={v.name}>{v.name}</option>)}
            </select>
          </div>
        </>
      )}

      {event.type === 'notification' && (
        <>
          <div className="rb2-form-row">
            <label className="rb2-label">Channel</label>
            <select className="sails-input" value={event.config.channel || 'bell'}
              onChange={(e) => onUpdateConfig({ channel: e.target.value })}>
              <option value="bell">Bell (in-app)</option>
              <option value="email">Email</option>
              <option value="both">Both</option>
            </select>
          </div>
          <div className="rb2-form-row">
            <label className="rb2-label">Recipients</label>
            <input className="sails-input" placeholder="user@x or {{variable}}" value={event.config.recipients || ''}
              onChange={(e) => onUpdateConfig({ recipients: e.target.value })} />
          </div>
          <div className="rb2-form-row">
            <label className="rb2-label">Subject</label>
            <input className="sails-input" value={event.config.subject || ''}
              onChange={(e) => onUpdateConfig({ subject: e.target.value })} />
          </div>
          <div className="rb2-form-row">
            <label className="rb2-label">Message</label>
            <textarea className="sails-input rb2-textarea" value={event.config.message || ''}
              onChange={(e) => onUpdateConfig({ message: e.target.value })} />
          </div>
        </>
      )}

      {event.type === 'approval' && (
        <>
          <div className="rb2-form-row">
            <label className="rb2-label">Assign To (router)</label>
            <select className="sails-input" value={event.config.routerType || 'role'}
              onChange={(e) => onUpdateConfig({ routerType: e.target.value })}>
              {ROUTER_TYPES.map((r) => <option key={r.type} value={r.type}>{r.label}</option>)}
            </select>
          </div>
          <div className="rb2-form-row">
            <label className="rb2-label">Router Value</label>
            <input className="sails-input" value={event.config.routerValue || ''}
              onChange={(e) => onUpdateConfig({ routerValue: e.target.value })} />
          </div>
          <div className="rb2-form-row">
            <label className="rb2-label">Display Label</label>
            <input className="sails-input" value={event.config.routerLabel || ''}
              onChange={(e) => onUpdateConfig({ routerLabel: e.target.value })} />
          </div>
          <div className="rb2-form-row rb2-check-row">
            <label className="rb2-check"><input type="checkbox" checked={!!event.config.canApprove}
              onChange={(e) => onUpdateConfig({ canApprove: e.target.checked })} /> Approve</label>
            <label className="rb2-check"><input type="checkbox" checked={!!event.config.canReject}
              onChange={(e) => onUpdateConfig({ canReject: e.target.checked })} /> Reject</label>
          </div>
          <div className="rb2-form-row">
            <label className="rb2-label">Timeout (hours)</label>
            <input className="sails-input" type="number" min={0} value={event.config.timeoutHours ?? ''}
              placeholder="No timeout"
              onChange={(e) => onUpdateConfig({ timeoutHours: e.target.value ? Number(e.target.value) : null })} />
          </div>
        </>
      )}

      {(event.type === 'expression' || event.type === 'transform') && (
        <div className="rb2-form-row">
          <label className="rb2-label">JSONata Expression</label>
          <button type="button" className="rb2-expr-btn" onClick={onOpenExpressionModal}>
            <span className="rb2-expr-btn__icon" style={{ color: event.type === 'expression' ? '#a855f7' : '#0ea5e9' }}>
              {event.type === 'expression' ? <Code2 size={13} /> : <Braces size={13} />}
            </span>
            <span className="rb2-expr-btn__main">
              <span className="rb2-expr-btn__title">{event.type === 'expression' ? 'Open Expression Editor' : 'Open JSONata Editor'}</span>
              <span className="rb2-expr-btn__preview">
                {event.config.expression
                  ? <code>{event.config.expression}</code>
                  : <em>No expression set — click to open the editor</em>}
              </span>
            </span>
            <span className="rb2-expr-btn__chevron">›</span>
          </button>
          <div className="rb2-form-row">
            <label className="rb2-label">Assign result to</label>
            <select className="sails-input" value={event.config.assignToVariable || ''}
              onChange={(e) => onUpdateConfig({ assignToVariable: e.target.value })}>
              <option value="">— none —</option>
              {variables.map((v) => <option key={v.id} value={v.name}>{v.name}</option>)}
            </select>
          </div>
          {event.type === 'transform' && (
            <p className="rb2-hint">Type <code>$</code> for JSONata function suggestions; use <strong>Test</strong> in the editor to run against sample values.</p>
          )}
        </div>
      )}

      {event.type === 'script' && (
        <>
          <div className="rb2-form-row">
            <label className="rb2-label">BYOC Script</label>
            <select className="sails-input" value={event.config.scriptId || ''}
              onChange={(e) => onUpdateConfig({ scriptId: e.target.value, scriptName: e.target.value })}>
              <option value="">— select a BYOC script —</option>
              <option value="scr_risk_score">Calculate Risk Score</option>
              <option value="scr_erp_sync">Send to ERP</option>
              <option value="scr_compliance">Validate Compliance</option>
            </select>
          </div>
          <div className="rb2-form-row">
            <label className="rb2-label">Timeout (ms)</label>
            <input className="sails-input" type="number" min={100} step={100} value={event.config.timeoutMs ?? 5000}
              onChange={(e) => onUpdateConfig({ timeoutMs: e.target.value ? Number(e.target.value) : 5000 })} />
          </div>
          <p className="rb2-hint">Runs the script in a sandbox with <code>ctx</code> + <code>sails</code> SDK. Scripts are managed in Custom Modules (BYOC).</p>
        </>
      )}
      <p className="rb2-hint">Events run when the record enters this stage. Reference variables with {'{{name}}'}.</p>
    </div>
  );
};

export default EventConfigForm;
