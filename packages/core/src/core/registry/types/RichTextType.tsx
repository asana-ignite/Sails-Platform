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
    { name: 'toolbarPreset', label: 'Toolbar Features', type: 'select', defaultValue: 'standard', options: [
      { label: 'Minimal (Bold, Italic, Underline)', value: 'minimal' },
      { label: 'Standard (Formatting, Lists, Link)', value: 'standard' },
      { label: 'Full (Headers, Font, Table, Code)', value: 'full' }
    ]}
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
