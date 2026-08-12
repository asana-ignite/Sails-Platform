/**
 * LazyRenderErrorBoundary — catches render errors from field controls so
 * one broken control never crashes the whole form.
 */
import React, { Component, Suspense } from 'react';

const fallbackStyle: React.CSSProperties = {
  border: '1px solid var(--sails-border-color, #cbd5e1)',
  borderRadius: 6,
  minHeight: 80,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 12,
  color: 'var(--sails-text-muted, #94a3b8)',
  background: 'var(--sails-bg-card, #ffffff)',
  boxSizing: 'border-box',
};

export const ControlLazyFallback: React.FC = () => (
  <div style={fallbackStyle}>Loading editor…</div>
);

interface BoundaryProps {
  children: React.ReactNode;
}

interface BoundaryState {
  hasError: boolean;
}

export class LazyRenderErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { hasError: false };

  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <div style={fallbackStyle}>Failed to load editor.</div>;
    }
    return this.props.children;
  }
}

// Wraps lazy-loaded control renders (currently the TipTap editor).
// Error boundary keeps a chunk-load failure from unmounting the page.
export const ControlLazyBoundary: React.FC<BoundaryProps> = ({ children }) => (
  <LazyRenderErrorBoundary>
    <Suspense fallback={<ControlLazyFallback />}>{children}</Suspense>
  </LazyRenderErrorBoundary>
);
