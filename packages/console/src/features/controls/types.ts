import React from 'react';
import type { SailsFieldDefinition } from '@sails/shared';

export interface FieldControlProps {
  field: SailsFieldDefinition;
  value: any;
  onChange?: (val: any) => void;
  readOnly?: boolean;
  disabled?: boolean;
  error?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'ghost' | 'glass';
  className?: string;
  config?: Record<string, any>;
  mode?: 'edit' | 'display';
}

export interface FieldControlPlugin {
  id: string;               // e.g. 'control:lookup_combobox', 'control:short_text'
  name: string;             // Human-readable control name
  description?: string;
  iconName?: string;        // Lucide icon name for picker UI
  compatibleTypes: string[];// e.g. ['short_text', 'text'] or ['lookup', 'relation']
  isDefault?: boolean;      // Default control for its compatible types

  // ── Dual-Mode Rendering Components ──
  RenderEdit: React.FC<FieldControlProps>;    // On-Edit mode component
  RenderDisplay: React.FC<FieldControlProps>; // On-Display mode component

  // Realistic sample value used by designer previews (Layout Studio canvas).
  // Falls back to a generic `Sample <name>` string when not provided.
  mockValue?: (field: SailsFieldDefinition) => any;
}
