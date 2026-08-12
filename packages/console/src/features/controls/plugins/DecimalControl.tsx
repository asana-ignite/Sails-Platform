/**
 * DecimalControl — decimal input with precision handling.
 */
import React from 'react';
import type { FieldControlPlugin, FieldControlProps } from '../types';
import { formatDecimalValue, resolveDecimalPlaces } from '@sails/shared';
import { NumberFormatInput } from '../NumberFormatInput';

function decimalPlaceholder(field: FieldControlProps['field']): string {
  const dp = resolveDecimalPlaces(field?.config, field?.logicalType);
  return dp <= 0 ? '0' : `0.${'0'.repeat(dp)}`;
}

export const DecimalControl: FieldControlPlugin = {
  id: 'control:decimal',
  name: 'Decimal Input',
  description: 'Decimal numeric input control (step follows configured decimal places)',
  iconName: 'Binary',
  compatibleTypes: ['decimal'],
  isDefault: true,

  mockValue: () => 42.5,

  RenderEdit: ({ field, value, onChange, disabled, readOnly, className = '' }: FieldControlProps) => (
    <NumberFormatInput
      field={field}
      value={value ?? ''}
      onChange={onChange}
      disabled={disabled}
      readOnly={readOnly}
      className={className}
      placeholder={decimalPlaceholder(field)}
    />
  ),

  RenderDisplay: ({ field, value }: FieldControlProps) => (
    <span className="sails-control-numeric-display">
      {value !== undefined && value !== null && value !== ''
        ? formatDecimalValue(value, field?.config, field?.logicalType)
        : '—'}
    </span>
  ),
};
