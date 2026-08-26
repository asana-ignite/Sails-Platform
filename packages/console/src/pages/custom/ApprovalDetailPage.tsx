import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, History, FileText, AlertCircle, Loader2 } from 'lucide-react';
import type { WorkflowTaskDetail } from '@sails/shared';
import DynamicDetailPage from '../DynamicDetailPage';
import { ApprovalTaskBanner } from '../../components/workflow/ApprovalTaskBanner';
import { ApprovalTimeline } from '../../components/workflow/ApprovalTimeline';
import './ApprovalDetailPage.css';

const ApprovalDetailPage: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<WorkflowTaskDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'record' | 'timeline'>('record');

  const fetchTaskDetail = async () => {
    if (!taskId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/workflow/tasks/${taskId}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to load task details');
      }
      setDetail(json.data);
    } catch (err: any) {
      setError(err.message || 'Error loading approval task');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTaskDetail();
  }, [taskId]);

  const handleDecisionComplete = () => {
    fetchTaskDetail();
  };

  if (loading) {
    return (
      <div className="sails-approval-page-loading">
        <Loader2 size={32} className="sails-spin" />
        <p>Loading approval details...</p>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="sails-approval-page-error">
        <AlertCircle size={32} />
        <h2>Unable to load approval task</h2>
        <p>{error || 'Task not found or access denied.'}</p>
        <button
          type="button"
          className="sails-btn sails-btn--secondary"
          onClick={() => navigate(-1)}
        >
          <ChevronLeft size={16} /> Go Back
        </button>
      </div>
    );
  }

  const { task, instance, timeline, users } = detail;

  return (
    <div className="sails-approval-detail-page">
      <div className="sails-approval-page-header">
        <button
          type="button"
          className="sails-btn-back"
          onClick={() => navigate(-1)}
        >
          <ChevronLeft size={18} />
          <span>Back to Inbox</span>
        </button>
        <div className="sails-approval-nav-tabs">
          <button
            type="button"
            className={`sails-approval-nav-tab ${activeTab === 'record' ? 'active' : ''}`}
            onClick={() => setActiveTab('record')}
          >
            <FileText size={16} />
            <span>Record Details</span>
          </button>
          <button
            type="button"
            className={`sails-approval-nav-tab ${activeTab === 'timeline' ? 'active' : ''}`}
            onClick={() => setActiveTab('timeline')}
          >
            <History size={16} />
            <span>Audit History ({timeline.length})</span>
          </button>
        </div>
      </div>

      <div className="sails-approval-page-content">
        <ApprovalTaskBanner detail={detail} onDecided={handleDecisionComplete} />

        {activeTab === 'record' ? (
          instance.tableName && instance.recordId ? (
            <div className="sails-approval-dynamic-wrapper">
              <DynamicDetailPage
                tableName={instance.tableName}
                recordId={instance.recordId}
                inStack={false}
              />
            </div>
          ) : (
            <div className="sails-approval-no-record">
              <p>This workflow task is not linked to a dynamic table record.</p>
            </div>
          )
        ) : (
          <div className="sails-approval-timeline-wrapper">
            <ApprovalTimeline timeline={timeline} users={users} />
          </div>
        )}
      </div>
    </div>
  );
};

export default ApprovalDetailPage;
