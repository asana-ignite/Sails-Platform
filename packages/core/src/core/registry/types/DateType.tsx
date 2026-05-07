import React from 'react';
import { z } from 'zod';
import { FieldTypePlugin } from '../FieldTypePlugin';

export const DateType: FieldTypePlugin = {
  type: 'date',
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
