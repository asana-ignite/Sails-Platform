import React, { useState } from 'react';
import {
  CheckCircle,
  XCircle,
  Clock,
  User,
  AlertCircle,
  FileText,
  History,
  ChevronDown,
  ChevronUp,
  Loader2,
  ShieldCheck,
  Calendar
} from 'lucide-react';
import type { WorkflowTaskDetail, WorkflowTaskAction } from '@sails/shared';
import { UiActionGroup, UiActionItem, UiActionDivider } from '../ui';
import { useToast } from '../../contexts/ToastContext';
import './ApprovalTaskBanner.css';

export interface ApprovalTaskBannerProps {
  detail: WorkflowTaskDetail;
  onDecided?: (action: string) => void;
  activeTab?: 'record' | 'timeline';
  onTabChange?: (tab: 'record' | 'timeline') => void;
  timelineCount?: number;
}

export const ApprovalTaskBanner: React.FC<ApprovalTaskBannerProps> = ({
  detail,
  onDecided,
  activeTab,
  onTabChange,
  timelineCount,
}) => {
  const { task, instance, stage, approvalEvent } = detail;
  const { toast } = useToast();
  const [comment, setComment] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPending = task.status === 'pending';

  // Compute SLA status
  const dueInfo = React.useMemo(() => {
    if (!task.due_at) return null;
    const dueTime = new Date(task.due_at).getTime();
    const now = Date.now();
    const diffMs = dueTime - now;
    const isOverdue = diffMs < 0;
    const diffHours = Math.abs(Math.round(diffMs / (3600 * 1000)));

    return {
      isOverdue,
      text: isOverdue ? `Overdue by ${diffHours}h` : `Due in ${diffHours}h`,
      dateStr: new Date(task.due_at).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    };
  }, [task.due_at]);

  const handleDecision = async (actionVal: string) => {
    if (actionVal.toLowerCase().includes('reject') && !comment.trim()) {
      setError('Please provide a reason/comment when rejecting this request.');
      return;
    }

    setIsBusy(true);
    setError(null);

    try {
      const res = await fetch(`/api/workflow/tasks/${task.id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionVal,
          comment: comment.trim() || undefined
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to submit decision');
      }

      toast.success(`Request ${actionVal.toLowerCase().includes('reject') ? 'rejected' : 'approved'} successfully.`);

      if (onDecided) {
        onDecided(actionVal);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while submitting decision.');
      toast.error(err.message || 'An error occurred while submitting decision.');
    } finally {
      setIsBusy(false);
    }
  };

  const actions: WorkflowTaskAction[] = Array.isArray(task.actions) && task.actions.length > 0
    ? task.actions
    : [
        { label: 'Approve', value: 'approve', variant: 'success' },
        { label: 'Reject', value: 'reject', variant: 'danger' }
      ];

  return (
    <div className="sails-approval-banner">
      <div className="sails-approval-banner__main">
        {/* Top Header: Badge, Def Name, SLA, and Integrated Switcher Tabs */}
        <div className="sails-approval-banner__header">
          <div className="sails-approval-banner__badge-group">
            <span className={`sails-approval-status-chip sails-approval-status-chip--${task.status}`}>
              {task.status === 'pending' ? <Clock size={13} /> : <CheckCircle size={13} />}
              {task.status.toUpperCase()}
            </span>
            <span className="sails-approval-workflow-name">
              {instance.defName || 'Workflow Approval'}
            </span>
            {stage?.label && (
              <span className="sails-approval-stage-tag">
                {stage.label}
              </span>
            )}
            {dueInfo && isPending && (
              <div className={`sails-approval-sla ${dueInfo.isOverdue ? 'sails-approval-sla--overdue' : ''}`}>
                <Calendar size={13} />
                <span>{dueInfo.text}</span>
              </div>
            )}
          </div>

          {onTabChange && (
            <div className="sails-approval-header-tabs">
              <button
                type="button"
                className={`sails-approval-tab-btn ${activeTab === 'record' ? 'sails-approval-tab-btn--active' : ''}`}
                onClick={() => onTabChange('record')}
              >
                <FileText size={13} />
                <span>Record Details</span>
              </button>
              <button
                type="button"
                className={`sails-approval-tab-btn ${activeTab === 'timeline' ? 'sails-approval-tab-btn--active' : ''}`}
                onClick={() => onTabChange('timeline')}
              >
                <History size={13} />
                <span>Audit History {typeof timelineCount === 'number' && `(${timelineCount})`}</span>
              </button>
            </div>
          )}
        </div>

        {approvalEvent?.message && (
          <div className="sails-approval-instructions">
            <FileText size={14} />
            <p>{approvalEvent.message}</p>
          </div>
        )}

        {isPending ? (
          <div className="sails-approval-action-area">
            {error && (
              <div className="sails-approval-error">
                <AlertCircle size={13} />
                <span>{error}</span>
              </div>
            )}

            <div className="sails-approval-action-row">
              <div className="sails-approval-comment-box">
                <input
                  type="text"
                  className="sails-approval-comment-input"
                  placeholder="Decision comment or reason (required for rejection)..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  disabled={isBusy}
                />
              </div>

              <div className="sails-approval-buttons">
                <UiActionGroup size="md">
                  {actions.map((act, index) => {
                    const isReject = act.value.toLowerCase().includes('reject');
                    const isApprove = act.value.toLowerCase().includes('approve');
                    const tone = isReject ? 'danger-fill' : isApprove ? 'success-fill' : 'neutral';
                    return (
                      <React.Fragment key={act.value}>
                        {index > 0 && <UiActionDivider />}
                        <UiActionItem
                          icon={
                            isBusy ? (
                              <Loader2 size={13} className="sails-spin" />
                            ) : isReject ? (
                              <XCircle size={13} />
                            ) : (
                              <CheckCircle size={13} />
                            )
                          }
                          label={act.label}
                          tone={tone}
                          disabled={isBusy}
                          onClick={() => handleDecision(act.value)}
                        />
                      </React.Fragment>
                    );
                  })}
                </UiActionGroup>
              </div>
            </div>
          </div>
        ) : (
          <div className="sails-approval-decided-banner">
            <ShieldCheck size={16} />
            <span>
              This task was decided as <strong>{task.decision || task.status}</strong>
              {task.decided_at && ` on ${new Date(task.decided_at).toLocaleString()}`}.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
