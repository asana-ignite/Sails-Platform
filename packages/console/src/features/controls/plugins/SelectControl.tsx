import React from 'react';
import type { FieldControlPlugin, FieldControlProps } from '../types';
import { CustomSelect } from '../../../components/common/CustomSelect';

export const SelectControl: FieldControlPlugin = {
  id: 'control:select',
  name: 'Select Dropdown',
  description: 'Single-option selection dropdown control',
  iconName: 'ListFilter',
  compatibleTypes: ['select', 'enum'],
  isDefault: true,

  RenderEdit: ({ field, value, onChange, disabled, readOnly, size = 'sm' }: FieldControlProps) => {
    const rawOptions: Array<{ label: string; value: string }> = (field.config as any)?.options || [];
    const formattedOptions = rawOptions.map((o) => ({ label: o.label, value: o.value }));

    return (
      <CustomSelect
        value={value ?? ''}
        options={formattedOptions}
        placeholder="Select option..."
        size={size === 'lg' ? 'lg' : size === 'sm' ? 'sm' : 'md'}
        disabled={disabled || readOnly}
        onChange={(newVal) => onChange && onChange(newVal)}
        className="w-full"
      />
    );
  },

  RenderDisplay: ({ field, value }: FieldControlProps) => {
    if (value === undefined || value === null || value === '') return <span className="text-xs text-slate-500">—</span>;
    const options: Array<{ label: string; value: string }> = (field.config as any)?.options || [];
    const found = options.find((o) => o.value === value);
    const label = found ? found.label : String(value);

    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-200 border border-slate-700">
        {label}
      </span>
    );
  },
};
