/**
 * Ambient declarations for SunEditor v3.
 * The package ships its own types for the main entry; these shims cover the
 * per-plugin subpath imports (which have no individual .d.ts files) and keep
 * the integration loosely typed like the rest of the editor glue.
 */
declare module 'suneditor/src/plugins/command/*' {
  const plugin: any;
  export default plugin;
}

declare module 'suneditor/src/plugins/dropdown/*' {
  const plugin: any;
  export default plugin;
}

declare module 'suneditor/src/plugins/modal/*' {
  const plugin: any;
  export default plugin;
}

declare module 'suneditor/src/plugins/input/*' {
  const plugin: any;
  export default plugin;
}

declare module 'suneditor/src/interfaces' {
  /** Loose shape of the command-plugin base class (used for custom toolbar buttons). */
  export class PluginCommand {
    static key: string;
    static type: string;
    title: string;
    icon: string;
    inner: string | HTMLElement | boolean | null;
    constructor(kernel: any);
    action(target: HTMLElement | null): void | Promise<void>;
    [key: string]: any;
  }
}

declare module 'suneditor/src/interfaces/index.js' {
  export { PluginCommand } from 'suneditor/src/interfaces';
}
