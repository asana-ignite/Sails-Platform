import React, { useCallback, useEffect } from 'react';
import {
  Bold, Italic, Underline, List, ListOrdered, Link, Strikethrough,
  RemoveFormatting, Code, Table2, Heading1, Heading2, Heading3
} from 'lucide-react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TipTapUnderline from '@tiptap/extension-underline';
import TipTapLink from '@tiptap/extension-link';
import { TextStyle } from '@tiptap/extension-text-style';
import FontFamily from '@tiptap/extension-font-family';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import type { FieldControlPlugin, FieldControlProps } from '../types';
import './RichTextControl.css';

const FONT_OPTIONS = [
  { label: 'Inter', value: 'Inter, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Monospace', value: "'Courier New', monospace" },
  { label: 'Impact', value: 'Impact, sans-serif' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
];

const ToolbarBtn: React.FC<{
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}> = ({ active, disabled, onClick, title, children }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    title={title}
    className={`sails-richtext__btn ${active ? 'sails-richtext__btn--active' : ''}`}
  >
    {children}
  </button>
);

const Divider: React.FC = () => <div className="sails-richtext__divider" />;

export const RichTextControl: FieldControlPlugin = {
  id: 'control:rich_text',
  name: 'Rich Text Editor',
  description: 'WYSIWYG formatted HTML content editor (TipTap)',
  iconName: 'FileText',
  compatibleTypes: ['rich_text'],
  isDefault: true,

  RenderEdit: ({ field, value, onChange, disabled, readOnly, className = '' }: FieldControlProps) => {
    const toolbarPreset: string = (field?.config as any)?.toolbarPreset || 'standard';
    const isEditable = !disabled && !readOnly;

    const isStandardOrFull = toolbarPreset !== 'minimal';
    const isFull = toolbarPreset === 'full';

    const buildExtensions = useCallback(() => {
      const extensions: any[] = [
        StarterKit.configure({
          heading: isFull ? { levels: [1, 2, 3] } : false,
          bulletList: isStandardOrFull ? {} : false,
          orderedList: isStandardOrFull ? {} : false,
          code: isFull ? {} : false,
          codeBlock: isFull ? {} : false,
          strike: isStandardOrFull ? {} : false,
          link: false,
          underline: false,
          blockquote: false,
          horizontalRule: false,
        }),
        TipTapUnderline,
      ];

      if (isStandardOrFull) {
        extensions.push(
          TipTapLink.configure({
            openOnClick: true,
            HTMLAttributes: { class: 'text-cyan-400 underline' },
          })
        );
      }

      if (isFull) {
        extensions.push(TextStyle);
        extensions.push(FontFamily);
        extensions.push(Table.configure({ resizable: true }));
        extensions.push(TableRow);
        extensions.push(TableCell);
        extensions.push(TableHeader);
      }

      return extensions;
    }, [isStandardOrFull, isFull]);

    const editor = useEditor({
      extensions: buildExtensions(),
      content: value ?? '',
      editable: isEditable,
      editorProps: {
        attributes: {
          class: 'sails-richtext__content',
        },
      },
      onUpdate: ({ editor }: { editor: any }) => {
        const html = editor.getHTML();
        if (onChange) onChange(html === '<p></p>' ? '' : html);
      },
    }, [toolbarPreset]);

    useEffect(() => {
      if (editor && value !== undefined) {
        const currentHtml = editor.getHTML();
        const newHtml = value ?? '';
        if (currentHtml !== newHtml && (newHtml !== '<p></p>' || currentHtml !== '<p></p>')) {
          editor.commands.setContent(newHtml);
        }
      }
    }, [editor, value]);

    useEffect(() => {
      if (editor) {
        editor.setEditable(isEditable);
      }
    }, [editor, isEditable]);

    const insertLink = useCallback(() => {
      if (!editor) return;
      const previousUrl = editor.getAttributes('link').href;
      const url = prompt('Enter Link URL:', previousUrl || 'https://');
      if (url === null) return;
      if (url === '') {
        editor.chain().focus().extendMarkRange('link').unsetLink().run();
      } else {
        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
      }
    }, [editor]);

    const insertTable = useCallback(() => {
      editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    }, [editor]);

    if (!editor) return null;

    return (
      <div className={`sails-richtext ${!isEditable ? 'sails-richtext--disabled' : ''} ${className}`}>
        <div className="sails-richtext__toolbar">
          <ToolbarBtn
            active={editor.isActive('bold')}
            disabled={!isEditable}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Bold (Ctrl+B)"
          >
            <Bold size={13} />
          </ToolbarBtn>
          <ToolbarBtn
            active={editor.isActive('italic')}
            disabled={!isEditable}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Italic (Ctrl+I)"
          >
            <Italic size={13} />
          </ToolbarBtn>
          <ToolbarBtn
            active={editor.isActive('underline')}
            disabled={!isEditable}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            title="Underline (Ctrl+U)"
          >
            <Underline size={13} />
          </ToolbarBtn>

          {toolbarPreset !== 'minimal' && (
            <>
              <Divider />
              <ToolbarBtn
                active={editor.isActive('bulletList')}
                disabled={!isEditable}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                title="Bullet List"
              >
                <List size={13} />
              </ToolbarBtn>
              <ToolbarBtn
                active={editor.isActive('orderedList')}
                disabled={!isEditable}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                title="Numbered List"
              >
                <ListOrdered size={13} />
              </ToolbarBtn>
              <Divider />
              <ToolbarBtn
                active={editor.isActive('link')}
                disabled={!isEditable}
                onClick={insertLink}
                title="Insert Link"
              >
                <Link size={13} />
              </ToolbarBtn>
              <ToolbarBtn
                active={editor.isActive('strike')}
                disabled={!isEditable}
                onClick={() => editor.chain().focus().toggleStrike().run()}
                title="Strikethrough"
              >
                <Strikethrough size={13} />
              </ToolbarBtn>
            </>
          )}

          {toolbarPreset === 'full' && (
            <>
              <Divider />
              <select
                disabled={!isEditable}
                onChange={(e) => {
                  if (e.target.value) {
                    editor.chain().focus().setFontFamily(e.target.value).run();
                  } else {
                    editor.chain().focus().unsetFontFamily().run();
                  }
                }}
                className="sails-richtext__select"
                value={editor.getAttributes('textStyle').fontFamily || ''}
              >
                <option value="">Font</option>
                {FONT_OPTIONS.map(f => (
                  <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
                ))}
              </select>
              <ToolbarBtn
                active={editor.isActive('heading', { level: 1 })}
                disabled={!isEditable}
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                title="Heading 1"
              >
                <Heading1 size={13} />
              </ToolbarBtn>
              <ToolbarBtn
                active={editor.isActive('heading', { level: 2 })}
                disabled={!isEditable}
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                title="Heading 2"
              >
                <Heading2 size={13} />
              </ToolbarBtn>
              <ToolbarBtn
                active={editor.isActive('heading', { level: 3 })}
                disabled={!isEditable}
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                title="Heading 3"
              >
                <Heading3 size={13} />
              </ToolbarBtn>
              <Divider />
              <ToolbarBtn
                active={editor.isActive('codeBlock')}
                disabled={!isEditable}
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                title="Code Block"
              >
                <Code size={13} />
              </ToolbarBtn>
              <ToolbarBtn
                disabled={!isEditable}
                onClick={insertTable}
                title="Insert Table"
              >
                <Table2 size={13} />
              </ToolbarBtn>
            </>
          )}

          <ToolbarBtn
            disabled={!isEditable}
            onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
            title="Clear Formatting"
          >
            <RemoveFormatting size={13} />
          </ToolbarBtn>
        </div>

        <EditorContent editor={editor} className="sails-richtext__body" style={{ minHeight: `${((field?.config as any)?.rows || 5) * 24}px` }} />
      </div>
    );
  },

  RenderDisplay: ({ value }: FieldControlProps) => {
    if (!value) return <span className="text-xs text-slate-500">—</span>;
    return (
      <div
        className="sails-richtext__content"
        dangerouslySetInnerHTML={{ __html: String(value) }}
      />
    );
  },
};
