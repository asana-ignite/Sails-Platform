import React from 'react';
import { z } from 'zod';
import { FieldTypePlugin } from '../FieldTypePlugin';

export const SelectType: FieldTypePlugin = {
  type: 'select',
  label: 'Single Selection Dropdown',
  description: 'Select a single option from a custom list or lookup values from another data model',
  iconName: 'List',
  physicalType: 'text',
  parametersSchema: [
    {
      name: 'sourceType',
      label: 'Option Value Source',
      type: 'select',
      defaultValue: 'custom',
      options: [
        { label: 'Custom Entered Options List', value: 'custom' },
        { label: 'Lookup Values from Data Model', value: 'object' }
      ]
    },
    {
      name: 'optionsText',
      label: 'Custom Options (One Per Line)',
      type: 'textarea',
      placeholder: 'Draft\nIn Review\nApproved\nClosed'
    },
    {
      name: 'sourceTable',
      label: 'Source Data Model (For Object Lookup)',
      type: 'model_select'
    },
    {
      name: 'sourceColumn',
      label: 'Source Column / Field Name',
      type: 'text',
      placeholder: 'e.g. status or category_name'
    },
    {
      name: 'allowMultiple',
      label: 'Allow Multi-Select',
      type: 'boolean',
      defaultValue: false
    }
  ],
  getPostgresColumnDefinition: (isRequired?: boolean) => {
    return `TEXT${isRequired ? ' NOT NULL' : ''}`;
  },
  getZodSchema: (isRequired?: boolean) => {
    const schema = z.string();
    return isRequired ? schema.min(1, 'Required field') : schema.optional();
  },
  RenderFormInput: (props: any) => {
    return (
      <select className="form-select" {...props}>
        <option value="">Select option...</option>
      </select>
    );
  },
  RenderTableCell: (props: { value: any }) => {
    return <span>{String(props.value || '')}</span>;
  }
};
