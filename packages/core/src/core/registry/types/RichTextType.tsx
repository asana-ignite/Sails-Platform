import React from 'react';
import { z } from 'zod';
import { FieldTypePlugin } from '../FieldTypePlugin';

export const RichTextType: FieldTypePlugin = {
  type: 'rich_text',
  label: 'Rich Text',
  description: 'Formatted HTML content with WYSIWYG editor',
  iconName: 'FileText',
  physicalType: 'text',
  parametersSchema: [
    { name: 'placeholder', label: 'Input Placeholder', type: 'text', placeholder: 'Enter formatted content...' },
    { name: 'toolbarFull', label: 'Full Toolbar (Font, Color, Table, Full Screen)', type: 'boolean', defaultValue: true }
  ],
  getPostgresColumnDefinition: (isRequired?: boolean) => {
    return `TEXT${isRequired ? ' NOT NULL' : ''}`;
  },
  getZodSchema: (isRequired?: boolean) => {
    const schema = z.string();
    return isRequired ? schema : schema.optional();
  },
  RenderFormInput: (props: any) => {
    return <textarea className="form-input" rows={4} {...props} />;
  },
  RenderTableCell: (props: { value: any }) => {
    if (!props.value) return <span></span>;
    // Strip tags for clean table preview
    const cleanText = String(props.value).replace(/<[^>]*>?/gm, '');
    return <span title={cleanText}>{cleanText}</span>;
  }
};
