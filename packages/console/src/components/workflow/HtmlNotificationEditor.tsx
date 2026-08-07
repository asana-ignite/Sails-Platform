/**
 * HtmlNotificationEditor — tiptap-based HTML editor for the notification
 * message body.  Uses @tiptap/react with StarterKit.  A variable chip bar
 * above the editor inserts {{variable}} markers at the cursor.
 */
import React, { useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import FontFamily from '@tiptap/extension-font-family';
import { Hash, Bold, Italic, UnderlineIcon, List, ListOrdered, Quote, Code2 } from 'lucide-react';

interface Props {
  value: string;
  variables: { id: string; name: string; fieldType: string }[];
  onChange: (html: string) => void;
}

export const HtmlNotificationEditor: React.FC<Props> = ({ value, variables, onChange }) => {
  const activeVars = variables.filter((v) => v.name);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
      FontFamily,
    ],
    content: value && /<\/?[a-z][\s\S]*>/i.test(value) ? value : `<p>${value || ''}</p>`,
    onUpdate: ({ editor }: { editor: { getHTML: () => string } }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'wfe-html-editor',
      },
    },
  });

  const insertVariable = useCallback((name: string) => {
    if (!editor) return;
    editor.chain().focus().insertContent(`{{${name}}}`).run();
  }, [editor]);

  const tb = (action: string, attrs: any, icon: React.ReactNode) => (
    <button type="button"
      className={`tiptap-editor__btn${editor?.isActive(action, attrs) ? ' tiptap-editor__btn--active' : ''}`}
      onClick={() => { if (editor) editor.chain().focus()[action as any](attrs).run(); }}
      title={action}>
      {icon}
    </button>
  );

  return (
    <div style={{ border: '1px solid var(--sails-border,#e2e8f0)', borderRadius: 6, overflow: 'hidden' }}>
      {/* Toolbar */}
      <div className="tiptap-editor__toolbar">
        {tb('toggleBold', {}, <Bold size={14} />)}
        {tb('toggleItalic', {}, <Italic size={14} />)}
        {tb('toggleUnderline', {}, <UnderlineIcon size={14} />)}
        <span className="tiptap-editor__divider" />
        {tb('toggleHeading', { level: 2 }, <strong>H2</strong>)}
        {tb('toggleHeading', { level: 3 }, <strong>H3</strong>)}
        <span className="tiptap-editor__divider" />
        {tb('toggleBulletList', {}, <List size={14} />)}
        {tb('toggleOrderedList', {}, <ListOrdered size={14} />)}
        {tb('toggleBlockquote', {}, <Quote size={14} />)}
        {tb('toggleCodeBlock', {}, <Code2 size={14} />)}
      </div>

      {/* Variable chip bar */}
      {activeVars.length > 0 && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 4, padding: '5px 8px',
          background: 'var(--sails-bg-secondary,#f8fafc)',
          borderBottom: '1px solid var(--sails-border,#e2e8f0)',
          fontSize: 11,
        }}>
          <Hash size={12} style={{ color: 'var(--sails-text-muted,#94a3b8)', marginRight: 2 }} />
          {activeVars.map((v) => (
            <button key={v.id} type="button"
              onClick={() => insertVariable(v.name)}
              title={`Insert {{${v.name}}}`}
              style={{
                fontSize: 10, fontWeight: 500, padding: '2px 6px', border: '1px solid var(--sails-border,#e2e8f0)',
                borderRadius: 4, background: 'var(--sails-bg-card,#fff)', color: 'var(--sails-text-primary,#1e293b)',
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}>
              {v.name}
            </button>
          ))}
        </div>
      )}

      {/* Editor */}
      <div style={{ padding: 0, minHeight: 100 }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

export default HtmlNotificationEditor;
