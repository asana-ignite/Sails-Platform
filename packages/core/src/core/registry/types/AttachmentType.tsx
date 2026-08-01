import React from 'react';
import { z } from 'zod';
import { FieldTypePlugin } from '../FieldTypePlugin';

export const AttachmentType: FieldTypePlugin = {
  type: 'attachment',
  label: 'Attachment / File',
  description: 'Document or file upload with file type extension limits',
  iconName: 'Paperclip',
  physicalType: 'text',
  parametersSchema: [
    {
      name: 'allowedExtensions',
      label: 'Allowed File Extensions (Limit File Types)',
      type: 'text',
      placeholder: 'e.g. pdf, docx, png, jpg, csv, xlsx',
      defaultValue: 'pdf, docx, png, jpg'
    },
    {
      name: 'maxFileSizeMB',
      label: 'Max File Size Limit (MB)',
      type: 'number',
      defaultValue: 10,
      min: 1,
      max: 500
    },
    {
      name: 'allowMultiple',
      label: 'Allow Multiple File Uploads',
      type: 'boolean',
      defaultValue: false
    }
  ],
  getPostgresColumnDefinition: (isRequired?: boolean) => {
    return `TEXT${isRequired ? ' NOT NULL' : ''}`;
  },
  getZodSchema: (isRequired?: boolean) => {
    const schema = z.string();
    return isRequired ? schema.min(1, 'Required field') : schema.optional();
  },
  RenderFormInput: (props: any) => {
    return <input type="file" className="form-input-file" {...props} />;
  },
  RenderTableCell: (props: { value: any }) => {
    if (!props.value) return <span></span>;
    return <span>📎 {String(props.value)}</span>;
  }
};
