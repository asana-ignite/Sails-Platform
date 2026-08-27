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
  ChevronDown,
  Info
} from 'lucide-react';
import type { WorkflowTaskItem } from '@sails/shared';
import './NotificationDropdown.css';

interface BellNotificationItem {
  id: string;
  instance_id: string;
  source: string;
  subject: string;
  body: string;
  status: string;
  created_at: string;
  read_at: string | null;
}

type UnifiedNotifItem = 
  | { type: 'task'; data: WorkflowTaskItem; timestamp: string }
  | { type: 'bell'; data: BellNotificationItem; timestamp: string };

interface NotificationDropdownProps {
  onClose?: () => void;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ onClose }) => {
  const navigate = useNavigate();
  const [items, setItems] = useState<UnifiedNotifItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const [tasksRes, notifsRes] = await Promise.all([
        fetch('/api/workflow/tasks?status=pending&limit=10').then((r) => r.json()).catch(() => null),
        fetch('/api/notifications?limit=20').then((r) => r.json()).catch(() => null)
      ]);

      const unified: UnifiedNotifItem[] = [];
      let pendingTasks = 0;
      let unreadNotifs = 0;

      if (tasksRes?.success) {
        const rows = tasksRes.data.rows || [];
        pendingTasks = tasksRes.data.total || rows.length;
        rows.forEach((row: WorkflowTaskItem) => {
          unified.push({ type: 'task', data: row, timestamp: row.created_at });
        });
      }

      if (notifsRes?.success) {
        const rows = notifsRes.data.rows || [];
        rows.forEach((row: BellNotificationItem) => {
          if (row.status !== 'read') unreadNotifs++;
          unified.push({ type: 'bell', data: row, timestamp: row.created_at });
        });
      }

      // Sort unified items by created_at descending
      unified.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setItems(unified.slice(0, 15));
      const newTotal = pendingTasks + unreadNotifs;
      setTotalCount(newTotal);

      // Broadcast to Topbar instantly
      window.dispatchEvent(new CustomEvent('sails:notif-count-updated', { detail: { count: newTotal } }));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
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

  const handleBellClick = async (item: BellNotificationItem) => {
    // Toggle expanded state
    setExpandedIds((prev) => ({
      ...prev,
      [item.id]: !prev[item.id]
    }));

    // If not read, mark as read in database
    if (item.status !== 'read') {
      try {
        const res = await fetch(`/api/notifications?id=${item.id}&mark=read`, { method: 'PATCH' });
        const json = await res.json();
        if (json.success) {
          // Update status locally
          const updatedItems = items.map((it) =>
            it.type === 'bell' && it.data.id === item.id
              ? { ...it, data: { ...it.data, status: 'read' as const } }
              : it
          );
          setItems(updatedItems);

          // Calculate new total
          const remainingTasks = updatedItems.filter((it) => it.type === 'task').length;
          const remainingNotifs = updatedItems.filter((it) => it.type === 'bell' && it.data.status !== 'read').length;
          const newCount = remainingTasks + remainingNotifs;
          setTotalCount(newCount);

          // Broadcast to Topbar instantly
          window.dispatchEvent(new CustomEvent('sails:notif-count-updated', { detail: { count: newCount } }));
        }
      } catch {
        // ignore
      }
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch('/api/notifications?mark_all_read=true', { method: 'PATCH' });
      const json = await res.json();
      if (json.success) {
        const updatedItems = items.map((it) =>
          it.type === 'bell' ? { ...it, data: { ...it.data, status: 'read' as const } } : it
        );
        setItems(updatedItems);

        const remainingTasks = updatedItems.filter((it) => it.type === 'task').length;
        setTotalCount(remainingTasks);

        // Broadcast to Topbar instantly
        window.dispatchEvent(new CustomEvent('sails:notif-count-updated', { detail: { count: remainingTasks } }));
      }
    } catch {
      // ignore
    }
  };

  const handleViewAll = () => {
    if (onClose) onClose();
    navigate('/notifications');
  };

  // Safe simple helper to detect and render HTML links inside plain text
  const renderMessageBody = (text: string) => {
    if (!text) return '';
    const urlPattern = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
    const parts = text.split(urlPattern);
    
    return parts.map((part, index) => {
      if (part.match(urlPattern)) {
        return (
          <a 
            key={index} 
            href={part} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="sails-notif-item__body-link"
            onClick={(e) => e.stopPropagation()} // Prevent collapse on link click
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  const unreadBellCount = items.filter((it) => it.type === 'bell' && it.data.status !== 'read').length;
  const filteredItems = items.filter((it) => {
    if (activeTab === 'unread') {
      return it.type === 'task' || (it.type === 'bell' && it.data.status !== 'read');
    }
    return true;
  });

  return (
    <div className="sails-notif-dropdown" ref={dropdownRef}>
      {/* Header */}
      <div className="sails-notif-dropdown__header">
        <div className="sails-notif-dropdown__title">
          <Bell size={16} />
          <span>Notifications</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {unreadBellCount > 0 && (
            <button
              type="button"
              className="sails-notif-mark-all-btn"
              onClick={handleMarkAllRead}
              title="Mark all notifications as read"
            >
              <CheckCircle2 size={12} />
              <span>Mark all read</span>
            </button>
          )}
          {totalCount > 0 && (
            <span className="sails-notif-badge">{totalCount}</span>
          )}
        </div>
      </div>

      {/* Filter Tabs: All vs Unread */}
      <div className="sails-notif-tabs">
        <button
          type="button"
          className={`sails-notif-tab ${activeTab === 'all' ? 'sails-notif-tab--active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          <span>All</span>
          <span className="sails-notif-tab-count">{items.length}</span>
        </button>
        <button
          type="button"
          className={`sails-notif-tab ${activeTab === 'unread' ? 'sails-notif-tab--active' : ''}`}
          onClick={() => setActiveTab('unread')}
        >
          <span>Unread</span>
          {totalCount > 0 && (
            <span className="sails-notif-tab-badge">{totalCount}</span>
          )}
        </button>
      </div>

      {/* List content */}
      <div className="sails-notif-dropdown__list">
        {loading ? (
          <div className="sails-notif-empty">
            <div className="sails-notif-skeleton" />
            <div className="sails-notif-skeleton" />
            <div className="sails-notif-skeleton" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="sails-notif-empty">
            <Inbox size={28} className="sails-notif-empty-icon" />
            <p className="sails-notif-empty-title">
              {activeTab === 'unread' ? 'No unread notifications' : 'All caught up!'}
            </p>
            <p className="sails-notif-empty-subtitle">
              {activeTab === 'unread'
                ? 'You have reviewed all current notifications.'
                : 'No pending tasks or notifications.'}
            </p>
          </div>
        ) : (
          filteredItems.map((item, index) => {
            if (item.type === 'task') {
              const task = item.data;
              return (
                <div
                  key={`task-${task.id}-${index}`}
                  className="sails-notif-item sails-notif-item--task"
                  onClick={() => handleTaskClick(task.id)}
                >
                  <div className="sails-notif-item__icon sails-notif-item__icon--task">
                    <FileText size={16} />
                  </div>
                  <div className="sails-notif-item__content">
                    <div className="sails-notif-item__head">
                      <span className="sails-notif-item__name">
                        {task.def_name || 'Workflow Task'}
                      </span>
                      <span className="sails-notif-item__time">
                        {formatTimeAgo(item.timestamp)}
                      </span>
                    </div>
                    <p className="sails-notif-item__desc">
                      Approval Stage: <strong>{(task as any).stage_name || task.step_id}</strong>
                    </p>
                    {task.due_at && (
                      <span className="sails-notif-item__due">
                        <Clock size={11} /> Due soon
                      </span>
                    )}
                  </div>
                  <ChevronRight size={14} className="sails-notif-item__arrow" />
                </div>
              );
            } else {
              const bell = item.data;
              const isExpanded = !!expandedIds[bell.id];
              const isUnread = bell.status !== 'read';
              return (
                <div
                  key={`bell-${bell.id}-${index}`}
                  className={`sails-notif-item sails-notif-item--bell ${isExpanded ? 'sails-notif-item--expanded' : ''} ${isUnread ? 'sails-notif-item--unread' : 'sails-notif-item--read'}`}
                  onClick={() => handleBellClick(bell)}
                >
                  <div className={`sails-notif-item__icon sails-notif-item__icon--bell ${!isUnread ? 'sails-notif-item__icon--read' : ''}`}>
                    <Info size={16} />
                  </div>
                  <div className="sails-notif-item__content">
                    <div className="sails-notif-item__head">
                      <span className={`sails-notif-item__name ${!isUnread ? 'sails-notif-item__name--read' : ''}`}>
                        {bell.subject || 'System Notification'}
                      </span>
                      <span className="sails-notif-item__time">
                        {formatTimeAgo(item.timestamp)}
                      </span>
                    </div>
                    <p className="sails-notif-item__desc">
                      {bell.source || 'Workflow Engine'}
                    </p>
                    {isExpanded && (
                      <div className="sails-notif-item__body">
                        {renderMessageBody(bell.body)}
                      </div>
                    )}
                  </div>
                  {isExpanded ? (
                    <ChevronDown size={14} className="sails-notif-item__arrow" />
                  ) : (
                    <ChevronRight size={14} className="sails-notif-item__arrow" />
                  )}
                </div>
              );
            }
          })
        )}
      </div>

      {/* Footer */}
      <div className="sails-notif-dropdown__footer">
        <button
          type="button"
          className="sails-notif-footer-btn"
          onClick={handleViewAll}
        >
          <span>View All Notifications</span>
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
};
