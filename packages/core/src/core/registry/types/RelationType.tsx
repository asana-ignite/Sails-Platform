import React from 'react';
import { z } from 'zod';
import { FieldTypePlugin } from '../FieldTypePlugin';

export const RelationType: FieldTypePlugin = {
  type: 'relation',
  label: 'Relation',
  description: 'Foreign key link to records in another data model',
  iconName: 'GitFork',
  physicalType: 'relation',
  parametersSchema: [
    { name: 'targetTable', label: 'Target Data Model', type: 'model_select', required: true },
    {
      name: 'controlStyle',
      label: 'Display Control',
      type: 'select',
      defaultValue: 'searchable_dropdown',
      options: [
        { label: 'Searchable Dropdown (Combobox)', value: 'searchable_dropdown' },
        { label: 'Simple Select Dropdown', value: 'select' }
      ]
    }
  ],
  getPostgresColumnDefinition: (isRequired?: boolean) => {
    // Platform record ids are VARCHAR(30) — the FK column must match or
    // PostgreSQL cannot implement the constraint ("cannot be implemented").
    return `VARCHAR(30)${isRequired ? ' NOT NULL' : ''}`;
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
      <span style={{ display: 'inline-flex', alignItems: 'center', color: '#2563eb', textDecoration: 'underline', cursor: 'pointer' }}>
        🔗 {String(props.value)}
      </span>
    );
  }
};

