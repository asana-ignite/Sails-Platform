import React from 'react';
import { MapPin } from 'lucide-react';
import type { FieldControlPlugin, FieldControlProps } from '../types';

interface LatLngValue {
  lat: number;
  lng: number;
}

const parseValue = (value: any): LatLngValue => {
  if (value && typeof value === 'object' && 'lat' in value && 'lng' in value) {
    return { lat: Number(value.lat), lng: Number(value.lng) };
  }
  if (typeof value === 'string' && value.includes(',')) {
    const [lat, lng] = value.split(',').map((s) => Number(s.trim()));
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }
  return { lat: NaN, lng: NaN };
};

const fmt = (n: number) => (isNaN(n) ? '' : n.toFixed(4));

export const LatLngControl: FieldControlPlugin = {
  id: 'control:lat_lng',
  name: 'Latitude / Longitude',
  description: 'Geographic coordinates input (latitude, longitude)',
  iconName: 'MapPin',
  compatibleTypes: ['lat_lng'],
  isDefault: true,

  mockValue: () => ({ lat: 13.7563, lng: 100.5018 }),

  RenderEdit: ({ value, onChange, disabled, readOnly, className = '' }: FieldControlProps) => {
    const coords = parseValue(value);

    const update = (key: 'lat' | 'lng', raw: string) => {
      if (!onChange) return;
      const next = { ...coords };
      const num = Number(raw);
      next[key] = raw === '' ? NaN : num;
      if (isNaN(next.lat) && isNaN(next.lng)) {
        onChange('');
        return;
      }
      onChange({ lat: isNaN(next.lat) ? 0 : next.lat, lng: isNaN(next.lng) ? 0 : next.lng });
    };

    return (
      <div className={`sails-control-latlng ${className}`} style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            type="number"
            step="any"
            readOnly={readOnly}
            disabled={disabled}
            value={fmt(coords.lat)}
            placeholder="Latitude"
            onChange={(e) => update('lat', e.target.value)}
            className="sails-input"
          />
        </div>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            type="number"
            step="any"
            readOnly={readOnly}
            disabled={disabled}
            value={fmt(coords.lng)}
            placeholder="Longitude"
            onChange={(e) => update('lng', e.target.value)}
            className="sails-input"
          />
        </div>
      </div>
    );
  },

  RenderDisplay: ({ value }: FieldControlProps) => {
    const coords = parseValue(value);
    if (isNaN(coords.lat) || isNaN(coords.lng)) return <span>—</span>;
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        <MapPin size={13} />
        {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
      </span>
    );
  },
};
