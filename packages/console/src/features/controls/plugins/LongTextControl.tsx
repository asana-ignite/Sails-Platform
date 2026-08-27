/**
 * LongTextControl — multi-line textarea.
 */
import React from 'react';
import type { FieldControlPlugin, FieldControlProps } from '../types';

export const LongTextControl: FieldControlPlugin = {
  id: 'control:long_text',
  name: 'Multiline Text Area',
  description: 'Multi-line text area input',
  iconName: 'AlignLeft',
  compatibleTypes: ['long_text', 'text'],
  isDefault: true,

  mockValue: () => 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',

  RenderEdit: ({ field, value, onChange, disabled, readOnly, className = '' }: FieldControlProps) => {
    const cfg = (field?.config as any) || {};
    const placeholder = cfg?.placeholder || `Provide ${field?.name || 'details'}...`;
    const numRows = Math.max(1, Number(cfg?.rows) || Number((field as any)?.rows) || 3);
    const minHeightPx = numRows * 22 + 16;

    return (
      <textarea
        rows={numRows}
        readOnly={readOnly}
        disabled={disabled}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange && onChange(e.target.value)}
        className={`sails-input sails-textarea ${className}`}
        style={{
          resize: 'vertical',
          height: 'auto',
          minHeight: `${minHeightPx}px`,
          lineHeight: '1.5',
          padding: '8px 12px',
        }}
      />
    );
  },

  RenderDisplay: ({ field, value }: FieldControlProps) => {
    const cfg = (field?.config as any) || {};
    const numRows = Math.max(1, Number(cfg?.rows) || Number((field as any)?.rows) || 3);
    const minHeightPx = numRows * 22 + 16;

    return (
      <div
        className="sails-input sails-input--textarea-display"
        style={{
          height: 'auto',
          minHeight: `${minHeightPx}px`,
          whiteSpace: 'pre-wrap',
          padding: '8px 12px',
          lineHeight: '1.5',
          overflowY: 'auto',
        }}
      >
        {value !== undefined && value !== null && value !== '' ? String(value) : <span className="ls-block__empty">—</span>}
      </div>
    );
  },
};
