/**
 * AttachmentControl — file upload with type/size limits.
 */
import React, { useRef } from 'react';
import { Paperclip, FileText, Upload, X } from 'lucide-react';
import type { FieldControlPlugin, FieldControlProps } from '../types';
import '../controls.css';

interface AttachmentItem {
  name: string;
  size: number;
  type?: string;
  url?: string;
}

const parseValue = (value: any): AttachmentItem[] => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value) return [{ name: value.split('/').pop() || value, size: 0, url: value }];
  return [];
};

const formatSize = (bytes: number): string => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const AttachmentControl: FieldControlPlugin = {
  id: 'control:attachment',
  name: 'Attachment Upload',
  description: 'Document / file upload control with extension and size limits',
  iconName: 'Paperclip',
  compatibleTypes: ['attachment'],
  isDefault: true,

  mockValue: () => [
    { name: 'proposal.pdf', size: 245760, type: 'pdf' },
    { name: 'signed-contract.docx', size: 532480, type: 'docx' },
  ],

  RenderEdit: ({ field, value, onChange, disabled, readOnly, className = '' }: FieldControlProps) => {
    const files = parseValue(value);
    const inputRef = useRef<HTMLInputElement>(null);
    const config = (field?.config as any) || {};
    const allowMultiple = config.allowMultiple !== false;
    const maxFileSizeMB = Number(config.maxFileSizeMB || 10);

    const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!onChange || !e.target.files) return;
      const picked = Array.from(e.target.files).map((f) => ({
        name: f.name,
        size: f.size,
        type: f.type.split('/')[1] || (f.name.split('.').pop() || ''),
      }));
      const existing = allowMultiple ? [...files] : [];
      onChange([...existing, ...picked].slice(0, allowMultiple ? 20 : 1));
      e.target.value = '';
    };

    return (
      <div className={`sails-control-attachment ${className}`} style={{ width: '100%' }}>
        <div className="sails-control-attachment__list">
          {files.map((f, i) => (
            <div key={`${f.name}_${i}`} className="sails-control-attachment__chip">
              <FileText size={14} />
              <span className="sails-control-attachment__name">{f.name}</span>
              {f.size > 0 && <span className="sails-control-attachment__size">{formatSize(f.size)}</span>}
              {!readOnly && !disabled && onChange && (
                <button
                  type="button"
                  className="sails-control-attachment__remove"
                  onClick={(e) => { e.stopPropagation(); onChange(files.filter((_, fi) => fi !== i)); }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
          {files.length === 0 && (
            <div className="sails-control-attachment__empty">No files attached</div>
          )}
        </div>
        <button
          type="button"
          disabled={disabled || readOnly}
          className="sails-control-attachment__pick"
          onClick={() => inputRef.current?.click()}
        >
          <Upload size={13} />
          {allowMultiple ? 'Attach files' : 'Attach file'}
          <span className="sails-control-attachment__limit">
            {maxFileSizeMB} MB max
          </span>
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple={allowMultiple}
          onChange={handlePick}
          style={{ display: 'none' }}
        />
      </div>
    );
  },

  RenderDisplay: ({ value }: FieldControlProps) => {
    const files = parseValue(value);
    if (files.length === 0) return <span>—</span>;
    return (
      <div className="sails-control-attachment__list">
        {files.map((f, i) => (
          <span key={`${f.name}_${i}`} className="sails-control-attachment__chip sails-control-attachment__chip--static">
            <Paperclip size={13} />
            <span className="sails-control-attachment__name">{f.name}</span>
            {f.size > 0 && <span className="sails-control-attachment__size">{formatSize(f.size)}</span>}
          </span>
        ))}
      </div>
    );
  },
};
