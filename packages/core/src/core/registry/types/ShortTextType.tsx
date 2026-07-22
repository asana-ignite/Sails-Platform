import React from 'react';
import { z } from 'zod';
import { FieldTypePlugin } from '../FieldTypePlugin';

export const ShortTextType: FieldTypePlugin = {
  type: 'short_text',
  label: 'Short Text',
  description: 'Single line text string',
  iconName: 'Type',
  physicalType: 'text',
  parametersSchema: [
    { name: 'maxLength', label: 'Max Length (Characters)', type: 'number', defaultValue: 255, min: 1, max: 4000 },
    { 
      name: 'transform', 
      label: 'Text Transform', 
      type: 'select', 
      defaultValue: 'none',
      options: [
        { label: 'None', value: 'none' },
        { label: 'UPPERCASE', value: 'uppercase' },
        { label: 'lowercase', value: 'lowercase' }
      ]
    },
    { name: 'placeholder', label: 'Placeholder Text', type: 'text', placeholder: 'e.g. Enter text...' },
    { name: 'defaultValue', label: 'Default Value', type: 'text', placeholder: 'e.g. N/A' }
  ],
  getPostgresColumnDefinition: (isRequired?: boolean) => {
    return `VARCHAR(255)${isRequired ? ' NOT NULL' : ''}`;
  },
  getZodSchema: (isRequired?: boolean) => {
    const schema = z.string().max(255);
    return isRequired ? schema.min(1, 'Required field') : schema.optional();
  },
  RenderFormInput: (props: any) => {
    return <input type="text" className="form-input" {...props} />;
  },
  RenderTableCell: (props: { value: any }) => {
    return <span>{String(props.value || '')}</span>;
  }
};

