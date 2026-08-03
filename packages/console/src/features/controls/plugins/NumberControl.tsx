import React from 'react';
import type { FieldControlPlugin, FieldControlProps } from '../types';
import { formatDecimalValue } from '@sails/shared';
import { NumberFormatInput } from '../NumberFormatInput';

export const NumberControl: FieldControlPlugin = {
  id: 'control:number',
  name: 'Number Input',
  description: 'Integer numeric input control (thousands separators follow config)',
  iconName: 'Hash',
  compatibleTypes: ['number'],
  isDefault: true,

  mockValue: () => 42,

  RenderEdit: ({ field, value, onChange, disabled, readOnly, className = '' }: FieldControlProps) => (
    <NumberFormatInput
      field={field}
      value={value ?? ''}
      onChange={onChange}
      disabled={disabled}
      readOnly={readOnly}
      className={className}
      placeholder="0"
    />
  ),

  RenderDisplay: ({ field, value }: FieldControlProps) => (
    <span className="sails-control-numeric-display">{formatDecimalValue(value, field?.config, field?.logicalType)}</span>
  ),
};
