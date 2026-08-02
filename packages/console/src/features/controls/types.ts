import React from 'react';
import type { SailsFieldDefinition } from '@sails/shared';

// ── Layout block-level validation rules ────────────────────────
// Shared by Layout Studio (editor), Layout Studio preview, and the
// real DynamicDetailPage form via DetailFieldInput.

export type ConditionOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'empty' | 'not_empty';
export type ValidationType = 'required' | 'cross_field' | 'regex' | 'range';

export interface FieldValidation {
  id: string;
  type: ValidationType;
  message: string;
  pattern?: string;
  min?: number;
  max?: number;
  dependentFieldId?: string;
  dependentOperator?: ConditionOp;
  dependentValue?: string;
}

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
