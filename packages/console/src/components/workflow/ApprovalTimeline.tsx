import React from 'react';
import { CheckCircle2, XCircle, Clock, ArrowRight, User, AlertTriangle, FileText } from 'lucide-react';
import './ApprovalTimeline.css';

export interface TimelineEntry {
  id: string;
  stepId?: string | null;
  action: string;
  actorId?: string | null;
  actorName?: string | null;
  detail?: any;
  createdAt: string;
}

interface ApprovalTimelineProps {
  timeline: TimelineEntry[];
  users?: Record<string, { id: string; name: string | null; email: string | null }>;
}

export const ApprovalTimeline: React.FC<ApprovalTimelineProps> = ({ timeline }) => {
  if (!timeline || timeline.length === 0) {
    return (
      <div className="sails-timeline-empty">
        <Clock size={16} />
        <span>No audit history recorded yet.</span>
      </div>
    );
  }

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'task:decided':
      case 'stage:approved':
        return { icon: <CheckCircle2 size={16} style={{ color: '#10b981' }} />, label: 'Approved', color: 'emerald' };
      case 'stage:rejected':
        return { icon: <XCircle size={16} style={{ color: '#f43f5e' }} />, label: 'Rejected', color: 'rose' };
      case 'task:assigned':
        return { icon: <User size={16} style={{ color: '#0284c7' }} />, label: 'Task Assigned', color: 'sky' };
      case 'workflow:started':
        return { icon: <ArrowRight size={16} style={{ color: '#6366f1' }} />, label: 'Workflow Initiated', color: 'indigo' };
      case 'task:no_assignee':
        return { icon: <AlertTriangle size={16} style={{ color: '#f59e0b' }} />, label: 'No Assignee Matched', color: 'amber' };
      default:
        return { icon: <FileText size={16} style={{ color: '#94a3b8' }} />, label: action.replace(':', ' '), color: 'slate' };
    }
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="sails-timeline-container">
      <div className="sails-timeline-track">
        {timeline.map((item, idx) => {
          const badge = getActionBadge(item.action);
          const comment = item.detail?.comment || item.detail?.reason || null;
          const decision = item.detail?.action || item.detail?.decision || null;

          return (
            <div key={item.id || idx} className="sails-timeline-item">
              <div className="sails-timeline-bullet">
                <div className={`sails-timeline-icon sails-timeline-icon--${badge.color}`}>
                  {badge.icon}
                </div>
                {idx < timeline.length - 1 && <div className="sails-timeline-line" />}
              </div>
              <div className="sails-timeline-content">
                <div className="sails-timeline-header">
                  <span className="sails-timeline-actor">
                    {item.actorName || (item.actorId ? `User (${item.actorId.slice(0, 6)})` : 'System Engine')}
                  </span>
                  <span className="sails-timeline-date">{formatDate(item.createdAt)}</span>
                </div>
                <div className="sails-timeline-title">
                  <span className={`sails-timeline-badge sails-timeline-badge--${badge.color}`}>
                    {decision ? `${decision.toUpperCase()}` : badge.label}
                  </span>
                  {item.detail?.stepLabel && (
                    <span className="sails-timeline-step-name">{item.detail.stepLabel}</span>
                  )}
                </div>
                {comment && (
                  <div className="sails-timeline-comment">
                    <p>"{comment}"</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
