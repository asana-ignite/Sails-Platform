import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Clock, X } from 'lucide-react';
import { formatDateTimeValue } from '@sails/shared';
import type { FieldControlPlugin, FieldControlProps } from '../types';
import '../controls.css';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

interface SailsTimePickerProps {
  value?: string;
  displayText?: string;
  onChange?: (val: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  placeholder?: string;
}

export const SailsTimePicker: React.FC<SailsTimePickerProps> = ({
  value,
  displayText,
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
    <div ref={containerRef} className="sails-picker__wrapper">
      <div
        className={`sails-input sails-time-input-container ${disabled || readOnly ? 'disabled' : ''} ${className}`}
        onClick={() => !disabled && !readOnly && setIsOpen((prev) => !prev)}
      >
        <span className={`sails-picker__text ${value ? 'sails-picker__text--filled' : ''}`}>
          {displayText || value || placeholder}
        </span>
        {value && !disabled && !readOnly ? (
          <X
            size={14}
            className="sails-picker__clear"
            onClick={(e) => {
              e.stopPropagation();
              if (onChange) onChange('');
            }}
          />
        ) : (
          <Clock size={15} className="sails-picker__icon" />
        )}
      </div>

      {isOpen && (
        <div className="sails-time-popover">
          <div className="sails-popover__header sails-popover__header--compact">
            <span className="sails-popover__title">
              Select Time ({selectedHour}:{selectedMinute})
            </span>
          </div>

          <div className="sails-popover__time-grid">
            {/* Hours Column */}
            <div className="sails-time-col">
              <span className="sails-time-col__label">Hour</span>
              {HOURS.map((h) => {
                const isSel = selectedHour === h;
                return (
                  <button
                    key={`h-${h}`}
                    type="button"
                    onClick={() => handleSelectHour(h)}
                    className={`sails-picker__time-option ${isSel ? 'sails-picker__time-option--selected' : ''}`}
                  >
                    {h}
                  </button>
                );
              })}
            </div>

            {/* Minutes Column */}
            <div className="sails-time-col">
              <span className="sails-time-col__label">Minute</span>
              {MINUTES.map((m) => {
                const isSel = selectedMinute === m;
                return (
                  <button
                    key={`m-${m}`}
                    type="button"
                    onClick={() => handleSelectMinute(m)}
                    className={`sails-picker__time-option ${isSel ? 'sails-picker__time-option--selected' : ''}`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="sails-popover__footer sails-popover__footer--compact">
            <button type="button" className="sails-popover__action sails-popover__action--danger" onClick={handleClear}>
              Clear
            </button>
            <button type="button" className="sails-popover__action sails-popover__action--primary" onClick={handleNow}>
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

  mockValue: () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  },

  RenderEdit: ({ field, value, onChange, disabled, readOnly, className = '' }: FieldControlProps) => (
    <SailsTimePicker
      value={value ? String(value) : ''}
      displayText={value ? formatDateTimeValue(value, field?.config, field.logicalType || 'time') : ''}
      onChange={(val) => onChange && onChange(val)}
      disabled={disabled}
      readOnly={readOnly}
      className={className}
    />
  ),

  RenderDisplay: ({ field, value }: FieldControlProps) => {
    const formatted = value ? formatDateTimeValue(value, field?.config, field.logicalType || 'time') : '';
    return <span>{formatted || '—'}</span>;
  },
};
