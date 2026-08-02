import React from 'react';
import { Hash } from 'lucide-react';
import type { FieldControlPlugin, FieldControlProps } from '../types';

// Format an auto-number from the field's prefix pattern.
// Supports date tokens ({yyyy}, {yy}, {mm}, {dd}) and trailing zero
// padding for the sequence (e.g. "INV-0000" -> "INV-0001").
export function formatAutoNumber(field: FieldControlProps['field'], seq: number = 1): string {
  const pattern = (field?.config as any)?.prefix || 'AUTO-0000';
  const now = new Date();
  const pad2 = (n: number) => String(n).padStart(2, '0');

  let out = pattern
    .replace(/\{yyyy\}/gi, String(now.getFullYear()))
    .replace(/\{yy\}/gi, String(now.getFullYear()).slice(-2))
    .replace(/\{mm\}/gi, pad2(now.getMonth() + 1))
    .replace(/\{dd\}/gi, pad2(now.getDate()));

  const zeroRun = out.match(/0+$/);
  if (zeroRun && zeroRun.index !== undefined) {
    out = out.slice(0, zeroRun.index) + String(seq).padStart(zeroRun[0].length, '0');
  } else if (!/\d/.test(out)) {
    out = `${out}-${String(seq).padStart(4, '0')}`;
  }
  return out;
}

export const AutoNumberControl: FieldControlPlugin = {
  id: 'control:auto_number',
  name: 'Auto Number',
  description: 'Read-only auto-incrementing formatted identifier',
  iconName: 'Binary',
  compatibleTypes: ['auto_number'],
  isDefault: true,

  mockValue: (field) => formatAutoNumber(field, 1),

  RenderEdit: ({ field, value, className = '' }: FieldControlProps) => (
    <div className={`sails-input ${className}`} style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.8 }}>
      <Hash size={13} style={{ color: 'var(--sails-text-muted, #94a3b8)', flexShrink: 0 }} />
      <span style={{ fontVariantNumeric: 'tabular-nums', userSelect: 'none' }}>
        {value !== undefined && value !== null && value !== '' ? String(value) : formatAutoNumber(field, 1)}
      </span>
      <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--sails-text-muted, #94a3b8)' }}>auto</span>
    </div>
  ),

  RenderDisplay: ({ value }: FieldControlProps) => {
    if (value === undefined || value === null || value === '') return <span>—</span>;
    return (
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
        {String(value)}
      </span>
    );
  },
};
