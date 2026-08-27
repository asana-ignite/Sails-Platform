import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Inbox,
  CheckCircle,
  Clock,
  AlertCircle,
  Search,
  RefreshCw,
  ChevronRight,
  User,
  Calendar,
  Layers,
  ArrowRight
} from 'lucide-react';
import type { WorkflowTaskItem } from '@sails/shared';
import { useToast } from '../../contexts/ToastContext';
import './TaskInboxPage.css';

interface TaskInboxPageProps {
  defaultTab?: 'pending' | 'decided' | 'overdue' | 'all';
}

const TaskInboxPage: React.FC<TaskInboxPageProps> = ({ defaultTab = 'pending' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const isHistoryPath = location.pathname.includes('/history');
  const [tab, setTab] = useState<'pending' | 'decided' | 'overdue' | 'all'>(
    isHistoryPath ? 'decided' : defaultTab
  );
  const [search, setSearch] = useState('');
  const [tasks, setTasks] = useState<WorkflowTaskItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<{ pending: number }>({ pending: 0 });

  const fetchTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      if (tab === 'pending') q.set('status', 'pending');
      else if (tab === 'decided') q.set('status', 'decided');
      else if (tab === 'overdue') {
        q.set('status', 'pending');
        q.set('overdue', 'true');
      } else if (tab === 'all') {
        q.set('status', 'all');
      }

      if (search) q.set('search', search);

      const [res, countRes] = await Promise.all([
        fetch(`/api/workflow/tasks?${q.toString()}`),
        fetch(`/api/workflow/tasks?count=true`)
      ]);

      const json = await res.json();
      const countJson = await countRes.json();

      if (json.success) {
        setTasks(json.data.rows || []);
      } else {
        throw new Error(json.error || 'Failed to fetch tasks');
      }

      if (countJson.success) {
        setCounts({ pending: countJson.data.count || 0 });
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [tab, search]);

  const formatDate = (isoStr: string | null) => {
    if (!isoStr) return '\u2014';
    try {
      return new Date(isoStr).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="sails-inbox-page">
      <div className="sails-inbox-controls">
        <div className="sails-inbox-tabs">
          <button
            type="button"
            className={`sails-inbox-tab ${tab === 'pending' ? 'active' : ''}`}
            onClick={() => setTab('pending')}
          >
            <Clock size={15} />
            <span>Pending</span>
            {counts.pending > 0 && <span className="sails-inbox-tab-badge">{counts.pending}</span>}
          </button>
          <button
            type="button"
            className={`sails-inbox-tab ${tab === 'decided' ? 'active' : ''}`}
            onClick={() => setTab('decided')}
          >
            <CheckCircle size={15} />
            <span>Decided History</span>
          </button>
          <button
            type="button"
            className={`sails-inbox-tab ${tab === 'all' ? 'active' : ''}`}
            onClick={() => setTab('all')}
          >
            <Layers size={15} />
            <span>All Assigned</span>
          </button>
        </div>

        <div className="sails-inbox-actions-zone">
          <div className="sails-inbox-search">
            <Search size={15} className="sails-inbox-search-icon" />
            <input
              type="text"
              className="sails-inbox-search-input"
              placeholder="Search by workflow name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="sails-btn-inbox-refresh"
            onClick={async () => {
              await fetchTasks();
              toast.info('Task list refreshed.');
            }}
            disabled={loading}
            title="Refresh list"
          >
            <RefreshCw size={15} className={loading ? 'sails-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="sails-inbox-content">
        {loading ? (
          <div className="sails-inbox-loading">
            <RefreshCw size={24} className="sails-spin" />
            <p>Loading workflow tasks...</p>
          </div>
        ) : error ? (
          <div className="sails-inbox-error">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        ) : tasks.length === 0 ? (
          <div className="sails-inbox-empty">
            <Inbox size={40} />
            <h3>No tasks found</h3>
            <p>
              {tab === 'pending'
                ? "You're all caught up! There are no pending approvals assigned to you."
                : 'No tasks match your current filter criteria.'}
            </p>
          </div>
        ) : (
          <div className="sails-inbox-table-card">
            <table className="sails-inbox-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Workflow Definition</th>
                  <th>Stage / Step</th>
                  <th>Assigned Type</th>
                  <th>Due Date</th>
                  <th>Received</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => {
                  const isPending = t.status === 'pending';
                  return (
                    <tr
                      key={t.id}
                      className="sails-inbox-row"
                      onClick={() => navigate(`/tasks/${t.id}`)}
                    >
                      <td>
                        <span className={`sails-inbox-chip sails-inbox-chip--${t.status}`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="sails-inbox-wf-name">
                        <strong>{t.def_name || 'Workflow Task'}</strong>
                      </td>
                      <td>
                        <span className="sails-inbox-step-name">{(t as any).stage_name || t.step_id}</span>
                      </td>
                      <td>
                        <span className="sails-inbox-assignee-tag">
                          {t.assignee_type === 'role'
                            ? `Role: ${String(t.assignee_id).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`
                            : t.assignee_type === 'user'
                            ? (String(t.assignee_id).startsWith('[') ? 'Multiple Assignees' : 'Direct User')
                            : `${t.assignee_type}: ${t.assignee_id}`}
                        </span>
                      </td>
                      <td>
                        <span className="sails-inbox-date">
                          {formatDate(t.due_at || null)}
                        </span>
                      </td>
                      <td>
                        <span className="sails-inbox-date">
                          {formatDate(t.created_at)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="sails-btn-inbox-open"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/tasks/${t.id}`);
                          }}
                        >
                          <span>{isPending ? 'Review' : 'View'}</span>
                          <ArrowRight size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskInboxPage;
