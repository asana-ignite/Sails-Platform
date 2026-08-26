import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Clock,
  CheckCircle2,
  FileText,
  ChevronRight,
  ArrowRight,
  Inbox,
  User,
  ExternalLink
} from 'lucide-react';
import type { WorkflowTaskItem } from '@sails/shared';
import './NotificationDropdown.css';

interface NotificationDropdownProps {
  onClose?: () => void;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ onClose }) => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<WorkflowTaskItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchRecentTasks = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/workflow/tasks?status=pending&limit=5');
      const json = await res.json();
      if (json.success) {
        setTasks(json.data.rows || []);
        setTotalCount(json.data.total || (json.data.rows || []).length);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecentTasks();
  }, []);

  const formatTimeAgo = (isoStr: string) => {
    try {
      const ms = Date.now() - new Date(isoStr).getTime();
      const mins = Math.floor(ms / (1000 * 60));
      if (mins < 1) return 'Just now';
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs}h ago`;
      const days = Math.floor(hrs / 24);
      return `${days}d ago`;
    } catch {
      return '';
    }
  };

  const handleTaskClick = (taskId: string) => {
    if (onClose) onClose();
    navigate(`/tasks/${taskId}`);
  };

  const handleViewAll = () => {
    if (onClose) onClose();
    navigate('/tasks');
  };

  return (
    <div className="sails-notif-dropdown" ref={dropdownRef}>
      {/* Header */}
      <div className="sails-notif-dropdown__header">
        <div className="sails-notif-dropdown__title">
          <Bell size={16} />
          <span>Notifications & Approvals</span>
        </div>
        {totalCount > 0 && (
          <span className="sails-notif-badge">{totalCount} pending</span>
        )}
      </div>

      {/* List content */}
      <div className="sails-notif-dropdown__list">
        {loading ? (
          <div className="sails-notif-empty">
            <div className="sails-notif-skeleton" />
            <div className="sails-notif-skeleton" />
            <div className="sails-notif-skeleton" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="sails-notif-empty">
            <Inbox size={28} className="sails-notif-empty-icon" />
            <p className="sails-notif-empty-title">All caught up!</p>
            <p className="sails-notif-empty-subtitle">No pending tasks waiting for your review.</p>
          </div>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className="sails-notif-item"
              onClick={() => handleTaskClick(task.id)}
            >
              <div className="sails-notif-item__icon">
                <FileText size={16} />
              </div>
              <div className="sails-notif-item__content">
                <div className="sails-notif-item__head">
                  <span className="sails-notif-item__name">
                    {task.def_name || 'Workflow Task'}
                  </span>
                  <span className="sails-notif-item__time">
                    {formatTimeAgo(task.created_at)}
                  </span>
                </div>
                <p className="sails-notif-item__desc">
                  Stage: <strong>{(task as any).stage_name || task.step_id}</strong>
                </p>
                {task.due_at && (
                  <span className="sails-notif-item__due">
                    <Clock size={11} /> Due soon
                  </span>
                )}
              </div>
              <ChevronRight size={14} className="sails-notif-item__arrow" />
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="sails-notif-dropdown__footer">
        <button
          type="button"
          className="sails-notif-footer-btn"
          onClick={handleViewAll}
        >
          <span>View All Tasks & Approvals</span>
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
};
