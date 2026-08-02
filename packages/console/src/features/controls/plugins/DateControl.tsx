import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { FieldControlPlugin, FieldControlProps } from '../types';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

interface SailsDatePickerProps {
  value?: string;
  onChange?: (val: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  placeholder?: string;
}

export const SailsDatePicker: React.FC<SailsDatePickerProps> = ({
  value,
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
    <div ref={containerRef} style={{ position: 'relative', width: '100%', display: 'inline-block' }}>
      <div
        className={`sails-input sails-date-input-container ${disabled || readOnly ? 'disabled' : ''} ${className}`}
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
          <Calendar size={15} style={{ color: 'var(--sails-primary, #0284c7)', flexShrink: 0 }} />
        )}
      </div>

      {isOpen && (
        <div
          className="sails-date-popover"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 9999,
            width: 280,
            padding: 16,
            borderRadius: 14,
            background: 'var(--sails-bg-card, #ffffff)',
            border: '1px solid var(--sails-border-color, #e2e8f0)',
            boxShadow: '0 12px 36px rgba(15, 23, 42, 0.14), 0 4px 12px rgba(0, 0, 0, 0.05)',
            backdropFilter: 'blur(16px)',
            fontFamily: 'var(--sails-font-sans, system-ui, -apple-system, sans-serif)',
            animation: 'sailsFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--sails-text-main, #0f172a)' }}>
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                type="button"
                className="sails-btn sails-btn--ghost"
                onClick={handlePrevMonth}
                style={{ padding: 4, borderRadius: 6, cursor: 'pointer', border: 'none', background: 'transparent' }}
              >
                <ChevronLeft size={16} style={{ color: 'var(--sails-text-main)' }} />
              </button>
              <button
                type="button"
                className="sails-btn sails-btn--ghost"
                onClick={handleNextMonth}
                style={{ padding: 4, borderRadius: 6, cursor: 'pointer', border: 'none', background: 'transparent' }}
              >
                <ChevronRight size={16} style={{ color: 'var(--sails-text-main)' }} />
              </button>
            </div>
          </div>

          {/* Weekday Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 6, textAlign: 'center' }}>
            {WEEKDAYS.map((wd) => (
              <span key={wd} style={{ fontSize: 11, fontWeight: 600, color: 'var(--sails-text-muted, #64748b)', padding: '4px 0' }}>
                {wd}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, textAlign: 'center' }}>
            {/* Leading blank days from previous month */}
            {Array.from({ length: startWeekday }).map((_, idx) => (
              <span
                key={`prev-${idx}`}
                style={{
                  fontSize: 12,
                  padding: '6px 0',
                  color: 'var(--sails-text-muted, #cbd5e1)',
                  opacity: 0.35,
                  userSelect: 'none'
                }}
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

              return (
                <button
                  type="button"
                  key={`day-${dayNum}`}
                  onClick={() => handleSelectDay(dayNum)}
                  style={{
                    fontSize: 12,
                    fontWeight: isSelected || isToday ? 700 : 500,
                    padding: '6px 0',
                    borderRadius: 8,
                    border: isToday && !isSelected ? '1px solid var(--sails-primary, #0284c7)' : '1px solid transparent',
                    background: isSelected
                      ? 'var(--sails-primary, #0284c7)'
                      : 'transparent',
                    color: isSelected
                      ? '#ffffff'
                      : isToday
                      ? 'var(--sails-primary, #0284c7)'
                      : 'var(--sails-text-main, #0f172a)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(2, 132, 199, 0.1)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }
                  }}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>

          {/* Footer Actions */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 12,
              paddingTop: 10,
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
              onClick={handleSelectToday}
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

  RenderEdit: ({ value, onChange, disabled, readOnly, className = '' }: FieldControlProps) => (
    <SailsDatePicker
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
