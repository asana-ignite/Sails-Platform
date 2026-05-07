import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, MoreHorizontal, Shield, Circle, UserPlus, Filter, ChevronUp, ChevronDown, ArrowUpDown, ChevronLeft, ChevronRight, Edit2, UserX, UserCheck, Key, Trash2, Copy, X } from 'lucide-react';
import { useConsole } from '../../contexts/ConsoleContext';
import './UserManager.css';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Member' | 'Guest';
  status: 'Active' | 'Inactive' | 'Pending';
  avatar?: string;
  lastLogin: string;
}

const MOCK_USERS: User[] = [
  { id: '1', name: 'Alexander Wright', email: 'a.wright@klao.io', role: 'Admin', status: 'Active', lastLogin: '2024-05-01 09:42' },
  { id: '2', name: 'Sarah Jenkins', email: 'sarah.j@company.io', role: 'Member', status: 'Active', lastLogin: '2024-05-02 11:15' },
  { id: '3', name: 'Michael Chen', email: 'm.chen@tech.global', role: 'Member', status: 'Inactive', lastLogin: '2024-04-15 14:20' },
  { id: '4', name: 'Emma Rodriguez', email: 'emma.r@design.co', role: 'Guest', status: 'Pending', lastLogin: '2024-04-30 16:55' },
  { id: '5', name: 'David Smith', email: 'd.smith@corp.net', role: 'Member', status: 'Active', lastLogin: '2024-05-03 08:30' },
  { id: '6', name: 'Olivia Thompson', email: 'o.thompson@klao.io', role: 'Admin', status: 'Active', lastLogin: '2024-05-03 10:12' },
  { id: '7', name: 'James Wilson', email: 'j.wilson@agency.uk', role: 'Member', status: 'Active', lastLogin: '2024-05-01 15:45' },
  { id: '8', name: 'Sophia Lee', email: 's.lee@startup.io', role: 'Guest', status: 'Inactive', lastLogin: '2024-03-22 09:00' },
  { id: '9', name: 'Benjamin Garcia', email: 'b.garcia@klao.io', role: 'Member', status: 'Active', lastLogin: '2024-05-02 17:30' },
  { id: '10', name: 'Isabella Martinez', email: 'i.martinez@cloud.com', role: 'Admin', status: 'Pending', lastLogin: '2024-04-28 12:10' },
  { id: '11', name: 'William Taylor', email: 'w.taylor@enterprise.co', role: 'Member', status: 'Active', lastLogin: '2024-05-03 11:05' },
  { id: '12', name: 'Mia Anderson', email: 'mia.a@studio.design', role: 'Guest', status: 'Active', lastLogin: '2024-05-02 14:22' },
  { id: '13', name: 'Lucas Hernandez', email: 'l.hernandez@tech.io', role: 'Member', status: 'Inactive', lastLogin: '2024-04-10 16:40' },
  { id: '14', name: 'Charlotte King', email: 'c.king@klao.io', role: 'Admin', status: 'Active', lastLogin: '2024-05-03 09:15' },
  { id: '15', name: 'Henry Scott', email: 'h.scott@finance.co', role: 'Member', status: 'Active', lastLogin: '2024-05-01 13:50' },
  { id: '16', name: 'Amelia Green', email: 'a.green@marketing.ai', role: 'Guest', status: 'Pending', lastLogin: '2024-04-25 10:30' },
  { id: '17', name: 'Sebastian Adams', email: 's.adams@dev.io', role: 'Member', status: 'Active', lastLogin: '2024-05-02 08:45' },
  { id: '18', name: 'Evelyn Baker', email: 'e.baker@klao.io', role: 'Admin', status: 'Active', lastLogin: '2024-05-03 15:20' },
  { id: '19', name: 'Jack Campbell', email: 'j.campbell@corp.com', role: 'Member', status: 'Inactive', lastLogin: '2024-03-30 11:10' },
  { id: '20', name: 'Harper Mitchell', email: 'h.mitchell@media.net', role: 'Guest', status: 'Active', lastLogin: '2024-05-01 17:05' },
  { id: '21', name: 'Daniel Carter', email: 'd.carter@security.co', role: 'Member', status: 'Active', lastLogin: '2024-05-02 09:55' },
  { id: '22', name: 'Abigail Phillips', email: 'a.phillips@klao.io', role: 'Admin', status: 'Pending', lastLogin: '2024-04-29 14:15' },
  { id: '23', name: 'Matthew Evans', email: 'm.evans@cloud.io', role: 'Member', status: 'Active', lastLogin: '2024-05-03 12:40' },
  { id: '24', name: 'Elizabeth Turner', email: 'e.turner@ops.net', role: 'Guest', status: 'Inactive', lastLogin: '2024-04-05 10:20' },
  { id: '25', name: 'Joseph Parker', email: 'j.parker@tech.com', role: 'Member', status: 'Active', lastLogin: '2024-05-01 08:15' },
  { id: '26', name: 'Chloe Roberts', email: 'c.roberts@klao.io', role: 'Admin', status: 'Active', lastLogin: '2024-05-03 16:35' },
  { id: '27', name: 'Samuel Cook', email: 's.cook@design.co', role: 'Member', status: 'Active', lastLogin: '2024-05-02 11:50' },
  { id: '28', name: 'Grace Morgan', email: 'g.morgan@startup.ai', role: 'Guest', status: 'Pending', lastLogin: '2024-04-26 13:25' },
  { id: '29', name: 'Jackson Bell', email: 'j.bell@finance.io', role: 'Member', status: 'Inactive', lastLogin: '2024-04-12 09:40' },
  { id: '30', name: 'Victoria Murphy', email: 'v.murphy@klao.io', role: 'Admin', status: 'Active', lastLogin: '2024-05-03 10:50' },
  { id: '31', name: 'Andrew Rivera', email: 'a.rivera@dev.net', role: 'Member', status: 'Active', lastLogin: '2024-05-01 14:15' },
  { id: '32', name: 'Zoey Cooper', email: 'z.cooper@cloud.co', role: 'Guest', status: 'Active', lastLogin: '2024-05-02 15:40' },
  { id: '33', name: 'Christopher Gray', email: 'c.gray@agency.io', role: 'Member', status: 'Pending', lastLogin: '2024-04-27 11:20' },
  { id: '34', name: 'Lillian Ward', email: 'l.ward@klao.io', role: 'Admin', status: 'Active', lastLogin: '2024-05-03 13:10' },
  { id: '35', name: 'Gabriel Watson', email: 'g.watson@tech.global', role: 'Member', status: 'Active', lastLogin: '2024-05-02 09:10' },
  { id: '36', name: 'Layla Brooks', email: 'l.brooks@studio.io', role: 'Guest', status: 'Inactive', lastLogin: '2024-03-15 16:50' },
  { id: '37', name: 'Anthony Kelly', email: 'a.kelly@marketing.co', role: 'Member', status: 'Active', lastLogin: '2024-05-01 12:30' },
  { id: '38', name: 'Riley Sanders', email: 'r.sanders@klao.io', role: 'Admin', status: 'Active', lastLogin: '2024-05-03 14:45' },
  { id: '39', name: 'Isaac Price', email: 'i.price@ops.com', role: 'Member', status: 'Pending', lastLogin: '2024-04-29 10:15' },
  { id: '40', name: 'Nora Bennett', email: 'n.bennett@media.io', role: 'Guest', status: 'Active', lastLogin: '2024-05-02 17:20' },
  { id: '41', name: 'Ryan Wood', email: 'r.wood@startup.net', role: 'Member', status: 'Active', lastLogin: '2024-05-01 09:30' },
  { id: '42', name: 'Hazel Barnes', email: 'h.barnes@klao.io', role: 'Admin', status: 'Inactive', lastLogin: '2024-04-01 11:55' },
  { id: '43', name: 'Nathan Ross', email: 'n.ross@dev.io', role: 'Member', status: 'Active', lastLogin: '2024-05-03 08:10' },
  { id: '44', name: 'Elena Henderson', email: 'e.henderson@cloud.net', role: 'Guest', status: 'Active', lastLogin: '2024-05-02 13:40' },
  { id: '45', name: 'Aaron Perry', email: 'a.perry@tech.co', role: 'Member', status: 'Pending', lastLogin: '2024-04-30 15:25' },
  { id: '46', name: 'Stella Coleman', email: 's.coleman@klao.io', role: 'Admin', status: 'Active', lastLogin: '2024-05-03 16:15' },
  { id: '47', name: 'Jonathan Jenkins', email: 'j.jenkins@agency.uk', role: 'Member', status: 'Active', lastLogin: '2024-05-01 10:45' },
  { id: '48', name: 'Maya Simmons', email: 'm.simmons@studio.net', role: 'Guest', status: 'Inactive', lastLogin: '2024-03-10 09:20' },
  { id: '49', name: 'Christian Foster', email: 'c.foster@finance.io', role: 'Member', status: 'Active', lastLogin: '2024-05-02 14:10' },
  { id: '50', name: 'Leah Bryant', email: 'l.bryant@klao.io', role: 'Admin', status: 'Active', lastLogin: '2024-05-03 11:30' }
];

