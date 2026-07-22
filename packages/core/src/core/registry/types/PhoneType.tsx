import React from 'react';
import { z } from 'zod';
import { FieldTypePlugin } from '../FieldTypePlugin';

export const PhoneType: FieldTypePlugin = {
  type: 'phone',
  label: 'Phone Number',
  description: 'Telephone or mobile contact number',
  iconName: 'Phone',
  physicalType: 'text',
  parametersSchema: [
    { name: 'defaultCountryCode', label: 'Default Country Code', type: 'text', placeholder: 'e.g. +1 or +66' },
    { name: 'placeholder', label: 'Input Placeholder', type: 'text', placeholder: 'e.g. +1 555-0199' }
  ],
  getPostgresColumnDefinition: (isRequired?: boolean) => {
    return `VARCHAR(50)${isRequired ? ' NOT NULL' : ''}`;
  },
  getZodSchema: (isRequired?: boolean) => {
    const schema = z.string();
    return isRequired ? schema.min(1, 'Required field') : schema.optional();
  },
  RenderFormInput: (props: any) => {
    return <input type="tel" className="form-input" {...props} />;
  },
  RenderTableCell: (props: { value: any }) => {
    return <span>{String(props.value || '')}</span>;
  }
};
