/**
 * FieldTypePlugin — the contract every field type implements:
 * physical column DDL (getPostgresColumnDefinition), zod schema for input
 * validation, and React components for form + table rendering.
 */
import React from 'react';
import { FieldParameterDefinition, PhysicalType } from '@sails/shared';

export interface FieldTypePlugin {
  type: string;
  label?: string;
  description?: string;
  iconName?: string;
  physicalType?: PhysicalType;
  parametersSchema?: FieldParameterDefinition[];
  getPostgresColumnDefinition: (isRequired?: boolean) => string;
  getZodSchema: (isRequired?: boolean) => any;
  RenderFormInput: React.FC<any>;
  RenderTableCell: React.FC<any>;
}

