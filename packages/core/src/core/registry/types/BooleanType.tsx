import React from 'react';
import { z } from 'zod';
import { FieldTypePlugin } from '../FieldTypePlugin';

export const BooleanType: FieldTypePlugin = {
  type: 'boolean',
  label: 'Boolean',
  description: 'True or False toggle state',
  iconName: 'ToggleLeft',
  physicalType: 'boolean',
  parametersSchema: [
    {
      name: 'defaultValue',
      label: 'Default State',
      type: 'select',
      defaultValue: 'false',
      options: [
        { label: 'False (Unchecked)', value: 'false' },
        { label: 'True (Checked)', value: 'true' }
      ]
    },
    { name: 'trueLabel', label: 'True Display Label', type: 'text', placeholder: 'Yes / Active', defaultValue: 'True' },
    { name: 'falseLabel', label: 'False Display Label', type: 'text', placeholder: 'No / Inactive', defaultValue: 'False' }
  ],
  getPostgresColumnDefinition: (isRequired?: boolean) => {
    return `BOOLEAN${isRequired ? ' NOT NULL' : ''}`;
  },
  getZodSchema: (isRequired?: boolean) => {
    const schema = z.boolean();
    return isRequired ? schema : schema.optional();
  },
  RenderFormInput: (props: any) => {
    return <input type="checkbox" className="form-checkbox" {...props} />;
  },
  RenderTableCell: (props: { value: any }) => {
    return <span>{props.value ? 'Yes' : 'No'}</span>;
  }
};

