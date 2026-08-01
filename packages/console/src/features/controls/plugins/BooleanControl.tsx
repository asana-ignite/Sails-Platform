import React from 'react';
import type { FieldControlPlugin, FieldControlProps } from '../types';

export const BooleanControl: FieldControlPlugin = {
  id: 'control:boolean',
  name: 'Boolean Switch / Checkbox',
  description: 'True/False toggle switch or checkbox control',
  iconName: 'ToggleRight',
  compatibleTypes: ['boolean'],
  isDefault: true,

  RenderEdit: ({ field, value, onChange, disabled, readOnly, className = '' }: FieldControlProps) => {
    const isChecked = Boolean(value);

    return (
      <label className={`inline-flex items-center gap-2.5 cursor-pointer select-none ${disabled || readOnly ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}>
        <input
          type="checkbox"
          checked={isChecked}
          disabled={disabled || readOnly}
          onChange={(e) => onChange && onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className="relative w-9 h-5 bg-slate-800/90 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-cyan-500/20 rounded-full border border-slate-700/80 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-400 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-600/90 peer-checked:border-cyan-500 peer-checked:after:bg-white"></div>
        <span className="text-xs font-medium text-slate-200">
          {isChecked ? 'Yes' : 'No'}
        </span>
      </label>
    );
  },

  RenderDisplay: ({ value }: FieldControlProps) => {
    const isTrue = Boolean(value);
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${isTrue ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
        {isTrue ? 'Yes' : 'No'}
      </span>
    );
  },
};
