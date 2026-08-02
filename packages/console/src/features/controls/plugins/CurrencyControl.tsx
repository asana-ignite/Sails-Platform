import React from 'react';
import type { FieldControlPlugin, FieldControlProps } from '../types';
import '../controls.css';

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
      <div className={`sails-input sails-control-currency ${className}`}>
        <span className="sails-control-currency__symbol">{symbol}</span>
        <input
          type="number"
          readOnly={readOnly}
          disabled={disabled}
          value={value ?? ''}
          placeholder="0.00"
          onChange={(e) => onChange && onChange(e.target.value)}
          className="sails-control-currency__input"
        />
      </div>
    );
  },

  RenderDisplay: ({ field, value }: FieldControlProps) => {
    if (value === undefined || value === null || value === '') return <span>—</span>;
    const symbol = (field.config as any)?.currencySymbol || '฿';
    const num = Number(value);
    const formatted = isNaN(num) ? String(value) : num.toLocaleString();
    return <span className="sails-control-display-emerald">{symbol}{formatted}</span>;
  },
};
