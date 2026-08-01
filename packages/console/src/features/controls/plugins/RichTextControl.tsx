import React, { useState, useRef } from 'react';
import { Bold, Italic, List, ListOrdered, Link, RemoveFormatting, Code } from 'lucide-react';
import type { FieldControlPlugin, FieldControlProps } from '../types';

export const RichTextControl: FieldControlPlugin = {
  id: 'control:rich_text',
  name: 'Rich Text Editor',
  description: 'WYSIWYG formatted HTML content editor',
  iconName: 'FileText',
  compatibleTypes: ['rich_text'],
  isDefault: true,

  RenderEdit: ({ field, value, onChange, disabled, readOnly, className = '' }: FieldControlProps) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const [htmlContent, setHtmlContent] = useState<string>(value ?? '');
    const placeholder = (field?.config as any)?.placeholder || `Provide formatted ${field?.name || 'content'}...`;

    const execCommand = (command: string, value: string | undefined = undefined) => {
      document.execCommand(command, false, value);
      if (editorRef.current) {
        const updated = editorRef.current.innerHTML;
        setHtmlContent(updated);
        if (onChange) onChange(updated);
      }
    };

    const handleInput = () => {
      if (editorRef.current) {
        const updated = editorRef.current.innerHTML;
        setHtmlContent(updated);
        if (onChange) onChange(updated);
      }
    };

    return (
      <div className={`w-full flex flex-col border border-slate-700/80 bg-slate-900/90 rounded-lg overflow-hidden ${disabled || readOnly ? 'opacity-60 cursor-not-allowed' : ''} ${className}`}>
        {/* WYSIWYG Formatting Bar */}
        <div className="flex items-center gap-1 px-2 py-1.5 bg-slate-800/80 border-b border-slate-700/70 select-none">
          <button
            type="button"
            disabled={disabled || readOnly}
            onClick={() => execCommand('bold')}
            title="Bold (Ctrl+B)"
            className="p-1 rounded text-slate-300 hover:text-cyan-300 hover:bg-slate-700/60 transition-colors"
          >
            <Bold size={13} />
          </button>
          <button
            type="button"
            disabled={disabled || readOnly}
            onClick={() => execCommand('italic')}
            title="Italic (Ctrl+I)"
            className="p-1 rounded text-slate-300 hover:text-cyan-300 hover:bg-slate-700/60 transition-colors"
          >
            <Italic size={13} />
          </button>
          <div className="w-[1px] h-4 bg-slate-700 mx-1" />
          <button
            type="button"
            disabled={disabled || readOnly}
            onClick={() => execCommand('insertUnorderedList')}
            title="Bullet List"
            className="p-1 rounded text-slate-300 hover:text-cyan-300 hover:bg-slate-700/60 transition-colors"
          >
            <List size={13} />
          </button>
          <button
            type="button"
            disabled={disabled || readOnly}
            onClick={() => execCommand('insertOrderedList')}
            title="Numbered List"
            className="p-1 rounded text-slate-300 hover:text-cyan-300 hover:bg-slate-700/60 transition-colors"
          >
            <ListOrdered size={13} />
          </button>
          <div className="w-[1px] h-4 bg-slate-700 mx-1" />
          <button
            type="button"
            disabled={disabled || readOnly}
            onClick={() => {
              const url = prompt('Enter Link URL:');
              if (url) execCommand('createLink', url);
            }}
            title="Insert Link"
            className="p-1 rounded text-slate-300 hover:text-cyan-300 hover:bg-slate-700/60 transition-colors"
          >
            <Link size={13} />
          </button>
          <button
            type="button"
            disabled={disabled || readOnly}
            onClick={() => execCommand('removeFormat')}
            title="Clear Formatting"
            className="p-1 rounded text-slate-400 hover:text-red-300 hover:bg-slate-700/60 transition-colors ml-auto"
          >
            <RemoveFormatting size={13} />
          </button>
        </div>

        {/* Contenteditable Editor Body */}
        <div
          ref={editorRef}
          contentEditable={!disabled && !readOnly}
          onInput={handleInput}
          dangerouslySetInnerHTML={{ __html: htmlContent || '' }}
          data-placeholder={placeholder}
          className="p-3 text-xs text-slate-200 min-h-[90px] max-h-[220px] overflow-y-auto outline-none prose prose-invert max-w-none empty:before:content-[attr(data-placeholder)] empty:before:text-slate-500/80"
        />
      </div>
    );
  },

  RenderDisplay: ({ value }: FieldControlProps) => {
    if (!value) return <span className="text-xs text-slate-500">—</span>;
    return (
      <div
        className="text-xs text-slate-200 prose prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: String(value) }}
      />
    );
  },
};
