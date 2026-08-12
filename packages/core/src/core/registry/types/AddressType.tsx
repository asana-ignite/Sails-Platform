/**
 * Address — structured postal address (jsonb sub-fields).
 */
import React from 'react';
import { z } from 'zod';
import { FieldTypePlugin } from '../FieldTypePlugin';

export const AddressType: FieldTypePlugin = {
  type: 'address',
  label: 'Address',
  description: 'Structured postal address stored as JSONB (Address 1, Address 2, City, State, Country, Postal Code)',
  iconName: 'MapPin',
  physicalType: 'jsonb',
  parametersSchema: [
    { name: 'includeAddress1', label: 'Include Address Line 1', type: 'boolean', defaultValue: true },
    { name: 'includeAddress2', label: 'Include Address Line 2', type: 'boolean', defaultValue: true },
    { name: 'includeCity', label: 'Include City / Province / State', type: 'boolean', defaultValue: true },
    { name: 'includeState', label: 'Include State / Province', type: 'boolean', defaultValue: true },
    { name: 'includeCountry', label: 'Include Country', type: 'boolean', defaultValue: true },
    { name: 'includePostalCode', label: 'Include Zip / Postal Code', type: 'boolean', defaultValue: true },
    {
      name: 'countrySource',
      label: 'Country Options Source',
      type: 'select',
      defaultValue: 'all',
      options: [
        { label: 'All Countries (searchable)', value: 'all' },
        { label: 'Custom List', value: 'custom' }
      ]
    },
    { name: 'countryOptions', label: 'Custom Country List (comma separated)', type: 'text', placeholder: 'e.g. Thailand, Singapore, Malaysia' },
    { name: 'placeholder', label: 'Input Placeholder (legacy mode)', type: 'text', placeholder: 'e.g. 123 Main St, Suite 400, New York, NY 10001' }
  ],
  getPostgresColumnDefinition: (isRequired?: boolean) => {
    return `JSONB${isRequired ? ' NOT NULL' : ''}`;
  },
  getZodSchema: (isRequired?: boolean) => {
    // Accept structured JSON (object) or legacy plain strings.
    const addressObject = z.object({
      address1: z.string().optional().nullable(),
      address2: z.string().optional().nullable(),
      city: z.string().optional().nullable(),
      state: z.string().optional().nullable(),
      country: z.string().optional().nullable(),
      postalCode: z.string().optional().nullable()
    }).passthrough();
    const union = z.union([z.string(), addressObject]);
    if (!isRequired) return union.optional().nullable();
    return union
      .refine((v) => {
        if (typeof v === 'string') return v.trim().length > 0;
        return Object.values(v).some((p) => typeof p === 'string' && (p as string).trim().length > 0);
      }, { message: 'Required field' });
  },
  RenderFormInput: (props: any) => {
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      let parsed: any = e.target.value;
      try { parsed = JSON.parse(e.target.value); } catch { /* keep raw string */ }
      props?.onChange?.(parsed);
    };
    const value = typeof props?.value === 'string' ? props.value : JSON.stringify(props?.value ?? '', null, 2);
    return <textarea className="form-textarea" rows={4} {...props} value={value} onChange={handleChange} />;
  },
  RenderTableCell: (props: { value: any }) => {
    const v = props?.value;
    if (v === undefined || v === null) return <span />;
    if (typeof v === 'string') return <span>{v}</span>;
    const parts = [v.address1, v.address2, [v.city, v.state].filter(Boolean).join(', '), v.country, v.postalCode]
      .filter((p) => typeof p === 'string' && p.trim().length > 0);
    return <span>{parts.join(', ') || JSON.stringify(v)}</span>;
  }
};
