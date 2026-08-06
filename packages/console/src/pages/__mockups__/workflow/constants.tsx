import React from 'react';
import {
  User, Users, Briefcase, Shield, Hash,
  Database, Bell, ClipboardCheck, Code2, Workflow, Braces,
} from 'lucide-react';
import type { Port, Pt, RouterType, WorkflowEventType } from './types';

export const NODE_W = 230;
export const NODE_H = 116;
export const END_H = 56;
export const CHAIN_X = 360;
export const CHAIN_SPACING = 180;
export const CANVAS_W = 1400;

export const PORT_DIR: Record<Port, Pt> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};
export const ALL_PORTS: Port[] = ['top', 'right', 'bottom', 'left'];

export const ROUTER_TYPES: { type: RouterType; label: string; icon: React.ReactNode }[] = [
  { type: 'user', label: 'Specific User', icon: <User size={12} /> },
  { type: 'team', label: 'Team', icon: <Users size={12} /> },
  { type: 'position', label: 'Position', icon: <Briefcase size={12} /> },
  { type: 'role', label: 'Role', icon: <Shield size={12} /> },
  { type: 'field', label: 'Record Field', icon: <Hash size={12} /> },
];

export interface EventDef {
  type: WorkflowEventType;
  label: string;
  desc: string;
  icon: React.ReactNode;
  color: string;
}

export const EVENT_DEFS: EventDef[] = [
  { type: 'record', label: 'Record Event', desc: 'CRUD on a model', icon: <Database size={13} />, color: '#3b82f6' },
  { type: 'notification', label: 'Notification', desc: 'Bell / Email', icon: <Bell size={13} />, color: '#f59e0b' },
  { type: 'approval', label: 'Task Approval', desc: 'Assign approver', icon: <ClipboardCheck size={13} />, color: '#10b981' },
  { type: 'expression', label: 'Expression Event', desc: 'JSONata compute', icon: <Code2 size={13} />, color: '#a855f7' },
  { type: 'transform', label: 'Transform Event', desc: 'JSONata mapping', icon: <Braces size={13} />, color: '#0ea5e5' },
  { type: 'script', label: 'Script Event', desc: 'BYOC script (sandbox)', icon: <Workflow size={13} />, color: '#8b5cf6' },
];

export const FIELD_TYPES: { value: string; label: string }[] = [
  { value: 'short_text', label: 'Short Text' },
  { value: 'long_text', label: 'Long Text' },
  { value: 'rich_text', label: 'Rich Text' },
  { value: 'number', label: 'Number' },
  { value: 'decimal', label: 'Decimal' },
  { value: 'currency', label: 'Currency' },
  { value: 'percentage', label: 'Percentage' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'date', label: 'Date' },
  { value: 'datetime', label: 'Date & Time' },
  { value: 'time', label: 'Time' },
  { value: 'select', label: 'Select' },
  { value: 'lookup', label: 'Lookup' },
  { value: 'user', label: 'User' },
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'lat_lng', label: 'Lat / Lng' },
  { value: 'address', label: 'Address' },
  { value: 'auto_number', label: 'Auto Number' },
  { value: 'attachment', label: 'Attachment' },
];

export const MOCK_MODELS = ['Contracts', 'Leads', 'Companies', 'Users'];
