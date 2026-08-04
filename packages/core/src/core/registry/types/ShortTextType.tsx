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
      name: 'validationPreset',
      label: 'Text Validation (Format Preset)',
      type: 'select',
      defaultValue: 'none',
      options: [
        { label: 'None (Any Characters Allowed)', value: 'none' },
        { label: 'Alphanumeric (No Spaces)', value: 'alphanumeric' },
        { label: 'Alphanumeric + Spaces/Dashes', value: 'alphanumeric_spaces' },
        { label: 'Alphabetic Only', value: 'alphabetic' },
        { label: 'Alphabetic + Spaces', value: 'alphabetic_spaces' },
        { label: 'Numeric Only', value: 'numeric' },
        { label: 'No Special Characters', value: 'no_special' },
        { label: 'URL', value: 'url' },
        { label: 'Email', value: 'email' },
        { label: 'Custom Regex Pattern...', value: 'custom' }
      ]
    },
    {
      name: 'regexPattern',
      label: 'Custom Regex Pattern',
      type: 'text',
      placeholder: 'e.g. ^[A-Z]{3}-\\d{4}$',
      visibleWhen: { name: 'validationPreset', equals: 'custom' }
    },
    {
      name: 'customErrorMessage',
      label: 'Custom Error Message',
      type: 'text',
      placeholder: 'e.g. Invalid format (e.g. ABC-1234)'
    },
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

