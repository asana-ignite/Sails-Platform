import React from 'react';
import { z } from 'zod';
import { FieldTypePlugin } from '../FieldTypePlugin';

export const DateType: FieldTypePlugin = {
  type: 'date',
  label: 'Date',
  description: 'Calendar date without time component',
  iconName: 'Calendar',
  physicalType: 'date',
  parametersSchema: [
    {
      name: 'dateFormat',
      label: 'Display Date Format',
      type: 'select',
      defaultValue: 'YYYY-MM-DD',
      options: [
        { label: 'YYYY-MM-DD (ISO)', value: 'YYYY-MM-DD' },
        { label: 'DD/MM/YYYY', value: 'DD/MM/YYYY' },
        { label: 'MM/DD/YYYY', value: 'MM/DD/YYYY' }
      ]
    },
    { name: 'defaultCurrent', label: 'Default to Today', type: 'boolean', defaultValue: false }
  ],
  getPostgresColumnDefinition: (isRequired?: boolean) => {
    return `DATE${isRequired ? ' NOT NULL' : ''}`;
  },
  getZodSchema: (isRequired?: boolean) => {
    const schema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
    return isRequired ? schema : schema.optional();
  },
  RenderFormInput: (props: any) => {
    return <input type="date" className="form-input" {...props} />;
  },
  RenderTableCell: (props: { value: any }) => {
    if (!props.value) return <span></span>;
    return <span>{String(props.value)}</span>;
  }
};
