/**
 * MOCKUP — workflow event palette (prototype).
 */
import React from 'react';
import { GitBranch, Settings, Split, Target, Zap } from 'lucide-react';
import { EVENT_DEFS } from '../constants';

/**
 * LEFT panel — draggable palette: a Stage element + the six Workflow Event
 * types. Drag payloads are JSON { type: 'stage' } / { type: 'event', eventType }.
 */
export const EventPalette: React.FC = () => {
  return (
    <div className="rb2-palette">
      <h3 className="rb2-panel-title"><Settings size={12} /> Elements</h3>

      <div
        className="rb2-palette-item rb2-palette-item--stage"
        draggable
        onDragStart={(e) => e.dataTransfer.setData('application/json', JSON.stringify({ type: 'stage' }))}
      >
        <span className="rb2-palette-icon rb2-palette-icon--stage"><GitBranch size={14} /></span>
        <span className="rb2-palette-info">
          <span className="rb2-palette-name">Stage</span>
          <span className="rb2-palette-desc">Drag onto canvas</span>
        </span>
      </div>

      <h3 className="rb2-panel-title" style={{ marginTop: 12 }}><Zap size={12} /> Workflow Events</h3>
      <span className="rb2-palette-drop-hint">Drag an event into a stage card</span>
      {EVENT_DEFS.map((d) => (
        <div
          key={d.type}
          className="rb2-palette-item"
          draggable
          onDragStart={(e) => e.dataTransfer.setData('application/json', JSON.stringify({ type: 'event', eventType: d.type }))}
        >
          <span className="rb2-palette-icon" style={{ background: `${d.color}22`, color: d.color }}>{d.icon}</span>
          <span className="rb2-palette-info">
            <span className="rb2-palette-name">{d.label}</span>
            <span className="rb2-palette-desc">{d.desc}</span>
          </span>
        </div>
      ))}

      <div className="rb2-palette-help">
        <p><Target size={12} /> Chain: auto-layout. Canvas: drag stages freely.</p>
        <p><Split size={12} /> Add branches from a stage's <strong>+ Branch</strong> bar.</p>
      </div>
    </div>
  );
};

export default EventPalette;
