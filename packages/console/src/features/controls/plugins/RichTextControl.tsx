/**
 * RichTextControl — rich text editing wrapper.
 */
import React from 'react';
import type { FieldControlPlugin, FieldControlProps } from '../types';
import '../controls.css';

const sanitizeHtml = (html: string): string => {
  if (typeof window === 'undefined') return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const removeNodes = doc.querySelectorAll('script, iframe, object, embed, applet');
  removeNodes.forEach(n => n.remove());
  const allElements = doc.querySelectorAll('*');
  allElements.forEach(el => {
    const attrs = el.getAttributeNames();
    for (const attr of attrs) {
      if (attr.startsWith('on') && attr !== 'on') {
        el.removeAttribute(attr);
      }
      if (attr === 'href' || attr === 'src' || attr === 'action' || attr === 'formaction') {
        const val = (el.getAttribute(attr) || '').toLowerCase().trim();
        if (val.startsWith('javascript:')) {
          el.removeAttribute(attr);
        }
      }
    }
  });
  return doc.body.innerHTML;
};

// TipTap editor is heavy (~100KB gzipped) — load it ONLY when a rich_text
// field is actually rendered in edit mode. Metadata (id/name/icon/types)
// stays synchronous for the registry; RenderDisplay needs no TipTap.
const RenderEdit = React.lazy(async () => {
  const mod = await import('./RichTextEditor');
  return { default: mod.RichTextEdit };
}) as unknown as React.FC<FieldControlProps>;

const RenderDisplay: React.FC<FieldControlProps> = ({ value }) => {
  if (!value) return <span>—</span>;
  return (
    <div
      className="sails-richtext__content"
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(String(value)) }}
    />
  );
};

export const RichTextControl: FieldControlPlugin = {
  id: 'control:rich_text',
  name: 'Rich Text Editor',
  description: 'WYSIWYG formatted HTML content editor (TipTap)',
  iconName: 'FileText',
  compatibleTypes: ['rich_text'],
  isDefault: true,

  mockValue: () => '<p>Lorem ipsum <strong>dolor</strong> sit amet, consectetur adipiscing elit.</p>',

  RenderEdit,
  RenderDisplay,
};
