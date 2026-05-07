import React from 'react';
import { z } from 'zod';
import { FieldTypePlugin } from '../FieldTypePlugin';

export const BooleanType: FieldTypePlugin = {
  type: 'boolean',
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
