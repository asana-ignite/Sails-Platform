import React from 'react';
import type { FieldControlPlugin, FieldControlProps } from '../types';

const parseBooleanValue = (val: any, defaultVal?: any): boolean => {
  if (val === true || val === 'true' || val === 1 || val === '1') return true;
  if (val === false || val === 'false' || val === 0 || val === '0') return false;
  if (defaultVal === true || defaultVal === 'true' || defaultVal === 1 || defaultVal === '1') return true;
  return false;
};

// ── 1. Toggle Switch Control ──────────────────────────────────
export const BooleanToggleControl: FieldControlPlugin = {
  id: 'control:boolean_toggle',
  name: 'Toggle Switch',
  description: 'True/False toggle switch control',
  iconName: 'ToggleRight',
  compatibleTypes: ['boolean'],
  isDefault: true,

  RenderEdit: ({ field, value, onChange, disabled, readOnly, className = '' }: FieldControlProps) => {
    const isChecked = parseBooleanValue(value, (field?.config as any)?.defaultValue);

    return (
      <div style={{ minHeight: 38, display: 'flex', alignItems: 'center' }}>
        <button
          type="button"
          role="switch"
          aria-checked={isChecked}
          disabled={disabled || readOnly}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (disabled || readOnly || !onChange) return;
            onChange(!isChecked);
          }}
          className={`inline-flex items-center cursor-pointer select-none ${disabled || readOnly ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            margin: 0,
            cursor: disabled || readOnly ? 'not-allowed' : 'pointer'
          }}
        >
          <div
            style={{
              position: 'relative',
              width: 38,
              height: 22,
              borderRadius: 9999,
              backgroundColor: isChecked ? 'var(--sails-primary, #0284c7)' : 'var(--sails-bg-subtle, #334155)',
              border: `1px solid ${isChecked ? 'var(--sails-primary, #0284c7)' : 'var(--sails-border-color, #475569)'}`,
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              flexShrink: 0
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 2,
                left: isChecked ? 18 : 2,
                width: 16,
                height: 16,
                borderRadius: 9999,
                backgroundColor: '#ffffff',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
              }}
            />
          </div>
        </button>
      </div>
    );
  },

  RenderDisplay: ({ field, value }: FieldControlProps) => {
    const isTrue = parseBooleanValue(value, (field?.config as any)?.defaultValue);
    return (
      <div style={{ minHeight: 38, display: 'flex', alignItems: 'center' }}>
        <div
          style={{
            position: 'relative',
            width: 32,
            height: 18,
            borderRadius: 9999,
            backgroundColor: isTrue ? 'var(--sails-primary, #0284c7)' : 'var(--sails-bg-subtle, #334155)',
            border: `1px solid ${isTrue ? 'var(--sails-primary, #0284c7)' : 'var(--sails-border-color, #475569)'}`,
            opacity: 0.85,
            display: 'inline-block'
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 2,
              left: isTrue ? 16 : 2,
              width: 12,
              height: 12,
              borderRadius: 9999,
              backgroundColor: '#ffffff'
            }}
          />
        </div>
      </div>
    );
  },
};

// ── 2. Pure Checkbox Control (No text label next to it) ───────
export const BooleanCheckboxControl: FieldControlPlugin = {
  id: 'control:boolean_checkbox',
  name: 'Checkbox (No Label)',
  description: 'Simple checkbox control without side text label',
  iconName: 'CheckSquare',
  compatibleTypes: ['boolean'],
  isDefault: false,

  RenderEdit: ({ field, value, onChange, disabled, readOnly, className = '' }: FieldControlProps) => {
    const isChecked = parseBooleanValue(value, (field?.config as any)?.defaultValue);

    return (
      <div style={{ minHeight: 38, display: 'flex', alignItems: 'center' }}>
        <button
          type="button"
          role="checkbox"
          aria-checked={isChecked}
          disabled={disabled || readOnly}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (disabled || readOnly || !onChange) return;
            onChange(!isChecked);
          }}
          className={`sails-checkbox ${disabled || readOnly ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
          style={{
            width: 18,
            height: 18,
            borderRadius: 5,
            border: `1px solid ${isChecked ? 'var(--sails-primary, #0284c7)' : 'var(--sails-border-color, #cbd5e1)'}`,
            backgroundColor: isChecked ? 'var(--sails-primary, #0284c7)' : 'var(--sails-bg-card, #ffffff)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: disabled || readOnly ? 'not-allowed' : 'pointer',
            padding: 0,
            transition: 'all 0.15s ease'
          }}
        >
          {isChecked && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      </div>
    );
  },

  RenderDisplay: ({ field, value }: FieldControlProps) => {
    const isChecked = parseBooleanValue(value, (field?.config as any)?.defaultValue);
    return (
      <div style={{ minHeight: 38, display: 'flex', alignItems: 'center' }}>
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: 5,
            border: `1px solid ${isChecked ? 'var(--sails-primary, #0284c7)' : 'var(--sails-border-color, #cbd5e1)'}`,
            backgroundColor: isChecked ? 'var(--sails-primary, #0284c7)' : 'var(--sails-bg-card, #ffffff)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.85
          }}
        >
          {isChecked && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>
      </div>
    );
  },
};

// ── 3. Dropdown Control (Custom Labels) ─────────────────────────
export const BooleanDropdownControl: FieldControlPlugin = {
  id: 'control:boolean_dropdown',
  name: 'Dropdown (Custom Labels)',
  description: 'Dropdown select control with customizable Yes / No option labels',
  iconName: 'ListFilter',
  compatibleTypes: ['boolean'],
  isDefault: false,

  RenderEdit: ({ field, value, onChange, disabled, readOnly, className = '' }: FieldControlProps) => {
    const isTrue = value === true || value === 'true';
    const isFalse = value === false || value === 'false';
    const stringVal = isTrue ? 'true' : isFalse ? 'false' : '';
    const trueLabel = (field?.config as any)?.trueLabel || 'Yes';
    const falseLabel = (field?.config as any)?.falseLabel || 'No';

    return (
      <select
        disabled={disabled || readOnly}
        value={stringVal}
        onChange={(e) => {
          if (!onChange) return;
          const val = e.target.value;
          onChange(val === 'true' ? true : val === 'false' ? false : null);
        }}
        className={`sails-input w-full ${className}`}
      >
        <option value="">Select option...</option>
        <option value="true">{trueLabel}</option>
        <option value="false">{falseLabel}</option>
      </select>
    );
  },

  RenderDisplay: ({ field, value }: FieldControlProps) => {
    const isTrue = value === true || value === 'true';
    const isFalse = value === false || value === 'false';
    const trueLabel = (field?.config as any)?.trueLabel || 'Yes';
    const falseLabel = (field?.config as any)?.falseLabel || 'No';
    return (
      <span className="text-xs text-slate-200">
        {isTrue ? trueLabel : isFalse ? falseLabel : '—'}
      </span>
    );
  },
};

// Backward compatibility default alias
export const BooleanControl = BooleanToggleControl;
