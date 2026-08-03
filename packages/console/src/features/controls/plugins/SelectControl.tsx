import React from 'react';
import type { FieldControlPlugin, FieldControlProps } from '../types';
import { CustomSelect } from '../../../components/common/CustomSelect';
import '../controls.css';

export const SelectControl: FieldControlPlugin = {
  id: 'control:select',
  name: 'Select Dropdown',
  description: 'Single-option selection dropdown control',
  iconName: 'ListFilter',
  compatibleTypes: ['select', 'enum'],
  isDefault: true,

  mockValue: (field) => {
    const opts = (field.config as any)?.options || [];
    return opts[0]?.value ?? 'option_1';
  },

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
        className="sails-custom-select--full sails-custom-select--field"
      />
    );
  },

  RenderDisplay: ({ field, value }: FieldControlProps) => {
    if (value === undefined || value === null || value === '') return <span>—</span>;
    const options: Array<{ label: string; value: string }> = (field.config as any)?.options || [];
    const found = options.find((o) => o.value === value);
    const label = found ? found.label : String(value);

    return <span>{label}</span>;
  },
};
