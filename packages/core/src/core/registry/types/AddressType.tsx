import React from 'react';
import { z } from 'zod';
import { FieldTypePlugin } from '../FieldTypePlugin';

export const AddressType: FieldTypePlugin = {
  type: 'address',
  label: 'Address',
  description: 'Physical location and postal address',
  iconName: 'MapPin',
  physicalType: 'text',
  parametersSchema: [
    { name: 'includeCountry', label: 'Include Country Field', type: 'boolean', defaultValue: true },
    { name: 'includePostalCode', label: 'Include Postal / Zip Code Field', type: 'boolean', defaultValue: true },
    { name: 'includeStateProvince', label: 'Include State / Province Field', type: 'boolean', defaultValue: true },
    { name: 'placeholder', label: 'Input Placeholder', type: 'text', placeholder: 'e.g. 123 Main St, City, Country' }
  ],
  getPostgresColumnDefinition: (isRequired?: boolean) => {
    return `TEXT${isRequired ? ' NOT NULL' : ''}`;
  },
  getZodSchema: (isRequired?: boolean) => {
    const schema = z.string();
    return isRequired ? schema.min(1, 'Required field') : schema.optional();
  },
  RenderFormInput: (props: any) => {
    return <textarea className="form-textarea" rows={2} {...props} />;
  },
  RenderTableCell: (props: { value: any }) => {
    return <span>{String(props.value || '')}</span>;
  }
};
