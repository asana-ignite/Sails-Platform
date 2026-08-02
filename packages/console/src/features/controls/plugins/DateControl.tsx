import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { formatDateTimeValue } from '@sails/shared';
import type { FieldControlPlugin, FieldControlProps } from '../types';
import '../controls.css';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

interface SailsDatePickerProps {
  value?: string;
  displayText?: string;
  onChange?: (val: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  placeholder?: string;
}

export const SailsDatePicker: React.FC<SailsDatePickerProps> = ({
  value,
  displayText,
  onChange,
  disabled,
  readOnly,
  className = '',
  placeholder = 'YYYY-MM-DD'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse current selected date or fallback to today
  const selectedDate = useMemo(() => {
    if (!value) return null;
    const parts = value.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        return new Date(year, month, day);
      }
    }
    return null;
  }, [value]);

  const [viewYear, setViewYear] = useState<number>(selectedDate ? selectedDate.getFullYear() : new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(selectedDate ? selectedDate.getMonth() : new Date().getMonth());

  // Sync view when selectedDate changes
  useEffect(() => {
    if (selectedDate) {
      setViewYear(selectedDate.getFullYear());
      setViewMonth(selectedDate.getMonth());
    }
  }, [selectedDate]);

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

  // Calculate days for current view month
  const daysInMonth = useMemo(() => new Date(viewYear, viewMonth + 1, 0).getDate(), [viewYear, viewMonth]);
  const startWeekday = useMemo(() => new Date(viewYear, viewMonth, 1).getDay(), [viewYear, viewMonth]);
  const prevMonthDays = useMemo(() => new Date(viewYear, viewMonth, 0).getDate(), [viewYear, viewMonth]);

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    if (disabled || readOnly) return;
    const mStr = String(viewMonth + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    const dateStr = `${viewYear}-${mStr}-${dStr}`;
    if (onChange) onChange(dateStr);
    setIsOpen(false);
  };

  const handleSelectToday = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || readOnly) return;
    const now = new Date();
    const mStr = String(now.getMonth() + 1).padStart(2, '0');
    const dStr = String(now.getDate()).padStart(2, '0');
    const dateStr = `${now.getFullYear()}-${mStr}-${dStr}`;
    if (onChange) onChange(dateStr);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || readOnly) return;
    if (onChange) onChange('');
    setIsOpen(false);
  };

  const today = new Date();
  const isTodayCurrentView = today.getFullYear() === viewYear && today.getMonth() === viewMonth;

  return (
    <div ref={containerRef} className="sails-picker__wrapper">
      <div
        className={`sails-input sails-date-input-container ${disabled || readOnly ? 'disabled' : ''} ${className}`}
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
          <Calendar size={15} className="sails-picker__icon" />
        )}
      </div>

      {isOpen && (
        <div className="sails-date-popover">
          {/* Header */}
          <div className="sails-popover__header sails-popover__header--compact">
            <span className="sails-popover__title">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <div className="sails-popover__nav">
              <button
                type="button"
                className="sails-btn sails-btn--ghost sails-popover__nav-btn"
                onClick={handlePrevMonth}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                className="sails-btn sails-btn--ghost sails-popover__nav-btn"
                onClick={handleNextMonth}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Weekday Grid */}
          <div className="sails-popover__weekdays">
            {WEEKDAYS.map((wd) => (
              <span key={wd} className="sails-popover__weekday">
                {wd}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="sails-popover__days">
            {/* Leading blank days from previous month */}
            {Array.from({ length: startWeekday }).map((_, idx) => (
              <span
                key={`prev-${idx}`}
                className="sails-popover__day sails-popover__day--muted"
              >
                {prevMonthDays - startWeekday + idx + 1}
              </span>
            ))}

            {/* Current month days */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const isSelected =
                selectedDate &&
                selectedDate.getFullYear() === viewYear &&
                selectedDate.getMonth() === viewMonth &&
                selectedDate.getDate() === dayNum;
              const isToday = isTodayCurrentView && today.getDate() === dayNum;

              const dayClass = [
                'sails-popover__day',
                isSelected ? 'sails-popover__day--selected' : '',
                isToday ? 'sails-popover__day--today' : ''
              ].filter(Boolean).join(' ');

              return (
                <button
                  type="button"
                  key={`day-${dayNum}`}
                  className={dayClass}
                  onClick={() => handleSelectDay(dayNum)}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>

          {/* Footer Actions */}
          <div className="sails-popover__footer">
            <button type="button" className="sails-popover__action sails-popover__action--danger" onClick={handleClear}>
              Clear
            </button>
            <button type="button" className="sails-popover__action sails-popover__action--primary" onClick={handleSelectToday}>
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const DateControl: FieldControlPlugin = {
  id: 'control:date',
  name: 'Date Picker Input',
  description: 'Theme-aligned calendar date picker control',
  iconName: 'Calendar',
  compatibleTypes: ['date'],
  isDefault: true,

  mockValue: () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  },

  RenderEdit: ({ field, value, onChange, disabled, readOnly, className = '' }: FieldControlProps) => (
    <SailsDatePicker
      value={value ? String(value) : ''}
      displayText={value ? formatDateTimeValue(value, field?.config, field.logicalType || 'date') : ''}
      onChange={(val) => onChange && onChange(val)}
      disabled={disabled}
      readOnly={readOnly}
      className={className}
    />
  ),

  RenderDisplay: ({ field, value }: FieldControlProps) => {
    const formatted = value ? formatDateTimeValue(value, field?.config, field.logicalType || 'date') : '';
    return <span>{formatted || '—'}</span>;
  },
};
