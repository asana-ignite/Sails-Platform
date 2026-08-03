import React from 'react';
import type { FieldControlPlugin, FieldControlProps } from '../types';
import { formatDecimalValue } from '@sails/shared';
import { NumberFormatInput } from '../NumberFormatInput';

export const PercentControl: FieldControlPlugin = {
  id: 'control:percent',
  name: 'Percentage Input',
  description: 'Numeric input control with % symbol suffix',
  iconName: 'Percent',
  compatibleTypes: ['percentage', 'percent'],
  isDefault: true,

  mockValue: () => 75,

  RenderEdit: ({ field, value, onChange, disabled, readOnly, className = '' }: FieldControlProps) => (
    <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
      <NumberFormatInput
        field={field}
        value={value ?? ''}
        onChange={onChange}
        disabled={disabled}
        readOnly={readOnly}
        className={className}
        placeholder="0.00"
        style={{ paddingRight: '28px' }}
      />
      <span
        style={{
          position: 'absolute',
          right: '10px',
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--sails-text-muted, #94a3b8)',
          pointerEvents: 'none'
        }}
      >
        %
      </span>
    </div>
  ),

  RenderDisplay: ({ field, value }: FieldControlProps) => (
    <span className="sails-control-numeric-display">
      {value !== undefined && value !== null && value !== '' ? `${formatDecimalValue(value, field?.config, field?.logicalType)}%` : '—'}
    </span>
  ),
};
