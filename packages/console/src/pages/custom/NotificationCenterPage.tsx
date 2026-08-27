import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCircle2,
  Clock,
  Search,
  RefreshCw,
  Inbox,
  ChevronDown,
  ChevronUp,
  Info,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  FileText,
  Check,
  X,
  Layers,
  CheckSquare,
  Square,
  MinusSquare,
  AlertCircle
} from 'lucide-react';
import type { WorkflowTaskItem } from '@sails/shared';
import { UiActionGroup, UiActionItem, UiActionDivider } from '../../components/ui';
import { useToast } from '../../contexts/ToastContext';
import './NotificationCenterPage.css';

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

export const NotificationCenterPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Top Level Mode: 'notifications' | 'tasks'
  const [hubMode, setHubMode] = useState<'notifications' | 'tasks'>('notifications');

  // Notification tab state
  const [notifTab, setNotifTab] = useState<'all' | 'unread'>('all');
  const [search, setSearch] = useState('');
  const [notifications, setNotifications] = useState<BellNotificationItem[]>([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState<number>(0);
  const [notifTotal, setNotifTotal] = useState<number>(0);
  const [notifPage, setNotifPage] = useState<number>(1);
  const [notifTotalPages, setNotifTotalPages] = useState<number>(1);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  // Task / Approval state
  const [taskTab, setTaskTab] = useState<'pending' | 'decided' | 'all'>('pending');
  const [tasks, setTasks] = useState<WorkflowTaskItem[]>([]);
  const [pendingTaskCount, setPendingTaskCount] = useState<number>(0);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  // Bulk Selection state
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [bulkDeciding, setBulkDeciding] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(true);

  const limit = 20;

  // ─── Fetch Notifications ───
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(notifPage));
      params.set('limit', String(limit));

      const [listRes, countRes] = await Promise.all([
        fetch(`/api/notifications?${params.toString()}`).then((r) => r.json()).catch(() => null),
        fetch('/api/notifications?count=true').then((r) => r.json()).catch(() => null)
      ]);

      if (listRes?.success) {
        setNotifications(listRes.data.rows || []);
        setNotifTotal(listRes.data.total || 0);
        setNotifTotalPages(listRes.data.totalPages || 1);
      }

      if (countRes?.success) {
        const unread = countRes.data.unread || 0;
        setUnreadNotifCount(unread);
        window.dispatchEvent(new CustomEvent('sails:notif-count-updated', { detail: { count: unread + pendingTaskCount } }));
      }
    } catch {
      toast({ type: 'error', message: 'Failed to load notifications' });
    } finally {
      setLoading(false);
    }
  }, [notifPage, limit, pendingTaskCount, toast]);

  // ─── Fetch Tasks ───
  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const q = new URLSearchParams();
      if (taskTab !== 'all') q.set('status', taskTab);

      const [listRes, countRes] = await Promise.all([
        fetch(`/api/workflow/tasks?${q.toString()}`).then((r) => r.json()).catch(() => null),
        fetch('/api/workflow/tasks?count=true').then((r) => r.json()).catch(() => null)
      ]);

      if (listRes?.success) {
        setTasks(listRes.data.rows || []);
      }

      if (countRes?.success) {
        const pending = countRes.data.count || 0;
        setPendingTaskCount(pending);
        window.dispatchEvent(new CustomEvent('sails:notif-count-updated', { detail: { count: unreadNotifCount + pending } }));
      }
    } catch {
      toast({ type: 'error', message: 'Failed to load approval tasks' });
    } finally {
      setLoading(false);
    }
  }, [taskTab, unreadNotifCount, toast]);

  useEffect(() => {
    setSelectedTaskIds([]); // Reset selection on tab/mode switch
    if (hubMode === 'notifications') {
      fetchNotifications();
    } else {
      fetchTasks();
    }
  }, [hubMode, taskTab, fetchNotifications, fetchTasks]);

  // ─── Toggle Notification Expand ───
  const handleToggleExpand = async (item: BellNotificationItem) => {
    const nextState = !expandedIds[item.id];
    setExpandedIds((prev) => ({ ...prev, [item.id]: nextState }));

    if (item.status !== 'read') {
      try {
        const res = await fetch(`/api/notifications?id=${item.id}&mark=read`, { method: 'PATCH' });
        const json = await res.json();
        if (json.success) {
          setNotifications((prev) =>
            prev.map((n) => (n.id === item.id ? { ...n, status: 'read', read_at: new Date().toISOString() } : n))
          );
          const nextUnread = Math.max(0, unreadNotifCount - 1);
          setUnreadNotifCount(nextUnread);
          window.dispatchEvent(new CustomEvent('sails:notif-count-updated', { detail: { count: nextUnread + pendingTaskCount } }));
        }
      } catch {
        // ignore
      }
    }
  };

  // ─── Mark All Notifications Read ───
  const handleMarkAllRead = async () => {
    try {
      const res = await fetch('/api/notifications?mark_all_read=true', { method: 'PATCH' });
      const json = await res.json();
      if (json.success) {
        toast({ type: 'success', message: 'All notifications marked as read' });
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, status: 'read', read_at: new Date().toISOString() }))
        );
        setUnreadNotifCount(0);
        window.dispatchEvent(new CustomEvent('sails:notif-count-updated', { detail: { count: pendingTaskCount } }));
      }
    } catch {
      toast({ type: 'error', message: 'Failed to mark all as read' });
    }
  };

  // ─── Direct Task Decision (Single) ───
  const handleTaskDecision = async (task: WorkflowTaskItem, action: 'approve' | 'reject', e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setDecidingId(task.id);
      const res = await fetch(`/api/workflow/tasks/${task.id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      const json = await res.json();
      if (json.success) {
        toast({
          type: 'success',
          message: action === 'approve' ? 'Task approved successfully' : 'Task rejected'
        });
        setSelectedTaskIds((prev) => prev.filter((id) => id !== task.id));
        fetchTasks();
      } else {
        toast({ type: 'error', message: json.error || 'Failed to submit decision' });
      }
    } catch {
      toast({ type: 'error', message: 'Error submitting decision' });
    } finally {
      setDecidingId(null);
    }
  };

  // ─── Bulk Task Decision (Multi-Select) ───
  const handleBulkDecision = async (action: 'approve' | 'reject') => {
    if (selectedTaskIds.length === 0) return;
    try {
      setBulkDeciding(true);
      const promises = selectedTaskIds.map((taskId) =>
        fetch(`/api/workflow/tasks/${taskId}/decide`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action })
        }).then((r) => r.json()).catch(() => null)
      );

      const results = await Promise.all(promises);
      const successes = results.filter((r) => r?.success).length;

      toast({
        type: 'success',
        message: `Successfully ${action === 'approve' ? 'approved' : 'rejected'} ${successes} task(s)`
      });

      setSelectedTaskIds([]);
      fetchTasks();
    } catch {
      toast({ type: 'error', message: 'Failed to process bulk decision' });
    } finally {
      setBulkDeciding(false);
    }
  };

  const formatTimeAgo = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      const ms = Date.now() - date.getTime();
      const mins = Math.floor(ms / (1000 * 60));
      if (mins < 1) return 'Just now';
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs}h ago`;
      const days = Math.floor(hrs / 24);
      if (days < 7) return `${days}d ago`;
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return '';
    }
  };

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
            className="sails-notif-page__body-link"
            onClick={(e) => e.stopPropagation()}
          >
            {part} <ExternalLink size={11} style={{ display: 'inline', verticalAlign: 'middle' }} />
          </a>
        );
      }
      return part;
    });
  };

  const filteredNotifications = notifications.filter((n) => {
    if (notifTab === 'unread' && n.status === 'read') return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchSubject = (n.subject || '').toLowerCase().includes(q);
      const matchBody = (n.body || '').toLowerCase().includes(q);
      const matchSource = (n.source || '').toLowerCase().includes(q);
      return matchSubject || matchBody || matchSource;
    }
    return true;
  });

  const filteredTasks = tasks.filter((t) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = (t.def_name || '').toLowerCase().includes(q);
      const matchStage = ((t as any).stage_name || t.step_id || '').toLowerCase().includes(q);
      return matchName || matchStage;
    }
    return true;
  });

  const pendingTasksList = filteredTasks.filter((t) => t.status === 'pending');
  const isAllSelected =
    pendingTasksList.length > 0 &&
    pendingTasksList.every((t) => selectedTaskIds.includes(t.id));
  const isSomeSelected =
    pendingTasksList.some((t) => selectedTaskIds.includes(t.id)) && !isAllSelected;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedTaskIds([]);
    } else {
      setSelectedTaskIds(pendingTasksList.map((t) => t.id));
    }
  };

  const toggleTaskSelect = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const totalBadgeCount = unreadNotifCount + pendingTaskCount;

  return (
    <div className="sails-notif-page-root">
      {/* Page Header */}
      <div className="sails-notif-page__header">
        <div className="sails-notif-page__title-group">
          <div className="sails-notif-page__icon-wrap">
            <Bell size={24} />
          </div>
          <div>
            <h1 className="sails-notif-page__title">
              Notification & Task Hub
              {totalBadgeCount > 0 && (
                <span className="sails-notif-page__badge">{totalBadgeCount} action required</span>
              )}
            </h1>
            <p className="sails-notif-page__subtitle">
              Manage system announcements, notifications, and review workflow task approvals.
            </p>
          </div>
        </div>

        <div className="sails-notif-page__header-actions">
          {hubMode === 'notifications' && unreadNotifCount > 0 && (
            <button
              type="button"
              className="sails-btn sails-btn--secondary sails-notif-page__action-btn"
              onClick={handleMarkAllRead}
            >
              <CheckCircle2 size={14} />
              <span>Mark all as read</span>
            </button>
          )}
          <button
            type="button"
            className="sails-btn sails-btn--secondary sails-notif-page__action-btn"
            onClick={hubMode === 'notifications' ? fetchNotifications : fetchTasks}
            title="Refresh"
          >
            <RefreshCw size={14} className={loading ? 'sails-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Main Mode Switcher: Notifications vs Approvals */}
      <div className="sails-notif-mode-switcher">
        <button
          type="button"
          className={`sails-notif-mode-btn ${hubMode === 'notifications' ? 'sails-notif-mode-btn--active' : ''}`}
          onClick={() => setHubMode('notifications')}
        >
          <Bell size={16} />
          <span>Notifications</span>
          {unreadNotifCount > 0 && <span className="sails-notif-mode-badge">{unreadNotifCount}</span>}
        </button>
        <button
          type="button"
          className={`sails-notif-mode-btn ${hubMode === 'tasks' ? 'sails-notif-mode-btn--active' : ''}`}
          onClick={() => setHubMode('tasks')}
        >
          <FileText size={16} />
          <span>Approvals & Tasks</span>
          {pendingTaskCount > 0 && <span className="sails-notif-mode-badge">{pendingTaskCount}</span>}
        </button>
      </div>

      {/* Control Bar: Sub-Tabs, Search & Bulk Actions */}
      <div className="sails-notif-page__controls">
        <div className="sails-notif-page__tabs">
          {hubMode === 'notifications' ? (
            <>
              <button
                type="button"
                className={`sails-notif-page__tab ${notifTab === 'all' ? 'sails-notif-page__tab--active' : ''}`}
                onClick={() => setNotifTab('all')}
              >
                <span>All</span>
                <span className="sails-notif-page__tab-count">{notifTotal}</span>
              </button>
              <button
                type="button"
                className={`sails-notif-page__tab ${notifTab === 'unread' ? 'sails-notif-page__tab--active' : ''}`}
                onClick={() => setNotifTab('unread')}
              >
                <span>Unread</span>
                {unreadNotifCount > 0 && (
                  <span className="sails-notif-page__tab-badge">{unreadNotifCount}</span>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={`sails-notif-page__tab ${taskTab === 'pending' ? 'sails-notif-page__tab--active' : ''}`}
                onClick={() => setTaskTab('pending')}
              >
                <span>Pending Action</span>
                {pendingTaskCount > 0 && (
                  <span className="sails-notif-page__tab-badge">{pendingTaskCount}</span>
                )}
              </button>
              <button
                type="button"
                className={`sails-notif-page__tab ${taskTab === 'decided' ? 'sails-notif-page__tab--active' : ''}`}
                onClick={() => setTaskTab('decided')}
              >
                <span>Decided History</span>
              </button>
              <button
                type="button"
                className={`sails-notif-page__tab ${taskTab === 'all' ? 'sails-notif-page__tab--active' : ''}`}
                onClick={() => setTaskTab('all')}
              >
                <span>All Tasks</span>
              </button>
            </>
          )}
        </div>

        <div className="sails-notif-page__search-wrap">
          <Search size={14} className="sails-notif-page__search-icon" />
          <input
            type="text"
            className="sails-notif-page__search-input"
            placeholder={
              hubMode === 'notifications'
                ? 'Search notifications by keyword, subject, or source...'
                : 'Search tasks by workflow name or stage...'
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Bulk Action Bar (For Tasks in Pending tab) */}
      {hubMode === 'tasks' && taskTab === 'pending' && pendingTasksList.length > 0 && (
        <div className="sails-notif-bulk-bar">
          <div className="sails-notif-bulk-left">
            <button
              type="button"
              className="sails-notif-select-all-btn"
              onClick={toggleSelectAll}
            >
              {isAllSelected ? (
                <CheckSquare size={16} className="sails-notif-checkbox-icon sails-notif-checkbox-icon--checked" />
              ) : isSomeSelected ? (
                <MinusSquare size={16} className="sails-notif-checkbox-icon sails-notif-checkbox-icon--checked" />
              ) : (
                <Square size={16} className="sails-notif-checkbox-icon" />
              )}
              <span>Select All ({pendingTasksList.length})</span>
            </button>
            {selectedTaskIds.length > 0 && (
              <span className="sails-notif-selected-pill">
                {selectedTaskIds.length} selected
              </span>
            )}
          </div>

          {selectedTaskIds.length > 0 && (
            <div className="sails-notif-bulk-actions">
              <UiActionGroup size="md">
                <UiActionItem
                  icon={<Check size={13} />}
                  label={`Approve (${selectedTaskIds.length})`}
                  tone="success"
                  disabled={bulkDeciding}
                  onClick={() => handleBulkDecision('approve')}
                />
                <UiActionDivider />
                <UiActionItem
                  icon={<X size={13} />}
                  label={`Reject (${selectedTaskIds.length})`}
                  tone="danger"
                  disabled={bulkDeciding}
                  onClick={() => handleBulkDecision('reject')}
                />
                <UiActionDivider />
                <UiActionItem
                  label="Deselect"
                  onClick={() => setSelectedTaskIds([])}
                />
              </UiActionGroup>
            </div>
          )}
        </div>
      )}

      {/* Main Content Area */}
      <div className="sails-notif-page__card">
        {loading ? (
          <div className="sails-notif-page__loading">
            <div className="sails-notif-page__skeleton" />
            <div className="sails-notif-page__skeleton" />
            <div className="sails-notif-page__skeleton" />
          </div>
        ) : hubMode === 'notifications' ? (
          /* ─── NOTIFICATIONS LIST ─── */
          filteredNotifications.length === 0 ? (
            <div className="sails-notif-page__empty">
              <Inbox size={44} className="sails-notif-page__empty-icon" />
              <h3 className="sails-notif-page__empty-title">
                {search
                  ? 'No matching notifications found'
                  : notifTab === 'unread'
                  ? 'You have reviewed all notifications'
                  : 'No notifications yet'}
              </h3>
              <p className="sails-notif-page__empty-desc">
                {search
                  ? 'Try refining your search keyword or clearing the filter.'
                  : 'Workflow triggers and system announcements will appear here.'}
              </p>
            </div>
          ) : (
            <div className="sails-notif-page__list">
              {filteredNotifications.map((item) => {
                const isExpanded = !!expandedIds[item.id];
                const isUnread = item.status !== 'read';

                return (
                  <div
                    key={item.id}
                    className={`sails-notif-card ${isUnread ? 'sails-notif-card--unread' : 'sails-notif-card--read'} ${isExpanded ? 'sails-notif-card--expanded' : ''}`}
                    onClick={() => handleToggleExpand(item)}
                  >
                    <div className="sails-notif-card__left">
                      <div className={`sails-notif-card__icon ${!isUnread ? 'sails-notif-card__icon--read' : ''}`}>
                        <Info size={18} />
                      </div>
                    </div>

                    <div className="sails-notif-card__center">
                      <div className="sails-notif-card__meta">
                        <span className="sails-notif-card__source">
                          {item.source || 'Workflow'}
                        </span>
                        <span className="sails-notif-card__dot">•</span>
                        <span className="sails-notif-card__time">
                          <Clock size={11} /> {formatTimeAgo(item.created_at)}
                        </span>
                        {isUnread && <span className="sails-notif-card__unread-tag">New</span>}
                      </div>

                      <h4 className={`sails-notif-card__subject ${!isUnread ? 'sails-notif-card__subject--read' : ''}`}>
                        {item.subject || 'System Notification'}
                      </h4>

                      {item.body && (
                        <div className={`sails-notif-card__body ${isExpanded ? 'sails-notif-card__body--full' : 'sails-notif-card__body--collapsed'}`}>
                          {renderMessageBody(item.body)}
                        </div>
                      )}
                    </div>

                    <div className="sails-notif-card__right">
                      <button
                        type="button"
                        className="sails-notif-card__expand-btn"
                        title={isExpanded ? 'Collapse' : 'Expand'}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleExpand(item);
                        }}
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          /* ─── APPROVALS & TASKS LIST ─── */
          filteredTasks.length === 0 ? (
            <div className="sails-notif-page__empty">
              <CheckCircle2 size={44} className="sails-notif-page__empty-icon" style={{ color: '#10b981' }} />
              <h3 className="sails-notif-page__empty-title">All caught up!</h3>
              <p className="sails-notif-page__empty-desc">
                {taskTab === 'pending'
                  ? 'No pending approval requests waiting for your action.'
                  : 'No tasks found in this view.'}
              </p>
            </div>
          ) : (
            <div className="sails-notif-page__list">
              {filteredTasks.map((t) => {
                const isPending = t.status === 'pending';
                const isDeciding = decidingId === t.id;
                const isSelected = selectedTaskIds.includes(t.id);

                return (
                  <div
                    key={t.id}
                    className={`sails-notif-card ${isPending ? 'sails-notif-card--unread' : 'sails-notif-card--read'} ${isSelected ? 'sails-notif-card--selected' : ''}`}
                    onClick={() => navigate(`/tasks/${t.id}`)}
                  >
                    {/* Checkbox for Bulk Selection */}
                    {isPending && (
                      <div
                        className="sails-notif-card__checkbox-wrap"
                        onClick={(e) => toggleTaskSelect(t.id, e)}
                      >
                        {isSelected ? (
                          <CheckSquare size={18} className="sails-notif-checkbox-icon sails-notif-checkbox-icon--checked" />
                        ) : (
                          <Square size={18} className="sails-notif-checkbox-icon" />
                        )}
                      </div>
                    )}

                    <div className="sails-notif-card__left">
                      <div className={`sails-notif-card__icon ${isPending ? 'sails-notif-card__icon--task' : 'sails-notif-card__icon--read'}`}>
                        <FileText size={18} />
                      </div>
                    </div>

                    <div className="sails-notif-card__center">
                      <div className="sails-notif-card__meta">
                        <span className="sails-notif-card__source">Workflow Approval</span>
                        <span className="sails-notif-card__dot">•</span>
                        <span className="sails-notif-card__time">
                          <Clock size={11} /> {formatTimeAgo(t.created_at)}
                        </span>
                        {t.status && (
                          <span
                            className={`sails-task-status-badge sails-task-status-badge--${t.status}`}
                          >
                            {t.status}
                          </span>
                        )}
                      </div>

                      <h4 className="sails-notif-card__subject">
                        {t.def_name || 'Workflow Task'}
                      </h4>

                      <p className="sails-task-stage-line">
                        Current Stage: <strong>{(t as any).stage_name || t.step_id}</strong>
                      </p>
                    </div>

                    <div className="sails-notif-card__actions" onClick={(e) => e.stopPropagation()}>
                      {isPending ? (
                        <UiActionGroup size="md">
                          <UiActionItem
                            icon={<Check size={13} />}
                            label="Approve"
                            tone="success"
                            disabled={isDeciding || bulkDeciding}
                            onClick={(e) => handleTaskDecision(t, 'approve', e)}
                          />
                          <UiActionDivider />
                          <UiActionItem
                            icon={<X size={13} />}
                            label="Reject"
                            tone="danger"
                            disabled={isDeciding || bulkDeciding}
                            onClick={(e) => handleTaskDecision(t, 'reject', e)}
                          />
                          <UiActionDivider />
                          <UiActionItem
                            icon={<ChevronRight size={13} />}
                            label="Details"
                            onClick={() => navigate(`/tasks/${t.id}`)}
                          />
                        </UiActionGroup>
                      ) : (
                        <UiActionGroup size="md">
                          <UiActionItem
                            icon={<ChevronRight size={13} />}
                            label="View Decision"
                            onClick={() => navigate(`/tasks/${t.id}`)}
                          />
                        </UiActionGroup>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* Pagination Footer (For notifications) */}
        {hubMode === 'notifications' && notifTotalPages > 1 && (
          <div className="sails-notif-page__pagination">
            <span className="sails-notif-page__page-info">
              Showing page {notifPage} of {notifTotalPages} ({notifTotal} total)
            </span>
            <div className="sails-notif-page__page-btns">
              <button
                type="button"
                className="sails-btn sails-btn--secondary"
                disabled={notifPage <= 1}
                onClick={() => setNotifPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft size={14} /> Previous
              </button>
              <button
                type="button"
                className="sails-btn sails-btn--secondary"
                disabled={notifPage >= notifTotalPages}
                onClick={() => setNotifPage((p) => Math.min(notifTotalPages, p + 1))}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationCenterPage;
