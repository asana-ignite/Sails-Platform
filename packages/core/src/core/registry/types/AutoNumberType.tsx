import React from 'react';
import { z } from 'zod';
import { FieldTypePlugin } from '../FieldTypePlugin';

export const AutoNumberType: FieldTypePlugin = {
  type: 'auto_number',
  label: 'Auto Number',
  description: 'Auto-incrementing formatted string sequence (supports date tokens: {YYYY}, {YY}, {MM}, {DD})',
  iconName: 'Hash',
  physicalType: 'text',
  parametersSchema: [
    {
      name: 'prefix',
      label: 'Format Pattern',
      type: 'text',
      placeholder: 'e.g. INV-0000 or INV-{yyyy}0000',
      description: 'Format pattern using zeroes (e.g. 0000 = 4 digits padding) and date tokens ({yyyy}, {mm}, {dd})'
    },
    {
      name: 'startingNumber',
      label: 'Starting Number',
      type: 'number',
      defaultValue: 1,
      min: 1,
      description: 'First sequence number for new records'
    }
  ],
  getPostgresColumnDefinition: (isRequired?: boolean) => {
    return `VARCHAR(255)${isRequired ? ' NOT NULL' : ''}`;
  },
  getZodSchema: () => {
    return z.string().optional();
  },
  RenderFormInput: (props: any) => {
    return (
      <input
        type="text"
        className="form-input"
        disabled
        value={props.value || ''}
        placeholder="(Auto-generated on save)"
        style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', cursor: 'not-allowed', color: '#94a3b8' }}
      />
    );
  },
  RenderTableCell: (props: { value: any }) => {
    return <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{String(props.value || '')}</span>;
  }
};
