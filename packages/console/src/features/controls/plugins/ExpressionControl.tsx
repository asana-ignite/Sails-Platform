/**
 * ExpressionControl — read-only display of a computed value.
 */
import React from 'react';
import { Sigma } from 'lucide-react';
import type { FieldControlPlugin, FieldControlProps } from '../types';

export const ExpressionControl: FieldControlPlugin = {
  id: 'control:expression',
  name: 'Expression (Calculated)',
  description: 'Read-only value calculated from a JSONata formula',
  iconName: 'Sigma',
  compatibleTypes: ['expression'],
  isDefault: true,

  mockValue: (field) => {
    const rt = (field?.config as any)?.resultType || 'number';
    if (rt === 'boolean') return true;
    if (rt === 'date') return new Date().toISOString();
    if (rt === 'text') return 'Calculated value';
    return 1250;
  },

  RenderEdit: ({ field, value, className = '' }: FieldControlProps) => (
    <div className={`sails-input ${className}`} style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.8 }}>
      <Sigma size={13} style={{ color: 'var(--sails-text-muted, #94a3b8)', flexShrink: 0 }} />
      <span style={{ userSelect: 'none' }}>
        {value !== undefined && value !== null && value !== '' ? String(value) : '—'}
      </span>
      <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--sails-text-muted, #94a3b8)' }}>calculated</span>
    </div>
  ),

  RenderDisplay: ({ value }: FieldControlProps) => {
    if (value === undefined || value === null || value === '') return <span>—</span>;
    return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{String(value)}</span>;
  },
};
