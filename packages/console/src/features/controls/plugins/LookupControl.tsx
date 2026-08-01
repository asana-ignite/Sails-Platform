import React from 'react';
import { User, Search, X, ExternalLink } from 'lucide-react';
import type { FieldControlPlugin, FieldControlProps } from '../types';

export const LookupControl: FieldControlPlugin = {
  id: 'control:lookup',
  name: 'Lookup Combobox Search',
  description: 'Searchable relational record picker with entity card preview',
  iconName: 'User',
  compatibleTypes: ['lookup', 'relation'],
  isDefault: true,

  // ── ON-EDIT MODE (Interactive Form Input) ──
  RenderEdit: ({ field, value, onChange, disabled, readOnly, className = '' }: FieldControlProps) => {
    const targetTable = (field?.config as any)?.targetTable || 'records';
    const displayVal = typeof value === 'object' ? value?.name || value?.title || value?.id : value;

    return (
      <div className={`sails-input flex items-center gap-2 w-full ${className}`}>
        <Search size={14} className="text-slate-400 shrink-0" />
        <input
          type="text"
          readOnly={readOnly}
          disabled={disabled}
          value={displayVal || ''}
          onChange={(e) => onChange && onChange(e.target.value)}
          placeholder={`Search ${targetTable}...`}
          className="bg-transparent border-none outline-none w-full text-slate-200 placeholder:text-slate-500"
        />
        {displayVal && (
          <button
            type="button"
            onClick={() => onChange && onChange('')}
            className="text-slate-400 hover:text-slate-200 p-0.5 rounded"
          >
            <X size={12} />
          </button>
        )}
        <span className="bg-cyan-500/10 text-cyan-400 text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 border border-cyan-500/20">
          {targetTable}
        </span>
      </div>
    );
  },

  // ── ON-DISPLAY MODE (Clean Entity Link) ──
  RenderDisplay: ({ field, value }: FieldControlProps) => {
    if (value === undefined || value === null || value === '') {
      return <span className="text-slate-500 text-xs">—</span>;
    }

    const displayVal = typeof value === 'object' ? value?.name || value?.title || value?.id : value;

    return (
      <span className="sails-control-lookup-display text-xs text-blue-400 font-medium hover:underline cursor-pointer">
        {String(displayVal)}
      </span>
    );
  },
};
