/**
 * Lat/Lng — geographic coordinates (jsonb).
 */
import React from 'react';
import { z } from 'zod';
import { FieldTypePlugin } from '../FieldTypePlugin';

export const LatLngType: FieldTypePlugin = {
  type: 'lat_lng',
  label: 'Latitude / Longitude',
  description: 'Geographic coordinates (latitude, longitude) stored as JSONB',
  iconName: 'MapPin',
  physicalType: 'jsonb',
  parametersSchema: [
    { name: 'placeholder', label: 'Input Placeholder', type: 'text', placeholder: 'e.g. 13.7563, 100.5018' },
    { name: 'allowGetCurrentLocation', label: 'Allow Get Current Location', type: 'boolean', defaultValue: true, description: 'Show the GPS capture button on this field' }
  ],
  getPostgresColumnDefinition: (isRequired?: boolean) => {
    return `JSONB${isRequired ? ' NOT NULL' : ''}`;
  },
  getZodSchema: (isRequired?: boolean) => {
    // Accept structured { lat, lng } objects or legacy "lat, lng" strings.
    const latLngObject = z.object({
      lat: z.number(),
      lng: z.number()
    }).passthrough();
    const union = z.union([z.string(), latLngObject]);
    if (!isRequired) return union.optional().nullable();
    return union.refine((v) => {
      if (typeof v === 'string') return v.trim().length > 0;
      return typeof v.lat === 'number' && typeof v.lng === 'number';
    }, { message: 'Required field' });
  },
  RenderFormInput: (props: any) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let parsed: any = e.target.value;
      try { parsed = JSON.parse(e.target.value); } catch { /* keep raw string */ }
      props?.onChange?.(parsed);
    };
    const value = typeof props?.value === 'string' ? props.value : JSON.stringify(props?.value ?? '');
    return <input type="text" className="form-input" {...props} value={value} onChange={handleChange} />;
  },
  RenderTableCell: (props: { value: any }) => {
    const v = props?.value;
    if (v === undefined || v === null) return <span />;
    if (typeof v === 'string') return <span>{v}</span>;
    return <span>{`${v.lat}, ${v.lng}`}</span>;
  }
};
