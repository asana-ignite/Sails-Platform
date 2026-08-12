/**
 * EmailControl — email input with format validation.
 */
import React, { useEffect, useRef, useState } from 'react';
import type { FieldControlPlugin, FieldControlProps } from '../types';
import { X } from 'lucide-react';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseAddresses(value: any): string[] {
  return String(value ?? '')
    .split(/[,;]/)
    .map(s => s.trim())
    .filter(Boolean);
}

function isValidEmail(s: string): boolean {
  return EMAIL_REGEX.test(s);
}

export const EmailControl: FieldControlPlugin = {
  id: 'control:email',
  name: 'Email (mailto link)',
  description: 'Email input with click-to-compose (mailto) display',
  iconName: 'Mail',
  compatibleTypes: ['email'],
  isDefault: true,

  mockValue: () => 'user@example.com',

  RenderEdit: ({ field, value, onChange, disabled, readOnly, className = '' }: FieldControlProps) => {
    const cfg = (field?.config as any) || {};
    const placeholder = cfg.placeholder || `Enter ${field?.name || 'email'}...`;
    const allowMultiple = !!cfg.allowMultiple;

    // Chip input for both modes: multiple addresses append, single mode keeps
    // at most one chip (typing a new address replaces the existing one).
    const [chips, setChips] = useState<string[]>(() =>
      allowMultiple
        ? parseAddresses(value)
        : (String(value ?? '').trim() ? [String(value ?? '').trim()] : [])
    );
    const [draft, setDraft] = useState('');
    const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      const expected = allowMultiple ? chips.join(', ') : (chips[0] ?? '');
      if (String(value ?? '') !== expected) {
        setChips(
          allowMultiple
            ? parseAddresses(value)
            : (String(value ?? '').trim() ? [String(value ?? '').trim()] : [])
        );
      }
    }, [value]);

    const emit = (next: string[]) => onChange && onChange(next.join(', '));

    const commitDraft = (): boolean => {
      const addr = draft.trim();
      if (!addr || !isValidEmail(addr)) return false;
      const next = allowMultiple ? [...chips, addr] : [addr];
      setChips(next);
      setDraft('');
      setSelectedIdx(null);
      emit(next);
      return true;
    };

    const removeChip = (idx: number) => {
      const next = chips.filter((_, i) => i !== idx);
      setChips(next);
      setSelectedIdx(null);
      emit(next);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === ',' || e.key === ';' || e.key === 'Enter') {
        e.preventDefault();
        commitDraft();
      } else if (e.key === 'Tab') {
        commitDraft();
      } else if (e.key === 'Backspace') {
        if (selectedIdx !== null) {
          e.preventDefault();
          removeChip(selectedIdx);
        } else if (draft === '' && chips.length > 0) {
          e.preventDefault();
          setSelectedIdx(chips.length - 1);
        }
      } else if (e.key === 'Escape') {
        setSelectedIdx(null);
      }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const parts = e.clipboardData
        .getData('text')
        .split(/[,;]/)
        .map(s => s.trim())
        .filter(Boolean);
      const valid = parts.filter(isValidEmail);
      const invalid = parts.filter(p => !isValidEmail(p));
      const picked = allowMultiple ? valid : valid.slice(0, 1);
      if (picked.length > 0) {
        const next = allowMultiple ? [...chips, ...picked] : [picked[0]];
        setChips(next);
        emit(next);
      }
      setDraft(invalid.join(', '));
    };

    const handleBlur = () => {
      if (draft.trim() && isValidEmail(draft.trim())) {
        commitDraft();
      }
      setSelectedIdx(null);
    };

    return (
      <div
        className={`sails-email-chips ${className}${readOnly ? ' is-readonly' : ''}`}
        onClick={() => inputRef.current && inputRef.current.focus()}
      >
        {chips.map((addr, i) => (
          <span key={`${addr}_${i}`} className={`sails-email-chip ${selectedIdx === i ? 'sails-email-chip--selected' : ''}`}>
            <a
              className="sails-email-chip__link"
              href={`mailto:${addr}`}
              title={`Send email to ${addr}`}
              onClick={(e) => e.stopPropagation()}
            >
              {addr}
            </a>
            {!disabled && !readOnly && (
              <button
                type="button"
                className="sails-email-chip__remove"
                title="Remove address"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  removeChip(i);
                }}
              >
                <X size={11} />
              </button>
            )}
          </span>
        ))}
        {!disabled && !readOnly && (
          <input
            ref={inputRef}
            type="text"
            className="sails-email-chips__input"
            value={draft}
            placeholder={chips.length === 0 ? placeholder : ''}
            inputMode="email"
            onChange={(e) => {
              setDraft(e.target.value);
              setSelectedIdx(null);
            }}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onBlur={handleBlur}
          />
        )}
        {draft.trim() !== '' && !isValidEmail(draft.trim()) && (
          <span className="sails-email-chips__hint">Invalid email — press Enter when corrected</span>
        )}
      </div>
    );
  },

  RenderDisplay: ({ field, value }: FieldControlProps) => {
    const raw = String(value ?? '').trim();
    if (!raw) return <span>—</span>;

    const cfg = (field?.config as any) || {};
    const allowMultiple = !!cfg.allowMultiple;
    const addresses = allowMultiple ? parseAddresses(raw) : [raw];
    if (addresses.length === 0) return <span>—</span>;

    return (
      <span className="sails-email-list">
        {addresses.map((addr, i) => (
          <React.Fragment key={`${addr}_${i}`}>
            {i > 0 && <span className="sails-email-list__sep">, </span>}
            <a className="sails-email-link" href={`mailto:${addr}`} title={`Send email to ${addr}`}>
              {addr}
            </a>
          </React.Fragment>
        ))}
      </span>
    );
  },
};
