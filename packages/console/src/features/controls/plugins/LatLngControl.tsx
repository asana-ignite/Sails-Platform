/**
 * LatLngControl — latitude/longitude input (optional GPS capture).
 */
import React, { useState } from 'react';
import { MapPinned, LocateFixed } from 'lucide-react';
import type { FieldControlPlugin, FieldControlProps } from '../types';

interface LatLngValue {
  lat: number;
  lng: number;
}

const parseValue = (value: any): LatLngValue => {
  if (value && typeof value === 'object' && 'lat' in value && 'lng' in value) {
    return { lat: Number(value.lat), lng: Number(value.lng) };
  }
  if (typeof value === 'string' && value.trim() !== '') {
    // Structured values stored in legacy TEXT columns come back as JSON strings.
    if (value.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === 'object' && 'lat' in parsed && 'lng' in parsed) {
          return { lat: Number(parsed.lat), lng: Number(parsed.lng) };
        }
      } catch {
        /* fall through */
      }
    }
    if (value.includes(',')) {
      const [lat, lng] = value.split(',').map((s) => Number(s.trim()));
      if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
    }
  }
  return { lat: NaN, lng: NaN };
};

const fmt = (n: number) => (isNaN(n) ? '' : n.toFixed(6));

export const LatLngControl: FieldControlPlugin = {
  id: 'control:lat_lng',
  name: 'Latitude / Longitude',
  description: 'Geographic coordinates with GPS capture and Google Maps link',
  iconName: 'MapPinned',
  compatibleTypes: ['lat_lng'],
  isDefault: true,

  mockValue: () => ({ lat: 13.7563, lng: 100.5018 }),

  RenderEdit: ({ field, value, onChange, disabled, readOnly, className = '' }: FieldControlProps) => {
    const cfg = (field?.config as any) || {};
    const allowGps = cfg.allowGetCurrentLocation !== false;
    const coords = parseValue(value);
    const [gpsState, setGpsState] = useState<'idle' | 'loading' | 'error' | 'unsupported'>('idle');

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

    const handlePairPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      const text = e.clipboardData.getData('text/plain').trim();
      const m = text.match(/^\s*([+-]?\d+(?:\.\d+)?)\s*[,;\s]\s*([+-]?\d+(?:\.\d+)?)\s*$/);
      if (!m || isNaN(Number(m[1])) || isNaN(Number(m[2])) || !onChange) return;
      e.preventDefault();
      setGpsState('idle');
      onChange({ lat: Number(m[1]), lng: Number(m[2]) });
    };

    const getCurrentLocation = () => {
      if (!onChange) return;
      if (!('geolocation' in navigator)) {
        setGpsState('unsupported');
        return;
      }
      setGpsState('loading');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsState('idle');
          onChange({
            lat: Number(pos.coords.latitude.toFixed(6)),
            lng: Number(pos.coords.longitude.toFixed(6))
          });
        },
        () => setGpsState('error'),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    };

    return (
      <div className={`sails-control-latlng ${className}`}>
        <div className="sails-control-latlng__row">
          <input
            type="number"
            step="any"
            readOnly={readOnly}
            disabled={disabled}
            value={fmt(coords.lat)}
            placeholder="Latitude"
            onChange={(e) => update('lat', e.target.value)}
            onPaste={handlePairPaste}
            className="sails-input"
          />
          <input
            type="number"
            step="any"
            readOnly={readOnly}
            disabled={disabled}
            value={fmt(coords.lng)}
            placeholder="Longitude"
            onChange={(e) => update('lng', e.target.value)}
            onPaste={handlePairPaste}
            className="sails-input"
          />
          {allowGps && (
            <button
              type="button"
              className="sails-latlng-gps-btn"
              disabled={disabled || readOnly || gpsState === 'loading'}
              onClick={getCurrentLocation}
              title={gpsState === 'loading' ? 'Locating...' : 'Get current GPS location'}
            >
              <LocateFixed size={14} className={gpsState === 'loading' ? 'sails-latlng-gps-btn__spin' : ''} />
            </button>
          )}
        </div>
        {gpsState === 'error' && (
          <span className="sails-latlng-hint">Location unavailable — check browser/device permissions.</span>
        )}
        {gpsState === 'unsupported' && (
          <span className="sails-latlng-hint">Geolocation is not supported on this device/browser.</span>
        )}
      </div>
    );
  },

  RenderDisplay: ({ value }: FieldControlProps) => {
    const coords = parseValue(value);
    if (isNaN(coords.lat) || isNaN(coords.lng)) return <span>—</span>;
    const lat = coords.lat.toFixed(6);
    const lng = coords.lng.toFixed(6);
    return (
      <a
        className="sails-latlng-link"
        href={`https://www.google.com/maps?q=${lat},${lng}`}
        target="_blank"
        rel="noreferrer"
        title={`View ${lat}, ${lng} on Google Maps`}
      >
        <MapPinned size={14} />
        {lat}, {lng}
      </a>
    );
  },
};
