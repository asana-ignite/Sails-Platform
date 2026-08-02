import React from 'react';
import type { SailsFieldDefinition } from '@sails/shared';
import { FieldControlRegistry } from './FieldControlRegistry';
import { ControlLazyBoundary } from './LazyRenderErrorBoundary';

// ── Shared control resolution ──────────────────────────────────
// Single source of truth for resolving a field to its control plugin.
// Used by both the real Detail View page and the Layout Studio canvas
// so previews render exactly like the front-end.

export function resolveControlPlugin(field: SailsFieldDefinition, controlPluginId?: string) {
  const controlRegistry = FieldControlRegistry.getInstance();
  const logicalType = field.logicalType || field.physicalType || 'text';
  const effectiveControlId = controlPluginId || (field?.config as any)?.defaultControl || (field?.config as any)?.controlStyle;
  const controlPlugin = (effectiveControlId ? controlRegistry.getControl(effectiveControlId) : null) || controlRegistry.getFallbackControl(logicalType);
  return { controlPlugin, logicalType, effectiveControlId };
}

// Realistic sample value for designer previews, delegated to each
// control plugin (falls back to a generic sample string).
export function mockFieldValue(field: SailsFieldDefinition, controlPluginId?: string): any {
  const { controlPlugin } = resolveControlPlugin(field, controlPluginId);
  if (controlPlugin.mockValue) return controlPlugin.mockValue(field);
  return `Sample ${field.name}`;
}

// ── Field label (exact front-end markup) ───────────────────────

export function DetailFieldLabel({ field, label }: { field: SailsFieldDefinition; label?: string }) {
  return (
    <label className="ls-block__label">
      {label || field.name}
      {field.isRequired && <span className="ls-block__required">*</span>}
    </label>
  );
}

// ── On-Edit control (exact front-end wrapper markup) ───────────

interface DetailFieldInputProps {
  field: SailsFieldDefinition;
  fieldKey: string;
  label: string;
  val: any;
  controlPluginId?: string;
  inert?: boolean; // designer mode: no onChange + pointer-events blocked
  onChange: (key: string, value: any) => void;
}

export const DetailFieldInput: React.FC<DetailFieldInputProps> = ({
  field, fieldKey, label, val, controlPluginId, inert, onChange,
}) => {
  const { controlPlugin } = resolveControlPlugin(field, controlPluginId);

  const inner = controlPlugin && controlPlugin.RenderEdit ? (
    <ControlLazyBoundary>
      <controlPlugin.RenderEdit
        field={field}
        value={inert ? undefined : val}
        onChange={inert ? undefined : (v) => onChange(fieldKey, v)}
        readOnly={false}
      />
    </ControlLazyBoundary>
  ) : (
    <input
      type="text"
      className="sails-detail-field-input"
      value={inert ? '' : (val ?? '')}
      readOnly={inert}
      onChange={(e) => onChange(fieldKey, e.target.value)}
      placeholder={`Enter ${label.toLowerCase()}...`}
      required={field.isRequired}
    />
  );

  return (
    <div className="ls-block__input-wrapper" style={{ marginTop: 6, ...(inert ? { pointerEvents: 'none' as const } : null) }}>
      {inner}
    </div>
  );
};

// ── Read-only / display value (exact front-end fallbacks) ──────

interface DetailFieldDisplayProps {
  field: SailsFieldDefinition;
  val: any;
  controlPluginId?: string;
}

export const DetailFieldDisplay: React.FC<DetailFieldDisplayProps> = ({ field, val, controlPluginId }) => {
  const { controlPlugin, logicalType } = resolveControlPlugin(field, controlPluginId);

  if (val === undefined || val === null || val === '') {
    return <span className="ls-block__empty">—</span>;
  }

  if (controlPlugin && controlPlugin.RenderDisplay) {
    return <controlPlugin.RenderDisplay field={field} value={val} mode="display" />;
  }

  if (logicalType === 'boolean') {
    const cfg = (field.config as any) || {};
    const isTrue = val === true || val === 'true' || val === 1 || val === '1';
    return <span>{isTrue ? (cfg.trueLabel || 'Yes') : (cfg.falseLabel || 'No')}</span>;
  }

  return <span>{typeof val === 'object' ? JSON.stringify(val) : String(val)}</span>;
};
