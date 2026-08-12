/**
 * Expression — JSONata-computed column (result type chosen at creation; DDL overridden to NUMERIC/BOOLEAN/TIMESTAMPTZ by TranslatorLayer).
 */
import React from 'react';
import { z } from 'zod';
import { FieldTypePlugin } from '../FieldTypePlugin';

export const ExpressionType: FieldTypePlugin = {
  type: 'expression',
  label: 'Expression',
  description: 'Calculated value from a JSONata formula — evaluated automatically whenever the record (or a related record it references) is saved',
  iconName: 'Sigma',
  physicalType: 'text',
  getPostgresColumnDefinition: (isRequired?: boolean) => {
    return `TEXT${isRequired ? ' NOT NULL' : ''}`;
  },
  getZodSchema: () => {
    return z.any().optional().nullable();
  },
  RenderFormInput: (props: any) => {
    return (
      <input
        type="text"
        className="form-input"
        disabled
        value={props.value ?? ''}
        placeholder="(Calculated automatically)"
        style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', cursor: 'not-allowed', color: '#94a3b8' }}
      />
    );
  },
  RenderTableCell: (props: { value: any }) => {
    return <span>{String(props.value ?? '')}</span>;
  }
};
