import React, { useEffect, useState } from 'react';
import type { FieldControlPlugin, FieldControlProps } from '../types';
import { CustomSelect } from '../../../components/common/CustomSelect';
import '../controls.css';

interface LookupOptionsProps {
  field: FieldControlProps['field'];
  value: any;
  onChange?: (val: any) => void;
  disabled?: boolean;
  readOnly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/** Live option loader for Selection fields with a "Lookup Values from Data Model" source. */
const LookupOptions: React.FC<LookupOptionsProps> = ({ field, value, onChange, disabled, readOnly, size }) => {
  const cfg = (field.config || {}) as any;
  const sourceTable: string = cfg?.sourceTable || '';
  const sourceColumn: string = cfg?.sourceColumn || '';
  const sourceFilter = Array.isArray(cfg?.sourceFilter) ? (cfg.sourceFilter as any[]) : [];
  const filterKey = JSON.stringify(sourceFilter);

  const [options, setOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sourceTable || !sourceColumn) {
      setOptions([]);
      setLoading(false);
      return;
    }

    let mounted = true;
    setLoading(true);

    (async () => {
      try {
        const params = new URLSearchParams();
        params.set('column', sourceColumn);
        if (sourceFilter.length > 0) params.set('filterGroups', JSON.stringify(sourceFilter));
        params.set('limit', '500');

        const res = await fetch(`/api/dynamic/${encodeURIComponent(sourceTable)}/options?${params.toString()}`);
        const data = await res.json();
        if (mounted) setOptions(Array.isArray(data?.options) ? data.options : []);
      } catch (err) {
        console.error('[SelectControl] Failed to load lookup options:', err);
        if (mounted) setOptions([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [sourceTable, sourceColumn, filterKey]);

  if (loading) {
    return (
      <CustomSelect
        value=""
        options={[]}
        placeholder="Loading options..."
        size={size === 'lg' ? 'lg' : size === 'sm' ? 'sm' : 'md'}
        disabled
        onChange={() => {}}
        className="sails-custom-select--full sails-custom-select--field"
      />
    );
  }

  return (
    <CustomSelect
      value={value ?? ''}
      options={options}
      placeholder={options.length > 0 ? 'Select option...' : 'No matching values'}
      size={size === 'lg' ? 'lg' : size === 'sm' ? 'sm' : 'md'}
      searchable
      disabled={disabled || readOnly}
      onChange={(newVal) => onChange && onChange(newVal)}
      className="sails-custom-select--full sails-custom-select--field"
    />
  );
};

export const SelectControl: FieldControlPlugin = {
  id: 'control:select',
  name: 'Select Dropdown',
  description: 'Single-option selection dropdown control',
  iconName: 'ListFilter',
  compatibleTypes: ['select', 'enum'],
  isDefault: true,

  mockValue: (field) => {
    const opts = (field.config as any)?.options || [];
    return opts[0]?.value ?? 'option_1';
  },

  RenderEdit: ({ field, value, onChange, disabled, readOnly, size = 'sm' }: FieldControlProps) => {
    const cfg = (field.config as any) || {};
    const isLookup = cfg?.sourceType === 'object' && !!cfg?.sourceTable && !!cfg?.sourceColumn;

    if (isLookup) {
      return (
        <LookupOptions
          field={field}
          value={value}
          onChange={onChange}
          disabled={disabled}
          readOnly={readOnly}
          size={size}
        />
      );
    }

    const rawOptions: Array<{ label: string; value: string }> = cfg?.options || [];
    const formattedOptions = rawOptions.map((o) => ({ label: o.label, value: o.value }));

    return (
      <CustomSelect
        value={value ?? ''}
        options={formattedOptions}
        placeholder="Select option..."
        size={size === 'lg' ? 'lg' : size === 'sm' ? 'sm' : 'md'}
        disabled={disabled || readOnly}
        onChange={(newVal) => onChange && onChange(newVal)}
        className="sails-custom-select--full sails-custom-select--field"
      />
    );
  },

  RenderDisplay: ({ field, value }: FieldControlProps) => {
    if (value === undefined || value === null || value === '') return <span>—</span>;
    const options: Array<{ label: string; value: string }> = (field.config as any)?.options || [];
    const found = options.find((o) => o.value === value);
    const label = found ? found.label : String(value);

    return <span>{label}</span>;
  },
};
