import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Clock, X } from 'lucide-react';
import type { FieldControlPlugin, FieldControlProps } from '../types';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

interface SailsTimePickerProps {
  value?: string;
  onChange?: (val: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  placeholder?: string;
}

export const SailsTimePicker: React.FC<SailsTimePickerProps> = ({
  value,
  onChange,
  disabled,
  readOnly,
  className = '',
  placeholder = 'HH:MM'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [selectedHour, selectedMinute] = useMemo(() => {
    if (!value) return ['12', '00'];
    const parts = value.split(':');
    const h = parts[0] ? parts[0].padStart(2, '0') : '12';
    const m = parts[1] ? parts[1].padStart(2, '0') : '00';
    return [h, m];
  }, [value]);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelectHour = (h: string) => {
    if (disabled || readOnly) return;
    const newTime = `${h}:${selectedMinute}`;
    if (onChange) onChange(newTime);
  };

  const handleSelectMinute = (m: string) => {
    if (disabled || readOnly) return;
    const newTime = `${selectedHour}:${m}`;
    if (onChange) onChange(newTime);
  };

  const handleNow = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || readOnly) return;
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    if (onChange) onChange(`${h}:${m}`);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || readOnly) return;
    if (onChange) onChange('');
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', display: 'inline-block' }}>
      <div
        className={`sails-input sails-time-input-container ${disabled || readOnly ? 'disabled' : ''} ${className}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: disabled || readOnly ? 'not-allowed' : 'pointer',
          padding: '7px 12px',
          borderRadius: 8,
          border: '1px solid var(--sails-border-color, #cbd5e1)',
          background: 'var(--sails-bg-card, #ffffff)',
          color: 'var(--sails-text-main, #0f172a)',
          fontSize: 13,
          boxSizing: 'border-box',
          width: '100%'
        }}
        onClick={() => !disabled && !readOnly && setIsOpen((prev) => !prev)}
      >
        <span style={{ flex: 1, color: value ? 'var(--sails-text-main, #0f172a)' : 'var(--sails-text-muted, #94a3b8)' }}>
          {value || placeholder}
        </span>
        {value && !disabled && !readOnly ? (
          <X
            size={14}
            style={{ color: 'var(--sails-text-muted)', cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              if (onChange) onChange('');
            }}
          />
        ) : (
          <Clock size={15} style={{ color: 'var(--sails-primary, #0284c7)', flexShrink: 0 }} />
        )}
      </div>

      {isOpen && (
        <div
          className="sails-time-popover"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 9999,
            width: 190,
            padding: 14,
            borderRadius: 14,
            background: 'var(--sails-bg-card, #ffffff)',
            border: '1px solid var(--sails-border-color, #e2e8f0)',
            boxShadow: '0 12px 36px rgba(15, 23, 42, 0.14), 0 4px 12px rgba(0, 0, 0, 0.05)',
            backdropFilter: 'blur(16px)',
            fontFamily: 'var(--sails-font-sans, system-ui, -apple-system, sans-serif)',
            animation: 'sailsFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--sails-text-main, #0f172a)' }}>
              Select Time ({selectedHour}:{selectedMinute})
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, height: 160 }}>
            {/* Hours Column */}
            <div className="sails-time-col" style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingRight: 2 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--sails-text-muted)', marginBottom: 2 }}>Hour</span>
              {HOURS.map((h) => {
                const isSel = selectedHour === h;
                return (
                  <button
                    key={`h-${h}`}
                    type="button"
                    onClick={() => handleSelectHour(h)}
                    style={{
                      padding: '4px 8px',
                      fontSize: 13,
                      borderRadius: 6,
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'center',
                      background: isSel ? 'var(--sails-primary, #0284c7)' : 'transparent',
                      color: isSel ? '#ffffff' : 'var(--sails-text-main, #0f172a)',
                      fontWeight: isSel ? 700 : 400
                    }}
                  >
                    {h}
                  </button>
                );
              })}
            </div>

            {/* Minutes Column */}
            <div className="sails-time-col" style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingRight: 2 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--sails-text-muted)', marginBottom: 2 }}>Minute</span>
              {MINUTES.map((m) => {
                const isSel = selectedMinute === m;
                return (
                  <button
                    key={`m-${m}`}
                    type="button"
                    onClick={() => handleSelectMinute(m)}
                    style={{
                      padding: '4px 8px',
                      fontSize: 13,
                      borderRadius: 6,
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'center',
                      background: isSel ? 'var(--sails-primary, #0284c7)' : 'transparent',
                      color: isSel ? '#ffffff' : 'var(--sails-text-main, #0f172a)',
                      fontWeight: isSel ? 700 : 400
                    }}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 10,
              paddingTop: 8,
              borderTop: '1px solid var(--sails-border-color, #f1f5f9)'
            }}
          >
            <button
              type="button"
              onClick={handleClear}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--sails-danger, #ef4444)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: 6
              }}
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleNow}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--sails-primary, #0284c7)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: 6
              }}
            >
              Now
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const TimeControl: FieldControlPlugin = {
  id: 'control:time',
  name: 'Time Picker Input',
  description: 'Theme-aligned clock time picker control',
  iconName: 'Clock',
  compatibleTypes: ['time'],
  isDefault: true,

  RenderEdit: ({ value, onChange, disabled, readOnly, className = '' }: FieldControlProps) => (
    <SailsTimePicker
      value={value ? String(value) : ''}
      onChange={(val) => onChange && onChange(val)}
      disabled={disabled}
      readOnly={readOnly}
      className={className}
    />
  ),

  RenderDisplay: ({ value }: FieldControlProps) => (
    <span className="text-xs text-slate-200">{value ? String(value) : '—'}</span>
  ),
};
