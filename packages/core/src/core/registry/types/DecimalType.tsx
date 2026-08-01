import React from 'react';
import { z } from 'zod';
import { FieldTypePlugin } from '../FieldTypePlugin';

export const DecimalType: FieldTypePlugin = {
  type: 'decimal',
  label: 'Decimal',
  description: 'High-precision decimal number',
  iconName: 'Hash',
  physicalType: 'number',
  parametersSchema: [
    { name: 'decimalPlaces', label: 'No. Decimal Places', type: 'number', defaultValue: 4, min: 0, max: 10 },
    { name: 'min', label: 'Minimum Value', type: 'number', placeholder: 'e.g. 0' },
    { name: 'max', label: 'Maximum Value', type: 'number', placeholder: 'e.g. 1000000' },
    { name: 'defaultValue', label: 'Default Value', type: 'number', placeholder: 'e.g. 0' }
  ],
  getPostgresColumnDefinition: (isRequired?: boolean) => {
    return `NUMERIC(15, 4)${isRequired ? ' NOT NULL' : ''}`;
  },
  getZodSchema: (isRequired?: boolean) => {
    const schema = z.number();
    return isRequired ? schema : schema.optional();
  },
  RenderFormInput: (props: any) => {
    return <input type="number" step="0.01" className="form-input" {...props} />;
  },
  RenderTableCell: (props: { value: any }) => {
    return <span>{String(props.value || '')}</span>;
  }
};
