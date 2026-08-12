/**
 * NumberFormatInput — numeric input with thousands separators + decimal
 * clamping (shared by Number/Decimal/Currency/Percent controls).
 */
import React, { useEffect, useRef, useState } from 'react';
import type { SailsFieldDefinition } from '@sails/shared';
import {
  addThousandSeparators,
  clampDecimalInput,
  formatEditableValue,
  normalizeEditableValue,
  resolveDecimalPlaces,
  resolveThousandSeparator,
} from '@sails/shared';

// ---------------------------------------------------------------------------
// NumberFormatInput — text-based numeric input for number/decimal/currency/
// percentage controls.
//
// Why not <input type="number">? Browsers never display thousands separators
// in number inputs (commas are invalid there). This component renders a text
// input with `inputMode="decimal"` and:
//   - inserts commas live while typing (honors `useThousandSeparator` config)
//   - emits the RAW value (no commas) via onChange — what gets stored/sent
//   - clamps fractional digits to `decimalPlaces` at typing time
//   - normalizes to exactly `decimalPlaces` decimals on blur
// ---------------------------------------------------------------------------

interface NumberFormatInputProps {
  field: SailsFieldDefinition;
  /** Raw value (number or string — comma-free). */
  value: any;
  onChange?: (raw: string) => void;
  readOnly?: boolean;
  disabled?: boolean;
  /** Extra classes appended after the base input class. */
  className?: string;
  /** Base input class; override with '' when the wrapper supplies styling (e.g. currency). */
  baseClassName?: string;
  placeholder?: string;
  /** Extra styles merged over the default right-aligned layout. */
  style?: React.CSSProperties;
}

/** Keep only: leading minus, digits, and at most one decimal point. */
function stripSeparators(text: string): string {
  let hasDot = false;
  let out = '';
  for (const ch of text) {
    if (ch >= '0' && ch <= '9') {
      out += ch;
    } else if (ch === '.' && !hasDot) {
      hasDot = true;
      out += ch;
    } else if (ch === '-' && out === '') {
      out += ch;
    }
  }
  return out;
}

/** Caret position in a formatted string after `digits` digit characters. */
function positionAfterDigits(formatted: string, digits: number): number {
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i])) seen++;
    if (seen >= digits) return i + 1;
  }
  return formatted.length;
}

export const NumberFormatInput: React.FC<NumberFormatInputProps> = ({
  field,
  value,
  onChange,
  readOnly,
  disabled,
  className = '',
  baseClassName = 'sails-input',
  placeholder = '0',
  style,
}) => {
  const enabled = resolveThousandSeparator(field?.config, field?.logicalType);
  const dp = resolveDecimalPlaces(field?.config, field?.logicalType);
  const [text, setText] = useState(() => formatEditableValue(value, field?.config, field?.logicalType));
  const lastEmitted = useRef<any>(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external value changes (record load, clear, save) without
  // clobbering text while the user is typing.
  useEffect(() => {
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    setText(formatEditableValue(value, field?.config, field?.logicalType));
  }, [value, field]);

  // Re-format if the separator toggle / decimal places changed at runtime.
  useEffect(() => {
    setText(formatEditableValue(lastEmitted.current, field?.config, field?.logicalType));
  }, [enabled, dp, field]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const el = e.target;
    const caret = el.selectionStart ?? el.value.length;
    const digitsBefore = (el.value.slice(0, caret).match(/\d/g) || []).length;

    const raw = clampDecimalInput(stripSeparators(el.value), dp);
    lastEmitted.current = raw;
    onChange?.(raw);

    const formatted = formatEditableValue(raw, field?.config, field?.logicalType);
    setText(formatted);

    // Restore the caret right after the digit the user just edited.
    requestAnimationFrame(() => {
      const el2 = inputRef.current;
      if (!el2) return;
      const pos = positionAfterDigits(formatted, digitsBefore);
      el2.setSelectionRange(pos, pos);
    });
  }

  function handleBlur() {
    const raw = normalizeEditableValue(stripSeparators(text), field?.config, field?.logicalType);
    if (raw !== lastEmitted.current) {
      lastEmitted.current = raw;
      onChange?.(raw);
    }
    setText(formatEditableValue(raw, field?.config, field?.logicalType));
  }

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      readOnly={readOnly}
      disabled={disabled}
      value={text}
      placeholder={placeholder}
      onChange={handleChange}
      onBlur={handleBlur}
      className={[baseClassName, className].filter(Boolean).join(' ')}
      style={{ textAlign: 'right', ...style }}
    />
  );
};
