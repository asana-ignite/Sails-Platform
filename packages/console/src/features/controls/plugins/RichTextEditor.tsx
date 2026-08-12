/**
 * RichTextEditor — WYSIWYG editor implementation.
 */
import React from 'react';
import type { FieldControlProps } from '../types';
import { SailsHtmlEditor, type SailsHtmlEditorPreset } from '../../../components/shared/SailsHtmlEditor';
import '../controls.css';

/** Normalizes SunEditor's empty-body markup to '' for storage. */
const normalizeEmpty = (html: string): string => {
  const trimmed = html.replace(/<p><br><\/p>/gi, '').replace(/<div><br><\/div>/gi, '').trim();
  return trimmed === '' || trimmed === '<p></p>' || trimmed === '<div></div>' ? '' : html;
};

export const RichTextEdit: React.FC<FieldControlProps> = ({ field, value, onChange, disabled, readOnly, className = '' }) => {
  const config = (field?.config as any) || {};
  // Full toolbar by default; only an explicit OFF (toggle unchecked / legacy
  // `minimal` preset) downgrades to the standard set.
  const preset: SailsHtmlEditorPreset =
    config.toolbarFull === false || config.toolbarPreset === 'minimal' ? 'standard' : 'full';

  const isEditable = !disabled && !readOnly;
  const rows = config.rows || 5;

  return (
    <div className={`sails-richtext ${!isEditable ? 'sails-richtext--disabled' : ''} ${className}`}>
      <SailsHtmlEditor
        mode="toolbar"
        toolbarPreset={preset}
        value={value ?? ''}
        onChange={(html) => onChange?.(normalizeEmpty(html))}
        readOnly={readOnly}
        disabled={disabled}
        placeholder={config.placeholder || 'Type something…'}
        height="auto"
        minHeight={rows * 24}
      />
    </div>
  );
};

export default RichTextEdit;
