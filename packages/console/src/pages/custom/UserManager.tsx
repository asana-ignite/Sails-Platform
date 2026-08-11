import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { Search, MoreHorizontal, Shield, Circle, UserPlus, Filter, ChevronUp, ChevronDown, ArrowUpDown, ChevronLeft, ChevronRight, Edit2, UserX, UserCheck, Key, Trash2, Copy, X } from 'lucide-react';
import { useConsole } from '../../contexts/ConsoleContext';
import { useDateTimePrefs, formatSystemDateTimeValue } from '../../utils/systemDateTime';
import { CustomSelect } from '../../components/common/CustomSelect';
import { UserDetailsModal } from './UserDetailsModal';
import { UiTableCard, UiTable, UiTh, UiTr, UiTd, UiActionsMenu, UiActionsItem, UiActionsDivider, UiPagination, UiCheckboxTh, UiCheckboxTd } from '../../components/ui';
import './UserManager.css';

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  title?: string;
  positionText?: string;
  role: 'Admin' | 'Member' | 'Guest';
  status: 'Active' | 'Inactive' | 'Pending';
  avatar?: string;
  lastLogin: string;
}

const UserManager: React.FC = () => {
  const { t } = useTranslation();
  const datetimePrefs = useDateTimePrefs();
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
  const [selectedUserIdForDetails, setSelectedUserIdForDetails] = useState<string | null>(null);
  
  // Form & Modal State
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', title: '', positionText: '', role: 'MEMBER' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // Themed Confirmation & Notification Modal States
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<{ id: string; name: string } | null>(null);
  const [notificationMsg, setNotificationMsg] = useState<{ title: string; message: string; type: 'error' | 'success' } | null>(null);

  const fetchUsers = async () => {
    try {
      setIsLoadingUsers(true);
      const response = await fetch('/api/tenant/users');
      if (response.ok) {
        const data = await response.json();
        const mappedUsers = data.map((u: any) => {
          const slots = (u.positionSlots || []).map((ps: any) => `${ps.id} (${ps.position?.name || 'Position'})`);
          const posText = slots.length > 0 ? slots.join(', ') : 'Unassigned Position';
          return {
            id: u.id,
            name: u.name || 'Unknown User',
            email: u.email,
            phone: u.phone || '',
            title: u.title || '',
            positionText: posText,
            role: u.role === 'TENANT_ADMIN' || u.role === 'ADMIN' ? 'Admin' : u.role === 'MEMBER' ? 'Member' : 'Guest',
            status: u.isActive ? 'Active' : 'Inactive',
            lastLogin: u.lastLoginAt ? formatSystemDateTimeValue(u.lastLoginAt, datetimePrefs) : 'Never',
            avatar: u.image
          };
        });
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
    const bridgeName = '__SAILS_OPEN_DRAWER__';
    (window as any)[bridgeName] = () => {
      setShowAddUserDrawer(true);
    };
    return () => { delete (window as any)[bridgeName]; };
  }, [setShowAddUserDrawer]);

  // 2. Stable Header Action Registration
  const memoizedHeaderActions = useMemo(() => (
    <button 
      id="sails-header-add-user"
      className="sails-btn sails-btn--primary" 
      onClick={() => setShowAddUserDrawer(true)}
    >
      <UserPlus size={18} />
      <span>{t('admin_user_manager.addUser')}</span>
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
        setFormData({ name: '', email: '', phone: '', title: '', positionText: '', role: 'MEMBER' });
        setEditingUserId(null);
        setSelectedRole('Member');
        fetchUsers(); // Refresh list
      } else {
        const err = await response.json();
        setNotificationMsg({ title: 'Save Failed', message: err.error || 'Operation failed', type: 'error' });
      }
    } catch (error: any) {
      console.error('Error saving user:', error);
      setNotificationMsg({ title: 'Save Failed', message: error.message || 'An unexpected error occurred', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Last Resort: Global DOM Listener
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('#sails-header-add-user')) {
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
        positionText: user.positionText || 'Unassigned Position',
        role: user.role === 'Admin' ? 'TENANT_ADMIN' : 'MEMBER'
      });
      setSelectedRole(user.role);
      setShowAddUserDrawer(true);
    } else if (action === 'remove') {
      setDeleteConfirmUser({ id: user.id, name: user.name });
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
    if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown size={14} className="sails-user-manager__sort-icon--idle" />;
    return sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  return (
    <div className="sails-user-manager">
      {/* 1. Header Toolbar */}
      <div className="sails-user-manager__toolbar">
        <div className="sails-user-manager__search-wrapper">
          <Search size={18} className="sails-user-manager__search-icon" />
          <input
            type="text"
            placeholder={t('admin_user_manager.searchUsers')}
            className="sails-user-manager__search-input"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
        <div className="sails-user-manager__actions">
          <div className="sails-user-manager__filter-container">
            <button
              className={`sails-btn ${showFilters ? 'sails-btn--primary' : 'sails-btn--ghost'}`}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter size={16} />
              <span>Filters</span>
              {(activeFilters.role || activeFilters.status) && <span className="sails-btn__badge"></span>}
            </button>

            {/* 1.1 Advanced Filter Popover */}
            {showFilters && (
              <div className="sails-user-manager__filter-popover">
                <div className="sails-user-manager__filter-group">
                  <label>Filter by Role</label>
                  <div className="sails-user-manager__filter-options">
                    {['Admin', 'Member', 'Guest'].map(role => (
                      <button
                        key={role}
                        className={`sails-filter-chip ${activeFilters.role === role ? 'active' : ''}`}
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
                <div className="sails-user-manager__filter-group">
                  <label>Filter by Status</label>
                  <div className="sails-user-manager__filter-options">
                    {['Active', 'Inactive', 'Pending'].map(status => (
                      <button
                        key={status}
                        className={`sails-filter-chip ${activeFilters.status === status ? 'active' : ''}`}
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
                <div className="sails-user-manager__filter-footer">
                  <button
                    className="sails-user-manager__filter-clear"
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
      <UiTableCard>
        <UiTable>
          <thead>
            <tr>
              <UiCheckboxTh
                checked={paginatedUsers.length > 0 && paginatedUsers.every(u => selectedUserIds.has(u.id))}
                indeterminate={paginatedUsers.some(u => selectedUserIds.has(u.id)) && !paginatedUsers.every(u => selectedUserIds.has(u.id))}
                onChange={handleSelectAll}
              />
              <UiTh sortable sortState={sortConfig?.key === 'name' ? sortConfig.direction : 'idle'} onSort={() => handleSort('name')}>User Identity</UiTh>
              <UiTh sortable sortState={sortConfig?.key === 'role' ? sortConfig.direction : 'idle'} onSort={() => handleSort('role')}>Name & Title</UiTh>
              <UiTh sortable sortState={sortConfig?.key === 'status' ? sortConfig.direction : 'idle'} onSort={() => handleSort('status')}>{t('admin_user_manager.columns.status')}</UiTh>
              <UiTh sortable sortState={sortConfig?.key === 'lastLogin' ? sortConfig.direction : 'idle'} onSort={() => handleSort('lastLogin')}>{t('admin_user_manager.columns.lastLogin')}</UiTh>
              <th style={{ textAlign: 'right', width: 48 }}></th>
            </tr>
          </thead>
          <tbody>
            {isLoadingUsers ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '100px' }}>
                  <div className="sails-loading-spinner"></div>
                  <p style={{ marginTop: '16px', color: 'var(--sails-text-muted)' }}>Fetching platform users...</p>
                </td>
              </tr>
            ) : paginatedUsers.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '100px' }}>
                  <p style={{ color: 'var(--sails-text-muted)' }}>{t('admin_user_manager.noUsers')}</p>
                </td>
              </tr>
            ) : paginatedUsers.map((user) => (
              <UiTr key={user.id} onClick={() => setSelectedUserIdForDetails(user.id)} selected={selectedUserIds.has(user.id)}>
                <UiCheckboxTd checked={selectedUserIds.has(user.id)} onChange={() => toggleUserSelection(user.id)} onClick={(e) => e.stopPropagation()} />
                <UiTd>
                  <div className="sails-user-manager__identity">
                    <div className="sails-user-manager__avatar">
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
                    <div className="sails-user-manager__info">
                      <span className="sails-user-manager__name">{user.name}</span>
                      <span className="sails-user-manager__title-label">{user.positionText || 'Unassigned Position'}</span>
                      <span className="sails-user-manager__email">{user.email}</span>
                    </div>
                  </div>
                </UiTd>
                <UiTd>
                  <div className="sails-user-manager__role-tag">
                    <Shield size={14} />
                    <span>{user.role}</span>
                  </div>
                </UiTd>
                <UiTd>
                  <div className={`sails-status-badge sails-status-badge--${user.status.toLowerCase()}`}>
                    <Circle size={8} fill="currentColor" />
                    <span>{user.status}</span>
                  </div>
                </UiTd>
                <UiTd>
                  <span className="sails-user-manager__last-login">{user.lastLogin}</span>
                </UiTd>
                <UiTd align="right" onClick={(e) => e.stopPropagation()}>
                  <UiActionsMenu open={activeMenuUserId === user.id} onToggle={() => setActiveMenuUserId(activeMenuUserId === user.id ? null : user.id)}>
                    <UiActionsItem onClick={() => handleAction('edit', user)}>
                      <Edit2 size={14} /> {t('admin_user_manager.editUser')}
                    </UiActionsItem>
                    <UiActionsItem onClick={() => handleAction(user.status === 'Active' ? 'deactivate' : 'activate', user)}>
                      {user.status === 'Active' ? (<><UserX size={14} /> Deactivate User</>) : (<><UserCheck size={14} /> Activate User</>)}
                    </UiActionsItem>
                    <UiActionsItem onClick={() => handleAction('reset_password', user)}>
                      <Key size={14} /> {t('admin_user_manager.resetPassword')}
                    </UiActionsItem>
                    <UiActionsDivider />
                    <UiActionsItem onClick={() => handleAction('copy_id', user)}>
                      <Copy size={14} /> Copy User ID
                    </UiActionsItem>
                    <UiActionsItem danger onClick={() => handleAction('remove', user)}>
                      <Trash2 size={14} /> {t('admin_user_manager.deleteUser')}
                    </UiActionsItem>
                  </UiActionsMenu>
                </UiTd>
              </UiTr>
            ))}
          </tbody>
        </UiTable>

        <UiPagination
          page={currentPage}
          totalPages={totalPages || 1}
          total={totalCount}
          pageSize={pageSize === totalCount ? 50 : pageSize}
          label="users"
          onPageChange={setCurrentPage}
          onPageSizeChange={(n) => { setPageSize(n); setCurrentPage(1); }}
          pageSizeOptions={[10, 25, 50]}
        />
      </UiTableCard>
      {/* 4. Add/Edit User Ghost Glass Modal */}
      {showAddUserDrawer && createPortal(
        <div className="sails-modal-overlay">
          <div className="sails-card" style={{ width: '940px', maxWidth: '95vw', padding: '28px', borderRadius: 'var(--sails-radius-lg, 20px)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <UserPlus size={20} color="var(--sails-primary)" />
                {editingUserId ? t('admin_user_manager.editUser') : t('admin_user_manager.addUser')}
              </h3>
              <button 
                onClick={() => {
                  setShowAddUserDrawer(false);
                  setEditingUserId(null);
                  setFormData({ name: '', email: '', phone: '', title: '', positionText: '', role: 'MEMBER' });
                }}
                style={{ background: 'none', border: 'none', color: 'var(--sails-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div className="sails-form-group">
                  <label className="sails-label" style={{ display: 'block', marginBottom: '6px' }}>{t('admin_user_manager.form.firstName')}</label>
                  <input 
                    type="text" 
                    className="sails-input" 
                    placeholder="e.g. John Doe" 
                    autoFocus 
                    style={{ width: '100%' }}
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>

                <div className="sails-form-group">
                  <label className="sails-label" style={{ display: 'block', marginBottom: '6px' }}>{t('admin_user_manager.form.email')}</label>
                  <input 
                    type="email" 
                    className="sails-input" 
                    placeholder="john@example.com" 
                    style={{ width: '100%' }}
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div className="sails-form-group">
                  <label className="sails-label" style={{ display: 'block', marginBottom: '6px' }}>{t('admin_user_manager.form.phone')}</label>
                  <input 
                    type="tel" 
                    className="sails-input" 
                    placeholder="+1 (555) 000-0000" 
                    style={{ width: '100%' }}
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </div>

                <div className="sails-form-group">
                  <label className="sails-label" style={{ display: 'block', marginBottom: '6px' }}>{t('admin_user_manager.form.title')}</label>
                  <input 
                    type="text" 
                    className="sails-input" 
                    placeholder="e.g. Senior Software Engineer" 
                    style={{ width: '100%' }}
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>
              </div>

              <div className="sails-form-group" style={{ marginBottom: '16px' }}>
                <label className="sails-label" style={{ display: 'block', marginBottom: '6px' }}>Mapped Position (Slot)</label>
                <div 
                  className="sails-input" 
                  style={{ 
                    width: '100%',
                    background: 'var(--sails-bg-body)',
                    color: 'var(--sails-primary, #3b82f6)',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  {(formData as any).positionText || 'Unassigned Position'}
                </div>
              </div>

              <div className="sails-form-group">
                <label className="sails-label" style={{ display: 'block', marginBottom: '8px' }}>System Role</label>
                <div className="sails-role-selector">
                  {[
                    { name: 'Admin', code: 'TENANT_ADMIN', desc: 'Full administrative access to tenant settings' },
                    { name: 'Member', code: 'MEMBER', desc: 'Standard access to platform features' },
                    { name: 'Guest', code: 'GUEST', desc: 'Limited read-only access' }
                  ].map(role => (
                    <button 
                      key={role.name} 
                      type="button"
                      className={`sails-role-option ${selectedRole === role.name ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedRole(role.name);
                        setFormData(prev => ({ ...prev, role: role.code }));
                      }}
                    >
                      <Shield size={22} />
                      <div className="sails-role-info">
                        <span className="sails-role-name">{role.name}</span>
                        <span className="sails-role-desc">{role.desc}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button 
                className="sails-btn sails-btn--secondary" 
                onClick={() => {
                  setShowAddUserDrawer(false);
                  setEditingUserId(null);
                  setFormData({ name: '', email: '', phone: '', title: '', positionText: '', role: 'MEMBER' });
                }}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button 
                className="sails-btn sails-btn--primary" 
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

      {/* THEMED DELETE USER CONFIRMATION MODAL */}
      {deleteConfirmUser && createPortal(
        <div className="sails-modal-overlay">
          <div className="sails-card" style={{ width: '440px', padding: '28px', borderRadius: 'var(--sails-radius-lg, 20px)' }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div style={{
                background: 'rgba(239, 68, 68, 0.12)',
                color: 'var(--sails-danger, #ef4444)',
                padding: '12px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Trash2 size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '1.2rem', fontWeight: 600, color: 'var(--sails-text-main)' }}>
                  {t('admin_user_manager.deleteUser')}
                </h3>
                <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--sails-text-muted)', lineHeight: 1.5 }}>
                  {t('admin_user_manager.confirmDelete')}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button 
                className="sails-btn sails-btn--secondary"
                onClick={() => setDeleteConfirmUser(null)}
              >
                Cancel
              </button>
              <button 
                className="sails-btn sails-btn--danger"
                onClick={async () => {
                  const targetId = deleteConfirmUser.id;
                  setDeleteConfirmUser(null);
                  try {
                    const response = await fetch(`/api/tenant/users/${targetId}`, { method: 'DELETE' });
                    if (response.ok) {
                      fetchUsers();
                    } else {
                      const err = await response.json();
                      setNotificationMsg({ title: 'Delete Failed', message: err.error || 'Delete failed', type: 'error' });
                    }
                  } catch (error: any) {
                    setNotificationMsg({ title: 'Delete Failed', message: error.message || 'Delete failed', type: 'error' });
                  }
                }}
              >
                {t('admin_user_manager.deleteUser')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* THEMED NOTIFICATION / ERROR MODAL */}
      {notificationMsg && createPortal(
        <div className="sails-modal-overlay">
          <div className="sails-card" style={{ width: '400px', padding: '28px', borderRadius: 'var(--sails-radius-lg, 20px)', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', color: notificationMsg.type === 'error' ? 'var(--sails-danger, #ef4444)' : 'var(--sails-primary)' }}>
              {notificationMsg.type === 'error' ? <Trash2 size={44} /> : <Shield size={44} />}
            </div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.15rem', fontWeight: 600 }}>{notificationMsg.title}</h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--sails-text-muted)', margin: '0 0 20px 0', lineHeight: 1.5 }}>
              {notificationMsg.message}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button 
                className="sails-btn sails-btn--primary"
                onClick={() => setNotificationMsg(null)}
                style={{ minWidth: '120px' }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* USER DETAILS GHOST GLASS MODAL */}
      <UserDetailsModal
        userId={selectedUserIdForDetails}
        onClose={() => setSelectedUserIdForDetails(null)}
        onEdit={(id) => {
          setSelectedUserIdForDetails(null);
          const targetUser = users.find(u => u.id === id);
          if (targetUser) {
            handleAction('edit', targetUser);
          }
        }}
      />
    </div>
  );
};

export default UserManager;
