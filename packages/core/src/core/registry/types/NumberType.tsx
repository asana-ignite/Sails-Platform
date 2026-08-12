/**
 * Number — whole-number integer column.
 */
import React from 'react';
import { z } from 'zod';
import { FieldTypePlugin } from '../FieldTypePlugin';

export const NumberType: FieldTypePlugin = {
  type: 'number',
  label: 'Number',
  description: 'Whole number integer value',
  iconName: 'Hash',
  physicalType: 'number',
  parametersSchema: [
    { name: 'min', label: 'Minimum Value', type: 'number', placeholder: 'e.g. 0' },
    { name: 'max', label: 'Maximum Value', type: 'number', placeholder: 'e.g. 1000000' },
    { name: 'defaultValue', label: 'Default Value', type: 'number', placeholder: 'e.g. 0' }
  ],
  getPostgresColumnDefinition: (isRequired?: boolean) => {
    return `INTEGER${isRequired ? ' NOT NULL' : ''}`;
  },
  getZodSchema: (isRequired?: boolean) => {
    const schema = z.number().int();
    return isRequired ? schema : schema.optional();
  },
  RenderFormInput: (props: any) => {
    return <input type="number" step="1" className="form-input" {...props} />;
  },
  RenderTableCell: (props: { value: any }) => {
    return <span>{String(props.value || '')}</span>;
  }
};
