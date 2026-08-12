/**
 * LookupControl — searchable relation/lookup combobox.
 */
import React from 'react';
import { User, Search, X, ExternalLink } from 'lucide-react';
import type { FieldControlPlugin, FieldControlProps } from '../types';
import '../controls.css';

export const LookupControl: FieldControlPlugin = {
  id: 'control:lookup',
  name: 'Lookup Combobox Search',
  description: 'Searchable relational record picker with entity card preview',
  iconName: 'User',
  compatibleTypes: ['lookup', 'relation'],
  isDefault: true,

  mockValue: () => 'Sample Record',

  // ── ON-EDIT MODE (Interactive Form Input) ──
  RenderEdit: ({ field, value, onChange, disabled, readOnly, className = '' }: FieldControlProps) => {
    const targetTable = (field?.config as any)?.targetTable || 'records';
    const displayVal = typeof value === 'object' ? value?.name || value?.title || value?.id : value;

    return (
      <div className={`sails-input sails-control-lookup ${className}`}>
        <Search size={14} className="sails-control-lookup__icon" />
        <input
          type="text"
          readOnly={readOnly}
          disabled={disabled}
          value={displayVal || ''}
          onChange={(e) => onChange && onChange(e.target.value)}
          placeholder={`Search ${targetTable}...`}
          className="sails-control-lookup__input"
        />
        {displayVal && (
          <button
            type="button"
            onClick={() => onChange && onChange('')}
            className="sails-control-lookup__clear"
          >
            <X size={12} />
          </button>
        )}
        <span className="sails-control-lookup__badge">
          {targetTable}
        </span>
      </div>
    );
  },

  // ── ON-DISPLAY MODE (Clean Entity Link) ──
  RenderDisplay: ({ field, value }: FieldControlProps) => {
    if (value === undefined || value === null || value === '') {
      return <span>—</span>;
    }

    const displayVal = typeof value === 'object' ? value?.name || value?.title || value?.id : value;

    return (
      <span className="sails-control-lookup-display">
        {String(displayVal)}
      </span>
    );
  },
};
