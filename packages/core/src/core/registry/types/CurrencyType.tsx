/**
 * Currency — money value with symbol.
 */
import React from 'react';
import { z } from 'zod';
import { FieldTypePlugin } from '../FieldTypePlugin';

export const CurrencyType: FieldTypePlugin = {
  type: 'currency',
  label: 'Currency',
  description: 'Financial monetary amount formatted with currency symbol',
  iconName: 'DollarSign',
  physicalType: 'number',
  parametersSchema: [
    {
      name: 'currencySymbol',
      label: 'Currency Symbol',
      type: 'select',
      defaultValue: '$',
      options: [
        { label: '$ (USD / Dollar)', value: '$' },
        { label: '฿ (THB / Baht)', value: '฿' },
        { label: '€ (EUR / Euro)', value: '€' },
        { label: '£ (GBP / Pound)', value: '£' },
        { label: '¥ (JPY / Yen)', value: '¥' }
      ]
    },
    { name: 'decimalPlaces', label: 'No. Decimal Places', type: 'number', defaultValue: 2, min: 0, max: 6 },
    { name: 'min', label: 'Minimum Amount', type: 'number', placeholder: '0' },
    { name: 'max', label: 'Maximum Amount', type: 'number', placeholder: '100000000' },
    { name: 'defaultValue', label: 'Default Amount', type: 'number', placeholder: '0.00' }
  ],
  getPostgresColumnDefinition: (isRequired?: boolean) => {
    return `NUMERIC(15, 2)${isRequired ? ' NOT NULL' : ''}`;
  },
  getZodSchema: (isRequired?: boolean) => {
    const schema = z.number();
    return isRequired ? schema : schema.optional();
  },
  RenderFormInput: (props: any) => {
    return <input type="number" className="form-input" step="0.01" {...props} />;
  },
  RenderTableCell: (props: { value: any }) => {
    if (props.value === null || props.value === undefined) return <span></span>;
    return <span>${Number(props.value).toFixed(2)}</span>;
  }
};
