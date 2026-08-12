/**
 * Text — multi-line plain text (long_text logical type).
 */
import React from 'react';
import { z } from 'zod';
import { FieldTypePlugin } from '../FieldTypePlugin';

export const TextType: FieldTypePlugin = {
  type: 'long_text',
  label: 'Long Text',
  description: 'Multi-line text block or documentation body',
  iconName: 'AlignLeft',
  physicalType: 'text',
  parametersSchema: [
    { name: 'maxLength', label: 'Max Character Length', type: 'number', defaultValue: 2000, min: 1 },
    { name: 'placeholder', label: 'Placeholder Text', type: 'text', placeholder: 'e.g. Provide details...' }
  ],
  getPostgresColumnDefinition: (isRequired?: boolean) => {
    return `TEXT${isRequired ? ' NOT NULL' : ''}`;
  },
  getZodSchema: (isRequired?: boolean) => {
    const schema = z.string();
    return isRequired ? schema.min(1, 'Required field') : schema.optional();
  },
  RenderFormInput: (props: any) => {
    return <textarea className="form-textarea" {...props} />;
  },
  RenderTableCell: (props: { value: any }) => {
    return <span>{String(props.value || '')}</span>;
  }
};

