import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, User, Shield, Circle, Briefcase, Users, Database, 
  Mail, Phone, Calendar, Edit2, Award, Check, Minus, Lock,
  ArrowUpDown, ChevronUp, ChevronDown
} from 'lucide-react';
import Spinner from '../../components/common/Spinner';
import './UserDetailsModal.css';

interface PositionSlot {
  id: string;
  positionId: string;
  position?: {
    id: string;
    name: string;
    prefix: string;
    headCount?: number;
  };
}

interface TeamMember {
  teamId: string;
  userId: string;
  isLeader: boolean;
  team?: {
    id: string;
    name: string;
    parentId?: string | null;
  };
}

interface AccessibleTable {
  id: string;
  name: string;
  tableName: string;
  description?: string | null;
  isSystem: boolean;
  fieldCount: number;
  isAccessible: boolean;
  canCreate: boolean;
  canDelete: boolean;
  readScope: string;
  modifyScope: string;
  source: string;
}

export interface UserDetailsData {
  id: string;
  name: string;
  email: string;
  phone?: string;
  title?: string;
  positionText?: string;
  role: 'Admin' | 'Member' | 'Guest' | string;
  status: 'Active' | 'Inactive' | 'Pending' | string;
  avatar?: string;
  lastLogin: string;
  positionSlots?: PositionSlot[];
  teams?: TeamMember[];
  accessibleTables?: AccessibleTable[];
  accessibleTablesCount?: number;
}

interface UserDetailsModalProps {
  userId: string | null;
  onClose: () => void;
  onEdit: (userId: string) => void;
}

