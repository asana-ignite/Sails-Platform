import React from 'react';
import { z } from 'zod';
import { FieldTypePlugin } from '../FieldTypePlugin';

export const PercentageType: FieldTypePlugin = {
  type: 'percentage',
  label: 'Percentage',
  description: 'Numeric percentage value (e.g. 15.5%)',
  iconName: 'Hash',
  physicalType: 'number',
  parametersSchema: [
    { name: 'decimalPlaces', label: 'No. Decimal Places', type: 'number', defaultValue: 2, min: 0, max: 6 },
    { name: 'min', label: 'Minimum Percent (%)', type: 'number', defaultValue: 0, placeholder: '0' },
    { name: 'max', label: 'Maximum Percent (%)', type: 'number', defaultValue: 100, placeholder: '100' },
    { name: 'showSymbol', label: 'Display % Symbol', type: 'boolean', defaultValue: true }
  ],
  getPostgresColumnDefinition: (isRequired?: boolean) => {
    return `NUMERIC(7, 2)${isRequired ? ' NOT NULL' : ''}`;
  },
  getZodSchema: (isRequired?: boolean) => {
    const schema = z.number();
    return isRequired ? schema : schema.optional();
  },
  RenderFormInput: (props: any) => {
    return <input type="number" className="form-input" step="0.01" {...props} />;
  },
  RenderTableCell: (props: { value: any }) => {
    if (props.value === null || props.value === undefined) return <span></span>;
    return <span>{String(props.value)}%</span>;
  }
};
