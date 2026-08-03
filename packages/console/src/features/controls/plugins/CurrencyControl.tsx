import React from 'react';
import type { FieldControlPlugin, FieldControlProps } from '../types';
import { formatDecimalValue } from '@sails/shared';
import { NumberFormatInput } from '../NumberFormatInput';

export const CurrencyControl: FieldControlPlugin = {
  id: 'control:currency',
  name: 'Currency Input',
  description: 'Formatted monetary value control with symbol prefix',
  iconName: 'Banknote',
  compatibleTypes: ['currency'],
  isDefault: true,

  mockValue: () => 250000,

  RenderEdit: ({ field, value, onChange, disabled, readOnly, className = '' }: FieldControlProps) => {
    const symbol = (field?.config as any)?.currencySymbol || '฿';

    return (
      <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
        <span
          style={{
            position: 'absolute',
            left: '12px',
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--sails-text-muted, #94a3b8)',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        >
          {symbol}
        </span>
        <NumberFormatInput
          field={field}
          value={value ?? ''}
          onChange={onChange}
          disabled={disabled}
          readOnly={readOnly}
          className={className}
          placeholder="0.00"
          style={{ paddingLeft: '28px' }}
        />
      </div>
    );
  },

  RenderDisplay: ({ field, value }: FieldControlProps) => {
    if (value === undefined || value === null || value === '') return <span className="sails-control-numeric-display">—</span>;
    const symbol = (field.config as any)?.currencySymbol || '฿';
    return <span className="sails-control-numeric-display">{symbol}{formatDecimalValue(value, field?.config, field?.logicalType)}</span>;
  },
};
