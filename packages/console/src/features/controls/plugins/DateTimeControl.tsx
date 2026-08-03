import React, { useState, useRef, useEffect, useMemo } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, X, Clock } from 'lucide-react';
import { useDateTimePrefs, resolveControlDisplayText } from '../../../utils/systemDateTime';
import type { FieldControlPlugin, FieldControlProps } from '../types';
import { SailsTimePicker } from './TimeControl';
import '../controls.css';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

interface SailsDateTimePickerProps {
  value?: string;
  displayText?: string;
  onChange?: (val: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  placeholder?: string;
}

export const SailsDateTimePicker: React.FC<SailsDateTimePickerProps> = ({
  value,
  displayText,
  onChange,
  disabled,
  readOnly,
  className = '',
  placeholder = 'YYYY-MM-DD HH:MM'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse current date and time parts from ISO or formatted string
  const [datePart, timePart] = useMemo(() => {
    if (!value) return ['', '12:00'];
    const parts = value.includes('T') ? value.split('T') : value.split(' ');
    const d = parts[0] || '';
    const t = parts[1] ? parts[1].substring(0, 5) : '12:00';
    return [d, t];
  }, [value]);

  const selectedDate = useMemo(() => {
    if (!datePart) return null;
    const parts = datePart.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        return new Date(year, month, day);
      }
    }
    return null;
  }, [datePart]);

  const [viewYear, setViewYear] = useState<number>(selectedDate ? selectedDate.getFullYear() : new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(selectedDate ? selectedDate.getMonth() : new Date().getMonth());
  const [inputTime, setInputTime] = useState<string>(timePart);

  useEffect(() => {
    if (selectedDate) {
      setViewYear(selectedDate.getFullYear());
      setViewMonth(selectedDate.getMonth());
    }
    if (timePart) {
      setInputTime(timePart);
    }
  }, [selectedDate, timePart]);

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
    const newDatePart = `${viewYear}-${mStr}-${dStr}`;
    const newDateTime = `${newDatePart}T${inputTime || '12:00'}`;
    if (onChange) onChange(newDateTime);
  };

  const handleTimeChange = (newTime: string) => {
    setInputTime(newTime);
    if (!datePart || !onChange) return;
    onChange(newTime ? `${datePart}T${newTime}` : datePart);
  };

  const handleNow = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || readOnly) return;
    const now = new Date();
    const mStr = String(now.getMonth() + 1).padStart(2, '0');
    const dStr = String(now.getDate()).padStart(2, '0');
    const hStr = String(now.getHours()).padStart(2, '0');
    const minStr = String(now.getMinutes()).padStart(2, '0');
    const newDateTime = `${now.getFullYear()}-${mStr}-${dStr}T${hStr}:${minStr}`;
    if (onChange) onChange(newDateTime);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || readOnly) return;
    if (onChange) onChange('');
    setIsOpen(false);
  };

  const displayVal = value ? value.replace('T', ' ') : '';
  const today = new Date();
  const isTodayCurrentView = today.getFullYear() === viewYear && today.getMonth() === viewMonth;

  return (
    <div ref={containerRef} className="sails-picker__wrapper">
      <div
        className={`sails-input sails-datetime-input-container ${disabled || readOnly ? 'disabled' : ''} ${className}`}
        onClick={() => !disabled && !readOnly && setIsOpen((prev) => !prev)}
      >
        <span className={`sails-picker__text ${displayVal ? 'sails-picker__text--filled' : ''}`}>
          {displayText || displayVal || placeholder}
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
          <CalendarDays size={15} className="sails-picker__icon" />
        )}
      </div>

      {isOpen && (
        <div className="sails-datetime-popover">
          {/* Header */}
          <div className="sails-popover__header">
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

          {/* Weekdays */}
          <div className="sails-popover__weekdays">
            {WEEKDAYS.map((wd) => (
              <span key={wd} className="sails-popover__weekday">
                {wd}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="sails-popover__days">
            {Array.from({ length: startWeekday }).map((_, idx) => (
              <span
                key={`prev-${idx}`}
                className="sails-popover__day sails-popover__day--muted"
              >
                {prevMonthDays - startWeekday + idx + 1}
              </span>
            ))}

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

          {/* Time Picker Bar — uses the themed SailsTimePicker (same as the
              standalone TimeControl) so icon/selection/hover match the theme */}
          <div className="sails-popover__time-bar">
            <div className="sails-popover__time-label">
              <Clock size={14} />
              <span>Time:</span>
            </div>
            <SailsTimePicker
              value={inputTime}
              onChange={handleTimeChange}
              className="sails-time-input--bar"
            />
          </div>

          {/* Footer Actions */}
          <div className="sails-popover__footer">
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

export const DateTimeControl: FieldControlPlugin = {
  id: 'control:datetime',
  name: 'Date & Time Picker Input',
  description: 'Theme-aligned calendar date and timestamp picker control',
  iconName: 'CalendarDays',
  compatibleTypes: ['datetime', 'timestamp'],
  isDefault: true,

  mockValue: () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    return `${date} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  },

  RenderEdit: ({ field, value, onChange, disabled, readOnly, className = '' }: FieldControlProps) => {
    const prefs = useDateTimePrefs();
    return (
      <SailsDateTimePicker
        value={value ? String(value) : ''}
        displayText={resolveControlDisplayText(field, value, prefs, 'datetime')}
        onChange={(val) => onChange && onChange(val)}
        disabled={disabled}
        readOnly={readOnly}
        className={className}
      />
    );
  },

  RenderDisplay: ({ field, value }: FieldControlProps) => {
    const prefs = useDateTimePrefs();
    const formatted = resolveControlDisplayText(field, value, prefs, 'datetime');
    return <span>{formatted || '—'}</span>;
  },
};
