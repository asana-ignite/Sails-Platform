import { useEffect, useRef, useState } from 'react';
import suneditor from 'suneditor';

export type SunEditorCore = any;

export interface UseSunEditorResult {
  /** Attach to the container element SunEditor creates inside. */
  containerRef: React.RefObject<HTMLDivElement>;
  /** Live SunEditor instance (null until created / after destroy). */
  editorRef: React.MutableRefObject<SunEditorCore | null>;
  /** True once the instance has been created for the current options set. */
  ready: boolean;
}

/**
 * Creates a SunEditor instance on mount (and re-creates it whenever any of
 * `restartDeps` change) and destroys it on unmount.
 *
 * The `options` object is captured once per creation — mutate it only through
 * `restartDeps` (e.g. `mode`, `toolbarPreset`, `buttonList`). High-frequency
 * props (value, focus state, callbacks) must be handled by the caller via the
 * returned editor instance / refs, never by recreating the editor.
 */
export function useSunEditor(
  options: Record<string, any>,
  restartDeps: React.DependencyList,
): UseSunEditorResult {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<SunEditorCore | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let editor: SunEditorCore | null = null;
    try {
      editor = suneditor.create(el, options);
    } catch (e) {
      console.error('[SailsHtmlEditor] suneditor.create failed', e);
    }
    editorRef.current = editor;
    setReady(true);
    return () => {
      try {
        editor?.destroy();
      } catch {
        /* already destroyed */
      }
      editorRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, restartDeps);

  return { containerRef, editorRef, ready };
}
