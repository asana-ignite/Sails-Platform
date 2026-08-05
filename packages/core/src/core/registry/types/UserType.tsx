import React from 'react';
import { z } from 'zod';
import { FieldTypePlugin } from '../FieldTypePlugin';

export const UserType: FieldTypePlugin = {
  type: 'user',
  label: 'User',
  description: 'Reference to an internal platform user',
  iconName: 'UserCheck',
  physicalType: 'relation',
  parametersSchema: [
    {
      name: 'defaultToCurrentUser',
      label: 'Default to Currently Logged-in User',
      type: 'boolean',
      defaultValue: true,
      description: 'Automatically populate with the active user when creating a new record'
    },
    {
      name: 'roleFilter',
      label: 'Limit Selection by Role',
      type: 'select',
      defaultValue: 'all',
      options: [
        { label: 'All Active Users', value: 'all' },
        { label: 'Admins Only', value: 'ADMIN' },
        { label: 'Tenant Admins Only', value: 'TENANT_ADMIN' },
        { label: 'Standard Users Only', value: 'USER' }
      ]
    },
    {
      name: 'allowMultiple',
      label: 'Allow Multiple User Assignment',
      type: 'boolean',
      defaultValue: false,
      description: 'Allow assigning multiple team members or co-owners'
    }
  ],
  getPostgresColumnDefinition: (isRequired?: boolean) => {
    // Platform user ids are VARCHAR(30) CUIDs — a UUID column cannot store them.
    return `VARCHAR(30)${isRequired ? ' NOT NULL' : ''}`;
  },
  getZodSchema: (isRequired?: boolean) => {
    const schema = z.string().uuid();
    return isRequired ? schema.min(1, 'Required field') : schema.optional();
  },
  RenderFormInput: (props: any) => {
    return (
      <select className="form-select" {...props}>
        <option value="">Select a user...</option>
      </select>
    );
  },
  RenderTableCell: (props: { value: any }) => {
    if (!props.value) return <span></span>;
    const name = typeof props.value === 'object' ? props.value?.name || props.value?.email || props.value?.id : String(props.value);
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#e2e8f0' }}>
        👤 {name}
      </span>
    );
  }
};
