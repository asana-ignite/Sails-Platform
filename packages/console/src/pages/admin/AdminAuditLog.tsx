import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Search, RefreshCw, ChevronLeft, ChevronRight, Database, Shield, Wrench, Radio } from 'lucide-react';
import Spinner from '../../components/common/Spinner';
import { CustomSelect } from '../../components/common/CustomSelect';
import { useConsole } from '../../contexts/ConsoleContext';
import './AdminAuditLog.css';

interface AuditRow {
  id: string;
  action?: string;
  objectName?: string;
  recordId?: string;
  category?: string;
  eventName?: string;
  schemaName?: string;
  tableName?: string;
  oldValues?: any;
  newValues?: any;
  details?: any;
  sqlExecuted?: string;
  createdAt: string;
  user?: { id: string; name: string | null; email: string };
}

type TabType = 'data' | 'system' | 'ddl';

const TABS: { key: TabType; label: string; icon: React.ElementType }[] = [
  { key: 'data', label: 'Data Audit', icon: Database },
  { key: 'system', label: 'System Events', icon: Shield },
  { key: 'ddl', label: 'Schema Changes', icon: Wrench },
];

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'var(--klao-success)',
  UPDATE: 'var(--klao-warning)',
  DELETE: 'var(--klao-danger)',
  LOGIN: 'var(--klao-info)',
  LOGOUT: 'var(--klao-text-muted)',
};

const PAGE_SIZE_OPTIONS = [
  { value: 10, label: '10' },
  { value: 25, label: '25' },
  { value: 50, label: '50' },
];

const ACTION_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Actions' },
  { value: 'CREATE', label: 'CREATE' },
  { value: 'UPDATE', label: 'UPDATE' },
  { value: 'DELETE', label: 'DELETE' },
];

const SYSTEM_ACTION_OPTIONS = [
  ...ACTION_OPTIONS,
  { value: 'LOGIN', label: 'LOGIN' },
  { value: 'LOGOUT', label: 'LOGOUT' },
];