export const UserDetailsModal: React.FC<UserDetailsModalProps> = ({
  userId,
  onClose,
  onEdit
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'team' | 'data_access'>('details');
  const [user, setUser] = useState<UserDetailsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [tableSortConfig, setTableSortConfig] = useState<{ key: 'name' | 'readScope' | 'modifyScope' | 'canCreate' | 'canDelete'; direction: 'asc' | 'desc' } | null>(null);

  const handleTableSort = (key: 'name' | 'readScope' | 'modifyScope' | 'canCreate' | 'canDelete') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (tableSortConfig && tableSortConfig.key === key && tableSortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setTableSortConfig({ key, direction });
  };

  const getTableSortIcon = (key: 'name' | 'readScope' | 'modifyScope' | 'canCreate' | 'canDelete') => {
    if (!tableSortConfig || tableSortConfig.key !== key) return <ArrowUpDown size={13} className="klao-sort-icon--idle" />;
    return tableSortConfig.direction === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />;
  };

  const sortedAccessibleTables = useMemo(() => {
    const list = user?.accessibleTables || [];
    if (!tableSortConfig) return list;

    const scopeRank: Record<string, number> = { 'NONE': 0, 'OWNER': 1, 'TEAM': 2, 'HIERARCHY': 3, 'ALL': 4 };

    return [...list].sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      if (tableSortConfig.key === 'name') {
        valA = a.name || '';
        valB = b.name || '';
      } else if (tableSortConfig.key === 'readScope') {
        valA = scopeRank[a.readScope] || 0;
        valB = scopeRank[b.readScope] || 0;
      } else if (tableSortConfig.key === 'modifyScope') {
        valA = scopeRank[a.modifyScope] || 0;
        valB = scopeRank[b.modifyScope] || 0;
      } else if (tableSortConfig.key === 'canCreate') {
        valA = a.canCreate ? 1 : 0;
        valB = b.canCreate ? 1 : 0;
      } else if (tableSortConfig.key === 'canDelete') {
        valA = a.canDelete ? 1 : 0;
        valB = b.canDelete ? 1 : 0;
      }

      if (valA < valB) return tableSortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return tableSortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [user?.accessibleTables, tableSortConfig]);

  useEffect(() => {
    if (!userId) return;

    const fetchUserDetails = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const res = await fetch(`/api/tenant/users/${userId}`);
        if (!res.ok) {
          throw new Error('Failed to load user details');
        }
        const data = await res.json();
        setUser(data);
      } catch (err: any) {
        console.error('Error fetching user details:', err);
        setError(err.message || 'Error loading details');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserDetails();
  }, [userId]);

  if (!userId) return null;

  const positionsCount = user?.positionSlots?.length || 0;
  const teamsCount = user?.teams?.length || 0;
  const accessibleTablesCount = user?.accessibleTablesCount ?? (user?.accessibleTables?.filter(t => t.isAccessible)?.length || 0);

  return createPortal(
    <div className="klao-user-details-overlay" onClick={onClose}>
      <div className="klao-user-details-modal" onClick={(e) => e.stopPropagation()}>
        {/* 1. Header */}
        <div className="klao-user-details-modal__header">
          <div className="klao-user-details-modal__user-summary">
            <div className="klao-user-details-modal__avatar">
              {user?.avatar ? (
                <img src={user.avatar} alt={user.name || 'User'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                user?.name?.charAt(0) || 'U'
              )}
            </div>
            <div className="klao-user-details-modal__user-info">
              <div className="klao-user-details-modal__name-row">
                <h3 className="klao-user-details-modal__name">{user?.name || 'Loading...'}</h3>
                {user?.role && (
                  <span className="klao-role-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
                    <Shield size={12} />
                    {user.role}
                  </span>
                )}
                {user?.status && (
                  <span className={`klao-status-badge klao-status-badge--${(user.status || 'active').toLowerCase()}`}>
                    <Circle size={6} fill="currentColor" />
                    {user.status}
                  </span>
                )}
              </div>
              <div className="klao-user-details-modal__email">
                <Mail size={14} />
                <span>{user?.email || '—'}</span>
              </div>
            </div>
          </div>

          <div className="klao-user-details-modal__header-actions">
            {user && (
              <button 
                className="klao-btn klao-btn--secondary klao-btn--sm"
                onClick={() => onEdit(user.id)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Edit2 size={14} />
                <span>Edit</span>
              </button>
            )}
            <button className="klao-user-details-modal__close-btn" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* 2. Stats Banner */}
        <div className="klao-user-details-modal__stats-banner">
          <div className="klao-stat-card">
            <div className="klao-stat-card__icon klao-stat-card__icon--position">
              <Award size={20} />
            </div>
            <div className="klao-stat-card__content">
              <span className="klao-stat-card__value">{positionsCount}</span>
              <span className="klao-stat-card__label">Positions</span>
            </div>
          </div>

          <div className="klao-stat-card">
            <div className="klao-stat-card__icon klao-stat-card__icon--team">
              <Users size={20} />
            </div>
            <div className="klao-stat-card__content">
              <span className="klao-stat-card__value">{teamsCount}</span>
              <span className="klao-stat-card__label">Teams</span>
            </div>
          </div>

          <div className="klao-stat-card">
            <div className="klao-stat-card__icon klao-stat-card__icon--tables">
              <Database size={20} />
            </div>
            <div className="klao-stat-card__content">
              <span className="klao-stat-card__value">{accessibleTablesCount}</span>
              <span className="klao-stat-card__label">Data Tables</span>
            </div>
          </div>
        </div>

        {/* 3. Navigation Tabs (Order: 1. User Details, 2. Team, 3. Data Access) */}
        <div className="klao-user-details-modal__tabs">
          <button 
            className={`klao-tab-btn ${activeTab === 'details' ? 'klao-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('details')}
          >
            <User size={16} />
            <span>User Details</span>
          </button>

          <button 
            className={`klao-tab-btn ${activeTab === 'team' ? 'klao-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('team')}
          >
            <Users size={16} />
            <span>Team</span>
            <span className="klao-tab-btn__badge">{teamsCount}</span>
          </button>

          <button 
            className={`klao-tab-btn ${activeTab === 'data_access' ? 'klao-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('data_access')}
          >
            <Database size={16} />
            <span>Data Access</span>
            <span className="klao-tab-btn__badge">{accessibleTablesCount}</span>
          </button>
        </div>

        {/* 4. Tab Body Content */}
        <div className="klao-user-details-modal__body">
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
              <Spinner size={32} />
              <p style={{ marginTop: '16px', color: 'var(--klao-text-muted)', fontSize: '0.9rem' }}>Loading user details...</p>
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--klao-danger, #ef4444)' }}>
              <p>{error}</p>
            </div>
          ) : !user ? null : (
            <>
              {/* TAB 1: USER DETAILS */}
              {activeTab === 'details' && (
                <div className="klao-details-section">
                  {/* General Profile Information */}
                  <div className="klao-details-group">
                    <h4 className="klao-details-group__title">
                      <User size={16} color="var(--klao-primary)" />
                      <span>Identity & Contact</span>
                    </h4>
                    <div className="klao-details-grid">
                      <div className="klao-field-item">
                        <span className="klao-field-item__label">Full Name</span>
                        <span className="klao-field-item__value">{user.name || '—'}</span>
                      </div>
                      <div className="klao-field-item">
                        <span className="klao-field-item__label">Email Address</span>
                        <span className="klao-field-item__value">{user.email || '—'}</span>
                      </div>
                      <div className="klao-field-item">
                        <span className="klao-field-item__label">Phone Number</span>
                        <span className="klao-field-item__value">{user.phone || 'Unspecified'}</span>
                      </div>
                      <div className="klao-field-item">
                        <span className="klao-field-item__label">Job Title</span>
                        <span className="klao-field-item__value">{user.title || 'Unassigned'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Account Governance */}
                  <div className="klao-details-group">
                    <h4 className="klao-details-group__title">
                      <Shield size={16} color="var(--klao-primary)" />
                      <span>Account & System Security</span>
                    </h4>
                    <div className="klao-details-grid">
                      <div className="klao-field-item">
                        <span className="klao-field-item__label">System Role</span>
                        <span className="klao-field-item__value">{user.role}</span>
                      </div>
                      <div className="klao-field-item">
                        <span className="klao-field-item__label">Account Status</span>
                        <span className="klao-field-item__value">{user.status}</span>
                      </div>
                      <div className="klao-field-item">
                        <span className="klao-field-item__label">Last Login Activity</span>
                        <span className="klao-field-item__value">
                          {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never logged in'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Assigned Positions / Slots */}
                  <div className="klao-details-group">
                    <h4 className="klao-details-group__title">
                      <Award size={16} color="var(--klao-primary)" />
                      <span>Assigned Position Slots ({positionsCount})</span>
                    </h4>
                    {positionsCount === 0 ? (
                      <p style={{ margin: 0, color: 'var(--klao-text-muted)', fontSize: '0.88rem' }}>
                        No positions or slots assigned to this user account.
                      </p>
                    ) : (
                      user.positionSlots?.map(slot => (
                        <div key={slot.id} className="klao-position-card">
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                              {slot.position?.name || 'Position'}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--klao-text-muted)' }}>
                              Prefix: {slot.position?.prefix || '—'}
                            </div>
                          </div>
                          <span className="klao-position-card__slot">{slot.id}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: TEAM */}
              {activeTab === 'team' && (
                <div className="klao-details-section">
                  <div className="klao-details-group">
                    <h4 className="klao-details-group__title">
                      <Users size={16} color="var(--klao-primary)" />
                      <span>Team Memberships ({teamsCount})</span>
                    </h4>

                    {teamsCount === 0 ? (
                      <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--klao-text-muted)' }}>
                        <Users size={36} style={{ opacity: 0.5, marginBottom: '8px' }} />
                        <p style={{ margin: 0, fontSize: '0.9rem' }}>User is not a member of any teams yet.</p>
                      </div>
                    ) : (
                      user.teams?.map(tm => (
                        <div key={tm.teamId} className="klao-team-item">
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--klao-text-main)' }}>
                              {tm.team?.name || 'Team'}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--klao-text-muted)' }}>
                              Team ID: {tm.teamId}
                            </div>
                          </div>
                          <div>
                            {tm.isLeader ? (
                              <span style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#059669', padding: '4px 10px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 700 }}>
                                Team Leader
                              </span>
                            ) : (
                              <span style={{ background: 'rgba(100, 116, 139, 0.12)', color: '#475569', padding: '4px 10px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 600 }}>
                                Member
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: DATA ACCESS */}
              {activeTab === 'data_access' && (
                <div className="klao-details-section">
                  <div className="klao-details-group" style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h4 className="klao-details-group__title" style={{ margin: 0 }}>
                        <Database size={16} color="var(--klao-primary)" />
                        <span>Data Table Permissions</span>
                      </h4>
                      <span style={{ fontSize: '0.8rem', color: 'var(--klao-text-muted)', fontWeight: 600 }}>
                        {accessibleTablesCount} of {user.accessibleTables?.length || 0} Tables Accessible
                      </span>
                    </div>

                    {!user.accessibleTables || user.accessibleTables.length === 0 ? (
                      <p style={{ margin: 0, color: 'var(--klao-text-muted)', fontSize: '0.88rem' }}>
                        No data table definitions found in system.
                      </p>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table className="klao-data-access-table">
                          <thead>
                            <tr>
                              <th className="klao-th-sortable" onClick={() => handleTableSort('name')}>
                                <div className="klao-th-content">
                                  <span>Table Name</span>
                                  {getTableSortIcon('name')}
                                </div>
                              </th>
                              <th className="klao-th-sortable" onClick={() => handleTableSort('readScope')}>
                                <div className="klao-th-content">
                                  <span>Read Scope</span>
                                  {getTableSortIcon('readScope')}
                                </div>
                              </th>
                              <th className="klao-th-sortable" onClick={() => handleTableSort('modifyScope')}>
                                <div className="klao-th-content">
                                  <span>Modify Scope</span>
                                  {getTableSortIcon('modifyScope')}
                                </div>
                              </th>
                              <th className="klao-th-sortable" style={{ textAlign: 'center' }} onClick={() => handleTableSort('canCreate')}>
                                <div className="klao-th-content" style={{ justifyContent: 'center' }}>
                                  <span>Create</span>
                                  {getTableSortIcon('canCreate')}
                                </div>
                              </th>
                              <th className="klao-th-sortable" style={{ textAlign: 'center' }} onClick={() => handleTableSort('canDelete')}>
                                <div className="klao-th-content" style={{ justifyContent: 'center' }}>
                                  <span>Delete</span>
                                  {getTableSortIcon('canDelete')}
                                </div>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortedAccessibleTables.map(t => (
                              <tr key={t.id} style={{ opacity: t.isAccessible ? 1 : 0.5 }}>
                                <td>
                                  <div style={{ fontWeight: 600 }}>{t.name}</div>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--klao-text-muted)', fontFamily: 'monospace' }}>
                                    {t.tableName}
                                  </div>
                                </td>
                                <td>
                                  <span className={`klao-scope-badge klao-scope-badge--${(t.readScope || 'none').toLowerCase()}`}>
                                    {t.readScope}
                                  </span>
                                </td>
                                <td>
                                  <span className={`klao-scope-badge klao-scope-badge--${(t.modifyScope || 'none').toLowerCase()}`}>
                                    {t.modifyScope}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  {t.canCreate ? <Check size={16} color="#10b981" /> : <Minus size={16} color="#94a3b8" />}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  {t.canDelete ? <Check size={16} color="#10b981" /> : <Minus size={16} color="#94a3b8" />}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
