import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, AlertCircle, Loader2 } from 'lucide-react';
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
      {/* Floating Ghost-Glass Approval Banner with Integrated Switcher Tabs */}
      <ApprovalTaskBanner
        detail={detail}
        onDecided={handleDecisionComplete}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        timelineCount={(timeline || []).length}
      />

      <div className="sails-approval-page-content">
        {activeTab === 'record' ? (
          (instance.tableName || instance.table_name) && (instance.recordId || instance.record_id) ? (
            <div className="sails-approval-dynamic-wrapper">
              <DynamicDetailPage
                tableName={(instance.tableName || instance.table_name)!}
                recordId={(instance.recordId || instance.record_id)!}
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
            <ApprovalTimeline timeline={timeline || []} users={users || {}} />
          </div>
        )}
      </div>
    </div>
  );
};

export default ApprovalDetailPage;
