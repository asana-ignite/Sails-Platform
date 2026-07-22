import React from 'react';
import { z } from 'zod';
import { FieldTypePlugin } from '../FieldTypePlugin';

export const DateType: FieldTypePlugin = {
  type: 'date',
  label: 'Date / Time',
  description: 'Calendar date and timestamp precision',
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
    { name: 'defaultCurrent', label: 'Default to Current Date/Time', type: 'boolean', defaultValue: false }
  ],
  getPostgresColumnDefinition: (isRequired?: boolean) => {
    return `TIMESTAMPTZ${isRequired ? ' NOT NULL' : ''}`;
  },
  getZodSchema: (isRequired?: boolean) => {
    const schema = z.date();
    return isRequired ? schema : schema.optional();
  },
  RenderFormInput: (props: any) => {
    return <input type="date" className="form-input" {...props} />;
  },
  RenderTableCell: (props: { value: any }) => {
    if (!props.value) return <span></span>;
    const d = new Date(props.value);
    return <span>{d.toLocaleDateString()}</span>;
  }
};

