import React from 'react';
import { z } from 'zod';
import { FieldTypePlugin } from '../FieldTypePlugin';

export const NumberType: FieldTypePlugin = {
  type: 'number',
  label: 'Number / Decimal',
  description: 'Numeric value supporting integer or floating point decimal precision',
  iconName: 'Hash',
  physicalType: 'number',
  parametersSchema: [
    {
      name: 'numberType',
      label: 'Number Subtype',
      type: 'select',
      defaultValue: 'decimal',
      options: [
        { label: 'Decimal / Floating Point', value: 'decimal' },
        { label: 'Integer (Whole Numbers)', value: 'integer' }
      ]
    },
    { name: 'decimalPlaces', label: 'No. Decimal Places', type: 'number', defaultValue: 2, min: 0, max: 10 },
    { name: 'min', label: 'Minimum Value', type: 'number', placeholder: 'e.g. 0' },
    { name: 'max', label: 'Maximum Value', type: 'number', placeholder: 'e.g. 1000000' },
    { name: 'defaultValue', label: 'Default Value', type: 'number', placeholder: 'e.g. 0' }
  ],
  getPostgresColumnDefinition: (isRequired?: boolean) => {
    return `NUMERIC${isRequired ? ' NOT NULL' : ''}`;
  },
  getZodSchema: (isRequired?: boolean) => {
    const schema = z.number();
    return isRequired ? schema : schema.optional();
  },
  RenderFormInput: (props: any) => {
    return <input type="number" className="form-input" {...props} />;
  },
  RenderTableCell: (props: { value: any }) => {
    return <span>{String(props.value || '')}</span>;
  }
};

