import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, MoreHorizontal, Shield, Circle, UserPlus, Filter, ChevronUp, ChevronDown, ArrowUpDown, ChevronLeft, ChevronRight, Edit2, UserX, UserCheck, Key, Trash2, Copy, X } from 'lucide-react';
import { useConsole } from '../../contexts/ConsoleContext';
import { CustomSelect } from '../../components/common/CustomSelect';
import './UserManager.css';

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  title?: string;
  role: 'Admin' | 'Member' | 'Guest';
  status: 'Active' | 'Inactive' | 'Pending';
  avatar?: string;
  lastLogin: string;
}

const UserManager: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof User; direction: 'asc' | 'desc' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [activeMenuUserId, setActiveMenuUserId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilters, setActiveFilters] = useState<{ role?: string; status?: string }>({});
  const [selectedRole, setSelectedRole] = useState('Member');
  
  // Form State
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', title: '', role: 'MEMBER' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setIsLoadingUsers(true);
      const response = await fetch('/api/tenant/users');
      if (response.ok) {
        const data = await response.json();
        const mappedUsers = data.map((u: any) => ({
          id: u.id,
          name: u.name || 'Unknown User',
          email: u.email,
          phone: u.phone || '',
          title: u.title || '',
          role: u.role === 'TENANT_ADMIN' || u.role === 'ADMIN' ? 'Admin' : u.role === 'MEMBER' ? 'Member' : 'Guest',
          status: u.isActive ? 'Active' : 'Inactive',
          lastLogin: u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never',
          avatar: u.image
        }));
        setUsers(mappedUsers);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

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

  const handleSubmit = async () => {
    if (!formData.email) return alert('Email is required');
    try {
      setIsSubmitting(true);
      const url = editingUserId ? `/api/tenant/users/${editingUserId}` : '/api/tenant/users';
      const method = editingUserId ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setShowAddUserDrawer(false);
        setFormData({ name: '', email: '', phone: '', title: '', role: 'MEMBER' });
        setEditingUserId(null);
        setSelectedRole('Member');
        fetchUsers(); // Refresh list
      } else {
        const err = await response.json();
        alert(err.error || 'Operation failed');
      }
    } catch (error) {
      console.error('Error saving user:', error);
      alert('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

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
    let userList = [...users].filter(u => {
      const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = !activeFilters.role || u.role === activeFilters.role;
      const matchesStatus = !activeFilters.status || u.status === activeFilters.status;

      return matchesSearch && matchesRole && matchesStatus;
    });

    if (sortConfig !== null) {
      userList.sort((a, b) => {
        const valA = a[sortConfig.key] ?? '';
        const valB = b[sortConfig.key] ?? '';
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    const totalCount = userList.length;
    const totalPages = Math.ceil(totalCount / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const paginatedUsers = userList.slice(startIndex, startIndex + pageSize);

    return { paginatedUsers, totalPages, totalCount, startRange: totalCount === 0 ? 0 : startIndex + 1, endRange: Math.min(startIndex + pageSize, totalCount) };
  }, [searchTerm, sortConfig, currentPage, pageSize, activeFilters, users]);

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

  const handleAction = async (action: string, user: User) => {
    setActiveMenuUserId(null);
    
    if (action === 'edit') {
      setEditingUserId(user.id);
      setFormData({
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        title: user.title || '',
        role: user.role === 'Admin' ? 'TENANT_ADMIN' : 'MEMBER'
      });
      setSelectedRole(user.role);
      setShowAddUserDrawer(true);
    } else if (action === 'remove') {
      if (window.confirm(`Are you sure you want to remove ${user.name}?`)) {
        try {
          const response = await fetch(`/api/tenant/users/${user.id}`, { method: 'DELETE' });
          if (response.ok) {
            fetchUsers();
          } else {
            const err = await response.json();
            alert(err.error || 'Delete failed');
          }
        } catch (error) {
          console.error('Delete error:', error);
        }
      }
    } else if (action === 'deactivate' || action === 'activate') {
        try {
          const response = await fetch(`/api/tenant/users/${user.id}`, { 
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive: action === 'activate' })
          });
          if (response.ok) fetchUsers();
        } catch (e) { console.error(e); }
    }
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
                        onClick={() => {
                          setActiveFilters(prev => ({ ...prev, role: prev.role === role ? undefined : role }));
                          setCurrentPage(1);
                        }}
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
                        onClick={() => {
                          setActiveFilters(prev => ({ ...prev, status: prev.status === status ? undefined : status }));
                          setCurrentPage(1);
                        }}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="klao-user-manager__filter-footer">
                  <button
                    className="klao-user-manager__filter-clear"
                    onClick={() => {
                      setActiveFilters({});
                      setCurrentPage(1);
                    }}
                  >
                    Clear Filters
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
                  <span>Name & Title</span>
                  <ArrowUpDown size={14} className="klao-user-manager__sort-icon--idle" />
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
            {isLoadingUsers ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '100px' }}>
                  <div className="klao-loading-spinner"></div>
                  <p style={{ marginTop: '16px', color: 'var(--klao-text-muted)' }}>Fetching platform users...</p>
                </td>
              </tr>
            ) : paginatedUsers.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '100px' }}>
                  <p style={{ color: 'var(--klao-text-muted)' }}>No users found matching your criteria.</p>
                </td>
              </tr>
            ) : paginatedUsers.map((user) => (
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
                      {user.avatar ? (
                        <img 
                          src={user.avatar} 
                          alt={user.name} 
                          style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} 
                        />
                      ) : (
                        user.name.charAt(0)
                      )}
                    </div>
                    <div className="klao-user-manager__info">
                      <span className="klao-user-manager__name">{user.name}</span>
                      <span className="klao-user-manager__title-label">{user.title || 'No position specified'}</span>
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
              <CustomSelect
                size="sm"
                value={pageSize === totalCount ? 'all' : pageSize}
                options={[
                  { value: 10, label: '10' },
                  { value: 25, label: '25' },
                  { value: 50, label: '50' },
                  { value: 'all', label: 'ALL' }
                ]}
                onChange={(val) => {
                  setPageSize(val === 'all' ? (totalCount || 1000) : Number(val));
                  setCurrentPage(1);
                }}
              />
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
                <h2 className="klao-add-drawer__title">{editingUserId ? 'Edit User Details' : 'Add New User'}</h2>
                <p className="klao-add-drawer__subtitle">
                  {editingUserId ? 'Update existing platform identity and permissions.' : 'Create a new platform identity and assign roles.'}
                </p>
              </div>
              <button 
                className="klao-add-drawer__close" 
                onClick={() => {
                  setShowAddUserDrawer(false);
                  setEditingUserId(null);
                  setFormData({ name: '', email: '', phone: '', title: '', role: 'MEMBER' });
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="klao-add-drawer__body">
              <div className="klao-form-group">
                <label className="klao-label">Full Name</label>
                <input 
                  type="text" 
                  className="klao-input" 
                  placeholder="e.g. John Doe" 
                  autoFocus 
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="klao-form-group">
                <label className="klao-label">Email Address</label>
                <input 
                  type="email" 
                  className="klao-input" 
                  placeholder="john@example.com" 
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>

              <div className="klao-form-group">
                <label className="klao-label">Phone Number</label>
                <input 
                  type="tel" 
                  className="klao-input" 
                  placeholder="+1 (555) 000-0000" 
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>

              <div className="klao-form-group">
                <label className="klao-label">Work Position / Title</label>
                <input 
                  type="text" 
                  className="klao-input" 
                  placeholder="e.g. Senior Developer" 
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                />
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
                      onClick={() => {
                        setSelectedRole(role.name);
                        setFormData(prev => ({ ...prev, role: role.code }));
                      }}
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
              <button 
                className="klao-btn klao-btn--ghost" 
                onClick={() => {
                  setShowAddUserDrawer(false);
                  setEditingUserId(null);
                  setFormData({ name: '', email: '', phone: '', title: '', role: 'MEMBER' });
                }}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button 
                className="klao-btn klao-btn--primary" 
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : editingUserId ? 'Save Changes' : 'Create User Account'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default UserManager;
