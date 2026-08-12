/**
 * AddressControl — structured address input (sub-fields).
 */
import React from 'react';
import { COUNTRY_OPTIONS } from '@sails/shared';
import type { FieldControlPlugin, FieldControlProps } from '../types';
import { CustomSelect } from '../../../components/common/CustomSelect';

interface AddressParts {
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
}

const EMPTY_PARTS: AddressParts = {};

const toParts = (value: any): AddressParts | null => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') {
    if (value.trim() === '') return null;
    // Structured addresses stored in TEXT columns come back as JSON strings.
    if (value.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as AddressParts;
      } catch {
        return null;
      }
    }
    return null; // legacy plain-string value
  }
  if (typeof value !== 'object') return null;
  return value as AddressParts;
};

const partValue = (parts: AddressParts, key: keyof AddressParts): string => {
  const v = parts[key];
  return typeof v === 'string' ? v : '';
};

export const AddressControl: FieldControlPlugin = {
  id: 'control:address',
  name: 'Address Field',
  description: 'Structured address (lines, city, state, searchable country, postal code) stored as JSON',
  iconName: 'MapPin',
  compatibleTypes: ['address'],
  isDefault: true,

  mockValue: (field) => {
    const cfg = (field?.config as any) || {};
    const parts: AddressParts = {};
    if (cfg.includeAddress1 !== false) parts.address1 = '123 Main St';
    if (cfg.includeAddress2 !== false) parts.address2 = 'Suite 400';
    if (cfg.includeCity !== false) parts.city = 'New York';
    if (cfg.includeState !== false) parts.state = 'NY';
    if (cfg.includeCountry !== false) parts.country = 'United States';
    if (cfg.includePostalCode !== false) parts.postalCode = '10001';
    return parts;
  },

  RenderEdit: ({ field, value, onChange, disabled, readOnly, className = '' }: FieldControlProps) => {
    const cfg = (field?.config as any) || {};
    const placeholder = cfg.placeholder || 'Enter address...';

    // Empty strings mean "no value yet" — those use the structured parts UI.
    // Legacy plain-string values (non-JSON, pre-structured TEXT columns) keep
    // the single-textarea mode. JSON-string values are structured and parse
    // into the parts UI via toParts below.
    if (typeof value === 'string' && value.trim() !== '' && !value.trim().startsWith('{')) {
      return (
        <textarea
          rows={2}
          readOnly={readOnly}
          disabled={disabled}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange && onChange(e.target.value)}
          className={`sails-input ${className}`}
          style={{ resize: 'vertical', minHeight: 56 }}
        />
      );
    }

    const parts = toParts(value) || EMPTY_PARTS;
    const include = (key: keyof AddressParts, cfgKey: string) =>
      (cfg[cfgKey] === undefined || cfg[cfgKey] === true) || (typeof parts[key] === 'string' && parts[key] !== '');

    const setPart = (key: keyof AddressParts, val: string) => {
      if (!onChange) return;
      const next: AddressParts = { ...parts };
      if (val.trim() === '') delete next[key];
      else next[key] = val;
      onChange(Object.keys(next).length > 0 ? next : null);
    };

    let countryList = COUNTRY_OPTIONS;
    if (cfg.countrySource === 'custom' && typeof cfg.countryOptions === 'string' && cfg.countryOptions.trim() !== '') {
      countryList = cfg.countryOptions.split(',').map((c: string) => c.trim()).filter(Boolean).map((c: string) => ({ value: c, label: c }));
    }
    const countrySearchable = cfg.countrySource !== 'custom';

    const row = (label: string, content: React.ReactNode) => (
      <div className="sails-address-control__row">
        <span className="sails-address-control__label">{label}</span>
        <div className="sails-address-control__control">{content}</div>
      </div>
    );

    return (
      <div className={`sails-address-control ${className}`}>
        {include('address1', 'includeAddress1') && (
          row('Address Line 1', (
            <input
              type="text"
              className="sails-input"
              readOnly={readOnly}
              disabled={disabled}
              value={partValue(parts, 'address1')}
              placeholder="Street address, P.O. box"
              onChange={(e) => setPart('address1', e.target.value)}
            />
          ))
        )}
        {include('address2', 'includeAddress2') && (
          row('Address Line 2', (
            <input
              type="text"
              className="sails-input"
              readOnly={readOnly}
              disabled={disabled}
              value={partValue(parts, 'address2')}
              placeholder="Apartment, suite, unit, building, floor, etc."
              onChange={(e) => setPart('address2', e.target.value)}
            />
          ))
        )}
        {include('city', 'includeCity') && (
          row('City / Province / State', (
            <input
              type="text"
              className="sails-input"
              readOnly={readOnly}
              disabled={disabled}
              value={partValue(parts, 'city')}
              placeholder="e.g. San Francisco / Bangkok / Bavaria"
              onChange={(e) => setPart('city', e.target.value)}
            />
          ))
        )}
        {include('state', 'includeState') && (
          row('State / Province', (
            <input
              type="text"
              className="sails-input"
              readOnly={readOnly}
              disabled={disabled}
              value={partValue(parts, 'state')}
              placeholder="e.g. NY / Bangkok"
              onChange={(e) => setPart('state', e.target.value)}
            />
          ))
        )}
        {include('country', 'includeCountry') && (
          row('Country', (
            <CustomSelect
              value={partValue(parts, 'country') || ''}
              options={countryList}
              onChange={(val) => setPart('country', val || '')}
              placeholder="Select or search country..."
              searchable={countrySearchable}
            />
          ))
        )}
        {include('postalCode', 'includePostalCode') && (
          row('Zip / Postal Code', (
            <input
              type="text"
              className="sails-input"
              readOnly={readOnly}
              disabled={disabled}
              value={partValue(parts, 'postalCode')}
              placeholder="e.g. 94105 / 10110"
              onChange={(e) => setPart('postalCode', e.target.value)}
            />
          ))
        )}
      </div>
    );
  },

  RenderDisplay: ({ value }: FieldControlProps) => {
    if (value === undefined || value === null || value === '') return <span>—</span>;
    const parts = toParts(value);
    if (!parts) {
      // Legacy plain-string value — render as-is.
      if (typeof value === 'string') {
        return (
          <span style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
            {value}
          </span>
        );
      }
      return <span>{String(value)}</span>;
    }
    const lines = [
      typeof parts.address1 === 'string' && parts.address1.trim() !== '' ? parts.address1 : null,
      typeof parts.address2 === 'string' && parts.address2.trim() !== '' ? parts.address2 : null,
      [parts.city, parts.state].filter((p) => typeof p === 'string' && (p as string).trim() !== '').join(', '),
      typeof parts.country === 'string' && parts.country.trim() !== '' ? parts.country : null,
      typeof parts.postalCode === 'string' && parts.postalCode.trim() !== '' ? parts.postalCode : null
    ].filter((l): l is string => l !== null && l.trim() !== '');
    if (lines.length === 0) return <span>—</span>;
    return (
      <span style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
        {lines.join('\n')}
      </span>
    );
  },
};
