import React from 'react';
import { z } from 'zod';
import { FieldTypePlugin } from '../FieldTypePlugin';

export const TimeType: FieldTypePlugin = {
  type: 'time',
  label: 'Time',
  description: 'Clock time without date component',
  iconName: 'Clock',
  physicalType: 'time',
  parametersSchema: [
    {
      name: 'timeFormat',
      label: 'Display Time Format',
      type: 'select',
      defaultValue: '24h',
      options: [
        { label: '24 Hour (14:30)', value: '24h' },
        { label: '12 Hour AM/PM (2:30 PM)', value: '12h' }
      ]
    },
    { name: 'defaultCurrent', label: 'Default to Current Time', type: 'boolean', defaultValue: false }
  ],
  getPostgresColumnDefinition: (isRequired?: boolean) => {
    return `TIME${isRequired ? ' NOT NULL' : ''}`;
  },
  getZodSchema: (isRequired?: boolean) => {
    const schema = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/);
    return isRequired ? schema : schema.optional();
  },
  RenderFormInput: (props: any) => {
    return <input type="time" className="form-input" {...props} />;
  },
  RenderTableCell: (props: { value: any }) => {
    if (!props.value) return <span></span>;
    return <span>{String(props.value)}</span>;
  }
};