const AdminAuditLog: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('data');
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [pageSize, setPageSize] = useState(25);
  const { setHeaderActions } = useConsole();

  const fetchData = useCallback(async (tab: TabType, p: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        type: tab, page: String(p), limit: String(pageSize), sortBy, sortDir,
      });
      if (actionFilter) params.set('action', actionFilter);
      if (search) params.set('search', search);

      const res = await fetch(`/api/console/audit-logs?${params}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to load audit logs');
      setRows(json.data.rows);
      setTotal(json.data.total);
      setTotalPages(json.data.totalPages);
    } catch (err: any) {
      setError(err.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [actionFilter, search, sortBy, sortDir, pageSize]);

  useEffect(() => {
    fetchData(activeTab, page);
  }, [activeTab, page, fetchData]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setPage(1);
    setActionFilter('');
    setSearch('');
    setSearchInput('');
    setSortBy('createdAt');
    setSortDir('desc');
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
    setPage(1);
  };

  const openLiveWindow = () => {
    window.open('/audit-live', 'klao-audit-live', 'width=1100,height=700');
  };

  const headerActions = useMemo(() => (
    <button className="klao-btn klao-btn--primary" onClick={openLiveWindow}>
      <Radio size={16} />
      <span>Live Monitor</span>
    </button>
  ), []);

  useEffect(() => {
    setHeaderActions(headerActions);
    return () => setHeaderActions(null);
  }, [setHeaderActions, headerActions]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const formatUser = (user?: { name?: string | null; email?: string } | null) => {
    if (!user) return 'System';
    return user.name || user.email || 'Unknown';
  };

  const actionColor = (action?: string) => ACTION_COLORS[action?.toUpperCase() || ''] || 'var(--klao-text-muted)';

  const ActionBadge: React.FC<{ action?: string }> = ({ action }) => {
    const color = actionColor(action);
    return (
      <span className="klao-audit-badge" style={{ color, background: `${color}18`, borderColor: `${color}40` }}>
        {action}
      </span>
    );
  };

  const SortableTh: React.FC<{ field: string; label: string }> = ({ field, label }) => (
    <th className="klao-audit__th klao-audit__th--sortable" onClick={() => handleSort(field)}>
      <span className="klao-audit__th-content">
        {label}
        {sortBy === field
          ? (sortDir === 'asc' ? <ArrowUp size={12} className="klao-audit__sort-icon--active" /> : <ArrowDown size={12} className="klao-audit__sort-icon--active" />)
          : <ArrowUpDown size={12} className="klao-audit__sort-icon" />
        }
      </span>
    </th>
  );

  const StaticTh: React.FC<{ label: string }> = ({ label }) => (
    <th className="klao-audit__th">{label}</th>
  );

  const Row: React.FC<{ row: AuditRow }> = ({ row }) => (
    <tr className="klao-audit-tr">
      <td className="klao-audit-td klao-audit-td--date">{formatDate(row.createdAt)}</td>
      <td className="klao-audit-td"><ActionBadge action={row.action} /></td>
      <td className="klao-audit-td klao-audit-td--object">
        {activeTab === 'data' ? row.objectName : activeTab === 'system' ? row.eventName : `${row.schemaName}.${row.tableName || '*'}`}
      </td>
      <td className="klao-audit-td">
        {activeTab === 'data'
          ? <span className="klao-audit-td--id" title={row.recordId || ''}>{row.recordId?.substring(0, 12) || '-'}</span>
          : activeTab === 'system'
            ? <span className="klao-audit-badge klao-audit-badge--category">{row.category}</span>
            : <span className="klao-audit-td--object">{row.tableName || '-'}</span>
        }
      </td>
      <td className="klao-audit-td">{formatUser(row.user)}</td>
      <td className="klao-audit-td klao-audit-td--json">
        {activeTab === 'data' && row.action === 'UPDATE' && (
          <details className="klao-audit-details">
            <summary>View diff</summary>
            <pre className="klao-audit-json">{JSON.stringify({ old: row.oldValues, new: row.newValues }, null, 2)}</pre>
          </details>
        )}
        {activeTab === 'system' && row.details && (
          <details className="klao-audit-details">
            <summary>View details</summary>
            <pre className="klao-audit-json">{JSON.stringify(row.details, null, 2)}</pre>
          </details>
        )}
        {activeTab === 'ddl' && row.sqlExecuted && (
          <details className="klao-audit-details">
            <summary>View SQL</summary>
            <pre className="klao-audit-json">{row.sqlExecuted}</pre>
          </details>
        )}
        {((activeTab === 'data' && row.action !== 'UPDATE') || (activeTab === 'system' && !row.details) || (activeTab === 'ddl' && !row.sqlExecuted)) && (
          <span className="klao-audit-muted">-</span>
        )}
      </td>
    </tr>
  );

  const startRecord = rows.length > 0 ? (page - 1) * pageSize + 1 : 0;
  const endRecord = Math.min(page * pageSize, total);

  const auditContent = (
    <div className="klao-audit__inner">
      <nav className="klao-audit__tabs">
        {TABS.map(tab => (
          <button
            key={tab.key}
            className={`klao-audit__tab ${activeTab === tab.key ? 'klao-audit__tab--active' : ''}`}
            onClick={() => handleTabChange(tab.key)}
          >
            <tab.icon size={16} />
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      <div className="klao-audit__toolbar">
        <div className="klao-audit__search">
          <Search size={16} className="klao-audit__search-icon" />
          <input
            type="text"
            className="klao-audit__search-input"
            placeholder={activeTab === 'data' ? 'Search object name...' : activeTab === 'ddl' ? 'Search table name...' : 'Search event name...'}
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (setSearch(searchInput), setPage(1))}
          />
        </div>
        <CustomSelect
          size="sm"
          value={actionFilter || ''}
          options={activeTab === 'system' ? SYSTEM_ACTION_OPTIONS : ACTION_OPTIONS}
          onChange={(val) => { setActionFilter(String(val)); setPage(1); }}
        />
        <button className="klao-btn klao-btn--ghost" onClick={() => fetchData(activeTab, page)} title="Refresh">
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="klao-audit__spacer" />

      <div className="klao-card klao-audit__table-wrapper">
        {loading ? (
          <div className="klao-audit__loading"><Spinner size={32} label="Loading audit logs..." /></div>
        ) : error ? (
          <div className="klao-audit__error">{error}</div>
        ) : (
          <>
            <table className="klao-audit__table">
              <thead>
                <tr>
                  <SortableTh field="createdAt" label="Timestamp" />
                  <SortableTh field="action" label="Action" />
                  {activeTab === 'data' && <SortableTh field="objectName" label="Object" />}
                  {activeTab === 'system' && <SortableTh field="eventName" label="Event" />}
                  {activeTab === 'ddl' && <SortableTh field="schemaName" label="Schema" />}
                  {activeTab === 'data' && <StaticTh label="Record ID" />}
                  {activeTab === 'system' && <SortableTh field="category" label="Category" />}
                  {activeTab === 'ddl' && <SortableTh field="tableName" label="Table" />}
                  <StaticTh label="User" />
                  <StaticTh label="Details" />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={6} className="klao-audit__empty">No audit records found.</td></tr>
                ) : (
                  rows.map(row => <Row key={row.id} row={row} />)
                )}
              </tbody>
            </table>
            <div className="klao-audit__pagination">
              <div className="klao-audit__pagination-info">
                Showing <strong>{startRecord}</strong> to <strong>{endRecord}</strong> of <strong>{total}</strong> records
              </div>
              <div className="klao-audit__pagination-controls">
                <button
                  className="klao-pagination-btn"
                  onClick={() => setPage(prev => Math.max(1, prev - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="klao-pagination-pages">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <button
                      key={p}
                      className={`klao-pagination-page ${page === p ? 'klao-pagination-page--active' : ''}`}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <button
                  className="klao-pagination-btn"
                  onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={page >= totalPages || totalPages === 0}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <div className="klao-audit__page-size">
                <span>Per page:</span>
                <CustomSelect
                  size="sm"
                  value={pageSize}
                  options={PAGE_SIZE_OPTIONS}
                  onChange={(val) => { setPageSize(Number(val)); setPage(1); }}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return <div className="klao-audit">{auditContent}</div>;
};

export default AdminAuditLog;
