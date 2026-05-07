import React from 'react';
import { z } from 'zod';
import { FieldTypePlugin } from '../FieldTypePlugin';

export const RelationType: FieldTypePlugin = {
  type: 'relation',
  getPostgresColumnDefinition: (isRequired?: boolean) => {
    return `UUID${isRequired ? ' NOT NULL' : ''}`;
  },
  getZodSchema: (isRequired?: boolean) => {
    const schema = z.string().uuid();
    return isRequired ? schema.min(1, 'Required field') : schema.optional();
  },
  RenderFormInput: (props: any) => {
    // This mock component will later fetch options from the API 
    // based on the 'relationTarget' property of the field metadata.
    return (
      <select className="form-select" {...props}>
        <option value="">Select a related record...</option>
      </select>
    );
  },
  RenderTableCell: (props: { value: any }) => {
    if (!props.value) return <span></span>;
    return (
      <span className="flex items-center text-blue-600 hover:underline cursor-pointer">
        🔗 {String(props.value)}
      </span>
    );
  }
};