const UserManager: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof User; direction: 'asc' | 'desc' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [activeMenuUserId, setActiveMenuUserId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilters, setActiveFilters] = useState<{ role?: string; status?: string }>({});
  const [selectedRole, setSelectedRole] = useState('Member');

  const { setHeaderActions, showAddUserDrawer, setShowAddUserDrawer } = useConsole();
  const selectAllRef = React.useRef<HTMLInputElement>(null);

  // 1. Global Signal Bridge (Guaranteed Communication)
  useEffect(() => {
    const bridgeName = '__KLAO_OPEN_DRAWER__';
    (window as any)[bridgeName] = () => {
      console.log("ACTION: Global Signal Received -> Opening Drawer");
      setShowAddUserDrawer(true);
    };
    console.log("SYSTEM: Global Bridge Initialized");
    return () => { delete (window as any)[bridgeName]; };
  }, [setShowAddUserDrawer]);

  // 2. Stable Header Action Registration
  const memoizedHeaderActions = useMemo(() => (
    <button 
      id="klao-header-add-user"
      className="klao-btn klao-btn--primary" 
      onClick={() => setShowAddUserDrawer(true)}
    >
      <UserPlus size={18} />
      <span>Add User</span>
    </button>
  ), [setShowAddUserDrawer]);

  useEffect(() => {
    setHeaderActions(memoizedHeaderActions);
    return () => setHeaderActions(null);
  }, [setHeaderActions, memoizedHeaderActions]);

  // 3. Last Resort: Global DOM Listener
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('#klao-header-add-user')) {
        console.log("DOM: Global Click Intercepted -> Opening Drawer");
        setShowAddUserDrawer(true);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [setShowAddUserDrawer]);

  // 2. Logic Memoization
  const { paginatedUsers, totalPages, totalCount, startRange, endRange } = useMemo(() => {
    let users = [...MOCK_USERS].filter(u => {
      const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = !activeFilters.role || u.role === activeFilters.role;
      const matchesStatus = !activeFilters.status || u.status === activeFilters.status;

      return matchesSearch && matchesRole && matchesStatus;
    });

    if (sortConfig !== null) {
      users.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    const totalCount = users.length;
    const totalPages = Math.ceil(totalCount / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const paginatedUsers = users.slice(startIndex, startIndex + pageSize);

    return { paginatedUsers, totalPages, totalCount, startRange: totalCount === 0 ? 0 : startIndex + 1, endRange: Math.min(startIndex + pageSize, totalCount) };
  }, [searchTerm, sortConfig, currentPage, pageSize, activeFilters]);

  // Handle indeterminate state for header checkbox
  useEffect(() => {
    if (selectAllRef.current) {
      const allOnPageSelected = paginatedUsers.length > 0 && paginatedUsers.every(u => selectedUserIds.has(u.id));
      const someOnPageSelected = paginatedUsers.some(u => selectedUserIds.has(u.id));
      selectAllRef.current.indeterminate = someOnPageSelected && !allOnPageSelected;
    }
  }, [selectedUserIds, paginatedUsers]);

  const handleSelectAll = () => {
    const allOnPageSelected = paginatedUsers.every(u => selectedUserIds.has(u.id));
    const nextSelected = new Set(selectedUserIds);

    paginatedUsers.forEach(u => {
      if (allOnPageSelected) {
        nextSelected.delete(u.id);
      } else {
        nextSelected.add(u.id);
      }
    });
    setSelectedUserIds(nextSelected);
  };

  const toggleUserSelection = (userId: string) => {
    const nextSelected = new Set(selectedUserIds);
    if (nextSelected.has(userId)) {
      nextSelected.delete(userId);
    } else {
      nextSelected.add(userId);
    }
    setSelectedUserIds(nextSelected);
  };

  const handleAction = (action: string, user: User) => {
    console.log(`${action} on user:`, user);
    setActiveMenuUserId(null);
  };

  // Close menus on click away
  useEffect(() => {
    const handleClickAway = () => {
      setActiveMenuUserId(null);
      // We don't close filters here as it has its own Apply button/X
    };
    document.addEventListener('click', handleClickAway);
    return () => document.removeEventListener('click', handleClickAway);
  }, []);

  const handleSort = (key: keyof User) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: keyof User) => {
    if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown size={14} className="klao-user-manager__sort-icon--idle" />;
    return sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  return (
    <div className="klao-user-manager">
      {/* 1. Header Toolbar */}
      <div className="klao-user-manager__toolbar">
        <div className="klao-user-manager__search-wrapper">
          <Search size={18} className="klao-user-manager__search-icon" />
          <input
            type="text"
            placeholder="Search users..."
            className="klao-user-manager__search-input"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
        <div className="klao-user-manager__actions">
          <div className="klao-user-manager__filter-container">
            <button
              className={`klao-btn ${showFilters ? 'klao-btn--primary' : 'klao-btn--ghost'}`}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter size={16} />
              <span>Filters</span>
              {(activeFilters.role || activeFilters.status) && <span className="klao-btn__badge"></span>}
            </button>

            {/* 1.1 Advanced Filter Popover */}
            {showFilters && (
              <div className="klao-user-manager__filter-popover">
                <div className="klao-user-manager__filter-group">
                  <label>Filter by Role</label>
                  <div className="klao-user-manager__filter-options">
                    {['Admin', 'Member', 'Guest'].map(role => (
                      <button
                        key={role}
                        className={`klao-filter-chip ${activeFilters.role === role ? 'active' : ''}`}
                        onClick={() => setActiveFilters(prev => ({ ...prev, role: prev.role === role ? undefined : role }))}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="klao-user-manager__filter-group">
                  <label>Filter by Status</label>
                  <div className="klao-user-manager__filter-options">
                    {['Active', 'Inactive', 'Pending'].map(status => (
                      <button
                        key={status}
                        className={`klao-filter-chip ${activeFilters.status === status ? 'active' : ''}`}
                        onClick={() => setActiveFilters(prev => ({ ...prev, status: prev.status === status ? undefined : status }))}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="klao-user-manager__filter-footer">
                  <button
                    className="klao-user-manager__filter-clear"
                    onClick={() => setActiveFilters({})}
                  >
                    Clear All Filters
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. User Data Table */}
      <div className="klao-card klao-user-manager__table-wrapper">
        <table className="klao-user-manager__table">
          <thead>
            <tr>
              <th className="klao-user-manager__th klao-user-manager__th--checkbox">
                <input
                  type="checkbox"
                  className="klao-checkbox"
                  ref={selectAllRef}
                  checked={paginatedUsers.length > 0 && paginatedUsers.every(u => selectedUserIds.has(u.id))}
                  onChange={handleSelectAll}
                />
              </th>
              <th className="klao-user-manager__th klao-user-manager__th--sortable" onClick={() => handleSort('name')}>
                <div className="klao-user-manager__th-content">
                  <span>User Identity</span>
                  {getSortIcon('name')}
                </div>
              </th>
              <th className="klao-user-manager__th klao-user-manager__th--sortable" onClick={() => handleSort('role')}>
                <div className="klao-user-manager__th-content">
                  <span>Role</span>
                  {getSortIcon('role')}
                </div>
              </th>
              <th className="klao-user-manager__th klao-user-manager__th--sortable" onClick={() => handleSort('status')}>
                <div className="klao-user-manager__th-content">
                  <span>Status</span>
                  {getSortIcon('status')}
                </div>
              </th>
              <th className="klao-user-manager__th klao-user-manager__th--sortable" onClick={() => handleSort('lastLogin')}>
                <div className="klao-user-manager__th-content">
                  <span>Last Activity</span>
                  {getSortIcon('lastLogin')}
                </div>
              </th>
              <th className="klao-user-manager__th klao-user-manager__th--actions"></th>
            </tr>
          </thead>
          <tbody>
            {paginatedUsers.map((user) => (
              <tr
                key={user.id}
                className={`klao-user-manager__tr ${selectedUserIds.has(user.id) ? 'klao-user-manager__tr--selected' : ''}`}
              >
                <td className="klao-user-manager__td klao-user-manager__td--checkbox">
                  <input
                    type="checkbox"
                    className="klao-checkbox"
                    checked={selectedUserIds.has(user.id)}
                    onChange={() => toggleUserSelection(user.id)}
                  />
                </td>
                <td className="klao-user-manager__td">
                  <div className="klao-user-manager__identity">
                    <div className="klao-user-manager__avatar">
                      {user.name.charAt(0)}
                    </div>
                    <div className="klao-user-manager__info">
                      <span className="klao-user-manager__name">{user.name}</span>
                      <span className="klao-user-manager__email">{user.email}</span>
                    </div>
                  </div>
                </td>
                <td className="klao-user-manager__td">
                  <div className="klao-user-manager__role-tag">
                    <Shield size={14} />
                    <span>{user.role}</span>
                  </div>
                </td>
                <td className="klao-user-manager__td">
                  <div className={`klao-status-badge klao-status-badge--${user.status.toLowerCase()}`}>
                    <Circle size={8} fill="currentColor" />
                    <span>{user.status}</span>
                  </div>
                </td>
                <td className="klao-user-manager__td">
                  <span className="klao-user-manager__last-login">{user.lastLogin}</span>
                </td>
                <td className="klao-user-manager__td klao-user-manager__td--actions">
                  <div className="klao-user-manager__action-wrapper" onClick={(e) => e.stopPropagation()}>
                    <button
                      className={`klao-user-manager__action-btn ${activeMenuUserId === user.id ? 'active' : ''}`}
                      onClick={() => setActiveMenuUserId(activeMenuUserId === user.id ? null : user.id)}
                    >
                      <MoreHorizontal size={18} />
                    </button>

                    {activeMenuUserId === user.id && (
                      <div className="klao-user-manager__context-menu">
                        <button className="klao-context-item" onClick={() => handleAction('edit', user)}>
                          <Edit2 size={14} />
                          <span>Edit Details</span>
                        </button>
                        <button
                          className="klao-context-item"
                          onClick={() => handleAction(user.status === 'Active' ? 'deactivate' : 'activate', user)}
                        >
                          {user.status === 'Active' ? (
                            <><UserX size={14} /><span>Deactivate User</span></>
                          ) : (
                            <><UserCheck size={14} /><span>Activate User</span></>
                          )}
                        </button>
                        <button className="klao-context-item" onClick={() => handleAction('reset_password', user)}>
                          <Key size={14} />
                          <span>Reset Password</span>
                        </button>
                        <div className="klao-context-divider"></div>
                        <button className="klao-context-item" onClick={() => handleAction('copy_id', user)}>
                          <Copy size={14} />
                          <span>Copy User ID</span>
                        </button>
                        <button className="klao-context-item klao-context-item--danger" onClick={() => handleAction('remove', user)}>
                          <Trash2 size={14} />
                          <span>Remove User</span>
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 3. Pagination Footer */}
        <div className="klao-user-manager__pagination">
          <div className="klao-user-manager__pagination-info">
            <span className="klao-user-manager__pagination-range">
              Showing <strong>{startRange}</strong> to <strong>{endRange}</strong> of <strong>{totalCount}</strong> users
            </span>
            <div className="klao-user-manager__page-size">
              <span className="klao-user-manager__page-size-label">Records per page:</span>
              <select
                className="klao-select-sm"
                value={pageSize === totalCount ? 'all' : pageSize}
                onChange={(e) => {
                  const val = e.target.value;
                  setPageSize(val === 'all' ? totalCount || 1000 : parseInt(val));
                  setCurrentPage(1);
                }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value="all">ALL</option>
              </select>
            </div>
          </div>
          <div className="klao-user-manager__pagination-controls">
            <button
              className="klao-pagination-btn"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft size={16} />
            </button>
            <div className="klao-pagination-pages">
              {[...Array(totalPages)].map((_, i) => (
                <button
                  key={i + 1}
                  className={`klao-pagination-page ${currentPage === i + 1 ? 'klao-pagination-page--active' : ''}`}
                  onClick={() => setCurrentPage(i + 1)}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button
              className="klao-pagination-btn"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
      {/* 4. Add User Slide-over Drawer (Total Restoration with Portal) */}
      {showAddUserDrawer && createPortal(
        <div className="klao-add-drawer" id="klao-user-add-drawer">
          <div className="klao-add-drawer__overlay" onClick={() => setShowAddUserDrawer(false)}></div>
          <div className="klao-add-drawer__panel">
            <div className="klao-add-drawer__header">
              <div className="klao-add-drawer__header-info">
                <h2 className="klao-add-drawer__title">Add New User</h2>
                <p className="klao-add-drawer__subtitle">Create a new platform identity and assign roles.</p>
              </div>
              <button className="klao-add-drawer__close" onClick={() => setShowAddUserDrawer(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="klao-add-drawer__body">
              <div className="klao-form-group">
                <label className="klao-label">Full Name</label>
                <input type="text" className="klao-input" placeholder="e.g. John Doe" autoFocus />
              </div>

              <div className="klao-form-group">
                <label className="klao-label">Email Address</label>
                <input type="email" className="klao-input" placeholder="john@example.com" />
              </div>

              <div className="klao-form-group">
                <label className="klao-label">Phone Number</label>
                <input type="tel" className="klao-input" placeholder="+1 (555) 000-0000" />
              </div>

              <div className="klao-form-group">
                <label className="klao-label">System Role</label>
                <div className="klao-role-selector">
                  {[
                    { name: 'Admin', code: 'TENANT_ADMIN', desc: 'Full administrative access to tenant settings' },
                    { name: 'Member', code: 'MEMBER', desc: 'Standard access to platform features' },
                    { name: 'Guest', code: 'GUEST', desc: 'Limited read-only or shared access' }
                  ].map(role => (
                    <button 
                      key={role.name} 
                      className={`klao-role-option ${selectedRole === role.name ? 'active' : ''}`}
                      onClick={() => setSelectedRole(role.name)}
                    >
                      <Shield size={24} />
                      <div className="klao-role-info">
                        <span className="klao-role-name">{role.name}</span>
                        <span className="klao-role-desc">{role.desc}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="klao-add-drawer__footer">
              <button className="klao-btn klao-btn--ghost" onClick={() => setShowAddUserDrawer(false)}>Cancel</button>
              <button className="klao-btn klao-btn--primary">Create User Account</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default UserManager;
