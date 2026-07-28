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

