import React from 'react';
import type { FieldControlPlugin, FieldControlProps } from '../types';

export const CurrencyControl: FieldControlPlugin = {
  id: 'control:currency',
  name: 'Currency Input',
  description: 'Formatted monetary value control with symbol prefix',
  iconName: 'Banknote',
  compatibleTypes: ['currency'],
  isDefault: true,

  RenderEdit: ({ field, value, onChange, disabled, readOnly, className = '' }: FieldControlProps) => {
    const symbol = (field?.config as any)?.currencySymbol || '฿';

    return (
      <div className={`sails-input flex items-center gap-2 w-full ${className}`}>
        <span className="font-semibold text-slate-400 shrink-0">{symbol}</span>
        <input
          type="number"
          readOnly={readOnly}
          disabled={disabled}
          value={value ?? ''}
          placeholder="0.00"
          onChange={(e) => onChange && onChange(e.target.value)}
          className="bg-transparent border-none outline-none w-full text-slate-200 placeholder:text-slate-500"
        />
      </div>
    );
  },

  RenderDisplay: ({ field, value }: FieldControlProps) => {
    if (value === undefined || value === null || value === '') return <span className="text-xs text-slate-500">—</span>;
    const symbol = (field.config as any)?.currencySymbol || '฿';
    const num = Number(value);
    const formatted = isNaN(num) ? String(value) : num.toLocaleString();
    return <span className="text-xs font-semibold text-emerald-400">{symbol}{formatted}</span>;
  },
};
