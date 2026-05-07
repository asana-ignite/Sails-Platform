import React from 'react';

export interface FieldTypePlugin {
  type: string;
  getPostgresColumnDefinition: (isRequired?: boolean) => string;
  getZodSchema: (isRequired?: boolean) => any;
  RenderFormInput: React.FC<any>;
  RenderTableCell: React.FC<any>;
}
