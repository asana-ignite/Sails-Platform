/**
 * Ambient types for the jsonata package (declared in package.json).
 * The runtime resolves the real module; this shim keeps the editor/studio
 * mockups type-safe when the package's own types are not installed yet.
 * Loose on purpose — the sandbox/expression API surface is narrow.
 */
declare module 'jsonata' {
  export interface JsonataExpression {
    evaluate(input: any, bindings?: Record<string, any>): Promise<any>;
    assign(name: string, value: any): void;
    toString(): string;
    errors(): any[];
  }

  export default function jsonata(expression: string): JsonataExpression;
  export function jsonata(expression: string): JsonataExpression;
}
