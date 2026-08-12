/**
 * Email — validated email address.
 */
import React from 'react';
import { z } from 'zod';
import { FieldTypePlugin } from '../FieldTypePlugin';

export const EmailType: FieldTypePlugin = {
  type: 'email',
  label: 'Email Address',
  description: 'Email address with click-to-send (mailto) display',
  iconName: 'Mail',
  physicalType: 'text',
  parametersSchema: [
    { name: 'placeholder', label: 'Input Placeholder', type: 'text', placeholder: 'e.g. name@company.com' },
    { name: 'allowMultiple', label: 'Allow Multiple Addresses (comma separated)', type: 'boolean', defaultValue: false }
  ],
  getPostgresColumnDefinition: (isRequired?: boolean) => {
    return `VARCHAR(1000)${isRequired ? ' NOT NULL' : ''}`;
  },
  getZodSchema: (isRequired?: boolean) => {
    const schema = z.string().max(1000);
    return isRequired ? schema.min(1, 'Required field') : schema.optional();
  },
  RenderFormInput: (props: any) => {
    return <input type="email" className="form-input" {...props} />;
  },
  RenderTableCell: ({ value }: { value: any }) => {
    const raw = String(value || '');
    if (!raw.trim()) return <span>{raw}</span>;
    const addresses = raw.split(/[,;]/).map((s: string) => s.trim()).filter(Boolean);
    return (
      <a href={`mailto:${addresses.join(',')}`} style={{ color: 'var(--sails-primary, #2563eb)', textDecoration: 'none' }}>
        {raw}
      </a>
    );
  }
};
