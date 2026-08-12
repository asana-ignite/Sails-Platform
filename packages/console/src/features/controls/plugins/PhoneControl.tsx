/**
 * PhoneControl — phone input with country code.
 */
import React, { useEffect, useState } from 'react';
import type { FieldControlPlugin, FieldControlProps } from '../types';
import { CustomSelect } from '../../../components/common/CustomSelect';
import type { SelectOption } from '../../../components/common/CustomSelect';
import { PHONE_COUNTRY_OPTIONS, phoneFlag } from '@sails/shared';

/** Split a stored phone value into country-code prefix + national number.
 *  Prefers the field's configured country code (deterministic); falls back
 *  to a leading +<1-3 digits> match for values with a different code. */
function splitPhone(value: any, fallbackPrefix: string): { prefix: string; number: string } {
  const raw = String(value ?? '').trim();
  const fb = (fallbackPrefix || '').trim();
  if (fb && raw.startsWith(fb)) {
    return { prefix: fb, number: raw.slice(fb.length).trim() };
  }
  const m = raw.match(/^\+\d{1,3}/);
  if (m) return { prefix: m[0], number: raw.slice(m[0].length).trim() };
  return { prefix: fb, number: raw };
}

/** Join prefix + national number back into a single stored value.
 *  A leading national '0' is dropped when a country code is present. */
function joinPhone(prefix: string, number: string): string {
  const p = (prefix || '').trim();
  const n = (number || '').trim();
  if (!p) return n;
  return `${p}${n.startsWith('0') ? n.slice(1) : n}`;
}

// ISO-2 as the select value keeps every option unique (US + CA share '+1');
// the dial code is looked up from the ISO code on change.
const COUNTRY_SELECT_OPTIONS: SelectOption[] = PHONE_COUNTRY_OPTIONS.map(c => ({
  value: c.iso2,
  label: `${c.name} (${c.value})`,
  icon: phoneFlag(c.iso2)
}));

function iso2ForPrefix(prefix: string): string {
  return PHONE_COUNTRY_OPTIONS.find(c => c.value === prefix)?.iso2 || '';
}

function prefixForSelectValue(selectValue: string): string {
  const c = PHONE_COUNTRY_OPTIONS.find(x => x.iso2 === selectValue);
  return c ? c.value : selectValue;
}

export const PhoneControl: FieldControlPlugin = {
  id: 'control:phone',
  name: 'Phone with Country Code',
  description: 'Searchable country-code (flag) dropdown separated from the number, clickable to call in display mode',
  iconName: 'Phone',
  compatibleTypes: ['phone'],
  isDefault: true,

  mockValue: (field) => {
    const cfg = (field?.config as any) || {};
    return `${cfg.defaultCountryCode || '+66'} 81 234 5678`;
  },

  RenderEdit: ({ field, value, onChange, disabled, readOnly, className = '' }: FieldControlProps) => {
    const fallbackPrefix = (field?.config as any)?.defaultCountryCode || '+66';
    const placeholder = (field?.config as any)?.placeholder || 'e.g. 81 234 5678';

    const [prefix, setPrefix] = useState(() => splitPhone(value, fallbackPrefix).prefix);
    const [number, setNumber] = useState(() => splitPhone(value, fallbackPrefix).number);

    useEffect(() => {
      if (String(value ?? '') !== joinPhone(prefix, number)) {
        const split = splitPhone(value, fallbackPrefix);
        setPrefix(split.prefix);
        setNumber(split.number);
      }
    }, [value]);

    const emit = (p: string, n: string) => onChange && onChange(joinPhone(p, n));

    // A stored prefix that is not in the country list (foreign/legacy codes)
    // still renders via a fallback entry so the trigger shows the real code.
    const selectedIso2 = iso2ForPrefix(prefix);
    let options = COUNTRY_SELECT_OPTIONS;
    let selectValue = selectedIso2;
    if (prefix && !selectedIso2) {
      options = [
        { value: prefix, label: `${prefix} (custom code)`, icon: '📞' },
        ...COUNTRY_SELECT_OPTIONS
      ];
      selectValue = prefix;
    }

    return (
      <div className={`sails-phone-control ${className}`}>
        <CustomSelect
          size="md"
          searchable
          value={selectValue}
          options={options}
          disabled={disabled || readOnly}
          onChange={(val) => {
            const p = prefixForSelectValue(String(val ?? ''));
            setPrefix(p);
            emit(p, number);
          }}
          placeholder="+66"
          style={{ flex: '0 0 212px' }}
        />
        <input
          type="tel"
          className="sails-input sails-phone-number"
          readOnly={readOnly}
          disabled={disabled}
          value={number}
          placeholder={placeholder}
          inputMode="tel"
          onChange={(e) => {
            setNumber(e.target.value);
            emit(prefix, e.target.value);
          }}
        />
      </div>
    );
  },

  RenderDisplay: ({ field, value }: FieldControlProps) => {
    const cfg = (field?.config as any) || {};
    const fallbackPrefix = cfg.defaultCountryCode || '+66';
    const raw = String(value ?? '').trim();
    if (!raw) return <span>—</span>;

    const { prefix, number } = splitPhone(raw, fallbackPrefix);
    const displayText = prefix ? `${prefix} ${number}`.trim() : number;
    const telRaw = `${prefix}${number}`.replace(/[^\d+]/g, '');

    return (
      <a className="sails-phone-link" href={`tel:${telRaw}`} title={`Call ${displayText}`}>
        {displayText}
      </a>
    );
  },
};
