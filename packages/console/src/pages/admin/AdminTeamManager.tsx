import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Users, GitBranch, Shield, Database, Plus, Search, 
  Trash2, UserPlus, Check, X, ChevronRight, ChevronDown, MoreHorizontal, AlertCircle 
} from 'lucide-react';
import Spinner from '../../components/common/Spinner';
import { useConsole } from '../../contexts/ConsoleContext';

interface User {
  id: string;
  name: string | null;
  email: string;
  title: string | null;
}

interface TeamMember {
  userId: string;
  teamId: string;
  isLeader: boolean;
  user: User;
}

interface SystemPermission {
  capability: string;
}

interface ObjectPermission {
  objectName: string;
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  viewAllData: boolean;
  modifyAllData: boolean;
}

interface Team {
  id: string;
  name: string;
  parentId: string | null;
  isSystemAdmin: boolean;
  members: TeamMember[];
  systemPermissions: SystemPermission[];
  objectPermissions: ObjectPermission[];
}

export default function AdminTeamManager() {
  const { setHeaderActions } = useConsole();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'members' | 'capabilities' | 'objects'>('members');
  const [tenantUsers, setTenantUsers] = useState<User[]>([]);
  const [allCapabilities, setAllCapabilities] = useState<Record<string, any>>({});
  const [allObjects, setAllObjects] = useState<any[]>([]);

  // Create Team Modal State
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [modalParentTeamId, setModalParentTeamId] = useState<string | null>(null);
  const [isParentSelectOpen, setIsParentSelectOpen] = useState(false);
  const [submittingTeam, setSubmittingTeam] = useState(false);

  // Add Members Modal State & Batch Multi-Select
  const [showAddMembersModal, setShowAddMembersModal] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [selectedUserIdsForAdd, setSelectedUserIdsForAdd] = useState<string[]>([]);
  const [submittingAddMembers, setSubmittingAddMembers] = useState(false);
  const [isTeamActionMenuOpen, setIsTeamActionMenuOpen] = useState(false);
  const actionMenuRef = React.useRef<HTMLDivElement>(null);

  // Click-outside listener for Team Action Menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
        setIsTeamActionMenuOpen(false);
      }
    };
    if (isTeamActionMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isTeamActionMenuOpen]);

  // Themed Confirmation & Notification Modal States
  const [deleteConfirmTeam, setDeleteConfirmTeam] = useState<{ id: string; name: string } | null>(null);
  const [notificationMsg, setNotificationMsg] = useState<{ title: string; message: string; type: 'error' | 'success' } | null>(null);

  // Tree Collapsible State
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [teamsRes, usersRes, capsRes, objsRes] = await Promise.all([
        fetch('/api/tenant/teams'),
        fetch('/api/tenant/users'),
        fetch('/api/console/permissions'),
        fetch('/api/metadata/objects')
      ]);

      if (teamsRes.ok) setTeams(await teamsRes.json());
      if (usersRes.ok) setTenantUsers(await usersRes.json());
      if (capsRes.ok) setAllCapabilities((await capsRes.json()).data || {});
      if (objsRes.ok) setAllObjects(await objsRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const selectedTeam = teams.find(t => t.id === selectedTeamId);

  // Handlers for Teams
  const handleOpenCreateModal = () => {
    setNewTeamName('');
    const targetParent = teams.find(t => t.id === selectedTeamId);
    setModalParentTeamId(targetParent && !targetParent.isSystemAdmin ? targetParent.id : null);
    setIsParentSelectOpen(false);
    setShowCreateTeamModal(true);
  };

  // Mount Header Action Button in Page Header Right area
  useEffect(() => {
    setHeaderActions(
      <button 
        onClick={handleOpenCreateModal}
        className="klao-btn klao-btn--primary"
      >
        <Plus size={16} /> New Team
      </button>
    );
    return () => setHeaderActions(null);
  }, [selectedTeamId, teams]);

  const toggleNode = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const renderTeamTree = (parentId: string | null = null, depth: number = 0) => {
    const children = teams
      .filter(t => (t.parentId || null) === parentId)
      .sort((a, b) => {
        if (a.isSystemAdmin && !b.isSystemAdmin) return -1;
        if (!a.isSystemAdmin && b.isSystemAdmin) return 1;
        return a.name.localeCompare(b.name);
      });

    if (children.length === 0) return null;

    return children.map(team => {
      const hasChildren = teams.some(t => t.parentId === team.id);
      const isExpanded = expandedNodes[team.id] !== false; // Default expanded

      return (
        <div key={team.id} style={{ display: 'flex', flexDirection: 'column' }}>
          <div 
            onClick={() => setSelectedTeamId(team.id)}
            style={{
              padding: '8px 12px',
              paddingLeft: `${12 + depth * 18}px`,
              margin: '2px 0',
              borderRadius: '8px',
              cursor: 'pointer',
              background: selectedTeamId === team.id ? 'var(--klao-bg-hover, rgba(255,255,255,0.08))' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              border: selectedTeamId === team.id ? '1px solid var(--klao-border-color, rgba(255,255,255,0.15))' : '1px solid transparent',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {hasChildren ? (
                <span onClick={(e) => toggleNode(team.id, e)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--klao-text-muted, #64748b)' }}>
                  {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                </span>
              ) : (
                <span style={{ width: '15px', display: 'inline-block' }} />
              )}
              <span style={{ fontWeight: selectedTeamId === team.id ? 600 : 400, fontSize: '0.9rem' }}>{team.name}</span>
            </div>
            {team.isSystemAdmin && <Shield size={14} color="var(--klao-primary)" title="System Admin Team" />}
          </div>

          {hasChildren && isExpanded && renderTeamTree(team.id, depth + 1)}
        </div>
      );
    });
  };

  const getHierarchicalTeamOptions = () => {
    const options: { id: string; name: string; depth: number }[] = [];

    // Exclude System Admin team from business parent hierarchy options
    const businessTeams = teams.filter(t => !t.isSystemAdmin);

    const buildOptions = (parentId: string | null = null, depth: number = 0) => {
      const children = businessTeams
        .filter(t => (t.parentId || null) === parentId)
        .sort((a, b) => a.name.localeCompare(b.name));

      for (const child of children) {
        options.push({ id: child.id, name: child.name, depth });
        buildOptions(child.id, depth + 1);
      }
    };

    buildOptions(null, 0);
    return options;
  };

  const submitCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    setSubmittingTeam(true);
    try {
      const res = await fetch('/api/tenant/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTeamName.trim(), parentId: modalParentTeamId || null })
      });
      if (res.ok) {
        const newTeam = await res.json();
        setTeams([...teams, newTeam]);
        setSelectedTeamId(newTeam.id);
        setShowCreateTeamModal(false);
        setNewTeamName('');
        setModalParentTeamId(null);
      } else {
        const err = await res.json();
        setNotificationMsg({ title: 'Create Team Failed', message: err.error || 'Failed to create team', type: 'error' });
      }
    } catch (e: any) {
      console.error(e);
      setNotificationMsg({ title: 'Create Team Failed', message: e.message || 'An unexpected error occurred', type: 'error' });
    } finally {
      setSubmittingTeam(false);
    }
  };

  const handleDeleteTeamClick = (team: { id: string; name: string }) => {
    setDeleteConfirmTeam(team);
  };

  const executeDeleteTeam = async (id: string) => {
    setDeleteConfirmTeam(null);
    try {
      const res = await fetch(`/api/tenant/teams/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setTeams(teams.filter(t => t.id !== id));
        if (selectedTeamId === id) setSelectedTeamId(null);
      } else {
        const err = await res.json();
        setNotificationMsg({ title: 'Delete Team Failed', message: err.error || 'Failed to delete team', type: 'error' });
      }
    } catch (e: any) {
      console.error(e);
      setNotificationMsg({ title: 'Delete Team Failed', message: e.message || 'An unexpected error occurred', type: 'error' });
    }
  };

  // Handlers for Members
  const handleOpenAddMembersModal = () => {
    setMemberSearchQuery('');
    setSelectedUserIdsForAdd([]);
    setIsTeamActionMenuOpen(false);
    setShowAddMembersModal(true);
  };

  const handleToggleUserSelection = (userId: string) => {
    setSelectedUserIdsForAdd(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleSelectAllUsers = (availableUsers: User[]) => {
    if (selectedUserIdsForAdd.length === availableUsers.length) {
      setSelectedUserIdsForAdd([]);
    } else {
      setSelectedUserIdsForAdd(availableUsers.map(u => u.id));
    }
  };

  const submitBatchAddMembers = async () => {
    if (!selectedTeamId || selectedUserIdsForAdd.length === 0) return;
    setSubmittingAddMembers(true);
    try {
      const res = await fetch(`/api/tenant/teams/${selectedTeamId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: selectedUserIdsForAdd })
      });
      if (res.ok) {
        setShowAddMembersModal(false);
        setSelectedUserIdsForAdd([]);
        setMemberSearchQuery('');
        fetchInitialData();
      } else {
        const err = await res.json();
        setNotificationMsg({ title: 'Add Members Failed', message: err.error || 'Failed to add members', type: 'error' });
      }
    } catch (e: any) {
      console.error(e);
      setNotificationMsg({ title: 'Add Members Failed', message: e.message || 'An unexpected error occurred', type: 'error' });
    } finally {
      setSubmittingAddMembers(false);
    }
  };

  const handleToggleLeader = async (userId: string, currentLeaderState: boolean) => {
    if (!selectedTeamId) return;
    try {
      const res = await fetch(`/api/tenant/teams/${selectedTeamId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, isLeader: !currentLeaderState })
      });
      if (res.ok) {
        fetchInitialData();
      } else {
        const err = await res.json();
        setNotificationMsg({ title: 'Update Role Failed', message: err.error || 'Failed to update team leader role', type: 'error' });
      }
    } catch (e: any) {
      console.error(e);
      setNotificationMsg({ title: 'Update Role Failed', message: e.message || 'An unexpected error occurred', type: 'error' });
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedTeamId) return;
    const res = await fetch(`/api/tenant/teams/${selectedTeamId}/members/${userId}`, {
      method: 'DELETE'
    });
    if (res.ok) fetchInitialData();
  };

  // Handlers for System Capabilities
  const handleToggleCapability = async (capability: string, hasCap: boolean) => {
    if (!selectedTeamId) return;
    const method = hasCap ? 'DELETE' : 'POST';
    const res = await fetch('/api/console/permissions', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId: selectedTeamId, capability })
    });
    if (res.ok) fetchInitialData();
  };

  // Handlers for Object Permissions
  const handleUpdateObjectPerm = async (objectName: string, field: string, value: boolean) => {
    if (!selectedTeam) return;
    const existing = selectedTeam.objectPermissions.find(o => o.objectName === objectName) || {
      canCreate: false, canRead: false, canUpdate: false, canDelete: false, viewAllData: false, modifyAllData: false
    };
    
    const payload = {
      objectName,
      ...existing,
      [field]: value
    };

    const res = await fetch(`/api/tenant/teams/${selectedTeamId}/object-permissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) fetchInitialData();
  };

  if (loading) return <Spinner />;

  return (
    <div style={{ display: 'flex', height: '100%', gap: 'var(--klao-spacing-md)' }}>
      {/* LEFT PANE: Team Tree */}
      <div className="klao-card" style={{ width: '300px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', paddingBottom: '10px', borderBottom: '1px solid var(--klao-border-color, rgba(255,255,255,0.1))' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <GitBranch size={18} /> Team Hierarchy
          </h3>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {renderTeamTree(null, 0)}
          {teams.length === 0 && <p style={{ color: 'var(--klao-text-muted)', fontSize: '0.85rem' }}>No teams found.</p>}
        </div>
      </div>

      {/* RIGHT PANE: Team Details */}
      <div className="klao-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!selectedTeam ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--klao-text-muted)' }}>
            Select a team from the sidebar to view details.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--klao-border-color)', paddingBottom: '15px', marginBottom: '15px' }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem' }}>{selectedTeam.name}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div 
                  ref={actionMenuRef}
                  className="klao-user-manager__action-wrapper" 
                  style={{ position: 'relative' }}
                >
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsTeamActionMenuOpen(!isTeamActionMenuOpen);
                    }}
                    className={`klao-btn klao-btn--secondary ${isTeamActionMenuOpen ? 'active' : ''}`}
                    style={{ padding: '6px 10px' }}
                    title="Team Options"
                  >
                    <MoreHorizontal size={16} />
                  </button>

                  {isTeamActionMenuOpen && (
                    <div 
                      className="klao-user-manager__context-menu"
                      style={{ position: 'absolute', top: '100%', right: 0, marginTop: '4px', width: '170px', zIndex: 100 }}
                    >
                      <button 
                        className="klao-context-item"
                        onClick={() => {
                          setIsTeamActionMenuOpen(false);
                          handleOpenAddMembersModal();
                        }}
                      >
                        <UserPlus size={14} />
                        <span>Add Member</span>
                      </button>

                      {!selectedTeam.isSystemAdmin && (
                        <button 
                          className="klao-context-item klao-context-item--danger"
                          onClick={() => {
                            setIsTeamActionMenuOpen(false);
                            handleDeleteTeamClick({ id: selectedTeam.id, name: selectedTeam.name });
                          }}
                        >
                          <Trash2 size={14} />
                          <span>Delete Team</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* TABS */}
            <div style={{ display: 'flex', gap: '20px', borderBottom: '1px solid var(--klao-border-color)', marginBottom: '15px' }}>
              <TabBtn active={activeTab === 'members'} onClick={() => setActiveTab('members')} icon={<Users size={16} />} label="Members" />
              <TabBtn active={activeTab === 'capabilities'} onClick={() => setActiveTab('capabilities')} icon={<Shield size={16} />} label="System Capabilities" />
              <TabBtn active={activeTab === 'objects'} onClick={() => setActiveTab('objects')} icon={<Database size={16} />} label="Data Access" />
            </div>

            {/* TAB CONTENT */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              
              {/* MEMBERS TAB */}
              {activeTab === 'members' && (
                <div>
                  <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--klao-border-color)' }}>
                        <th style={{ padding: '10px' }}>Name</th>
                        <th style={{ padding: '10px' }}>Email</th>
                        <th style={{ padding: '10px' }}>Role</th>
                        <th style={{ padding: '10px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedTeam.members.map(m => (
                        <tr key={m.userId} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '10px' }}>{m.user.name || '-'}</td>
                          <td style={{ padding: '10px', color: 'var(--klao-text-muted)' }}>{m.user.email}</td>
                          <td style={{ padding: '10px' }}>
                            <button
                              onClick={() => handleToggleLeader(m.userId, m.isLeader)}
                              className={`klao-btn ${m.isLeader ? 'klao-btn--primary' : 'klao-btn--secondary'}`}
                              style={{
                                fontSize: '0.78rem',
                                padding: '4px 12px',
                                borderRadius: '20px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                              title={m.isLeader ? "Click to demote to regular Member" : "Click to promote to Team Leader"}
                            >
                              {m.isLeader ? (
                                <>
                                  <Shield size={13} /> Team Leader
                                </>
                              ) : (
                                'Member'
                              )}
                            </button>
                          </td>
                          <td style={{ padding: '10px', textAlign: 'right' }}>
                            <button onClick={() => handleRemoveMember(m.userId)} style={{ background: 'none', border: 'none', color: 'var(--klao-error-color)', cursor: 'pointer' }}>
                              <X size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {selectedTeam.members.length === 0 && (
                        <tr><td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: 'var(--klao-text-muted)' }}>No members found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* SYSTEM CAPABILITIES TAB */}
              {activeTab === 'capabilities' && (
                <div>
                  {selectedTeam.isSystemAdmin ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--klao-text-muted)' }}>
                      System Admin team implicitly has all capabilities.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                      {Object.keys(allCapabilities).map(cap => {
                        const hasCap = selectedTeam.systemPermissions.some(p => p.capability === cap);
                        return (
                          <div key={cap} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--klao-border-color)' }}>
                            <input 
                              type="checkbox" 
                              className="klao-checkbox"
                              checked={hasCap} 
                              onChange={() => handleToggleCapability(cap, hasCap)}
                              style={{ marginTop: '5px' }}
                            />
                            <div>
                              <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{allCapabilities[cap].label}</div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--klao-text-muted)' }}>{cap}</div>
                              <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>{allCapabilities[cap].description}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* OBJECT PERMISSIONS TAB */}
              {activeTab === 'objects' && (
                <div>
                  {selectedTeam.isSystemAdmin ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--klao-text-muted)' }}>
                      System Admin team implicitly has full data access.
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', textAlign: 'center', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--klao-border-color)' }}>
                            <th style={{ padding: '10px', textAlign: 'left' }}>Object</th>
                            <th style={{ padding: '10px' }}>Read</th>
                            <th style={{ padding: '10px' }}>Create</th>
                            <th style={{ padding: '10px' }}>Update</th>
                            <th style={{ padding: '10px' }}>Delete</th>
                            <th style={{ padding: '10px' }}>View All</th>
                            <th style={{ padding: '10px' }}>Modify All</th>
                          </tr>
                        </thead>
                        <tbody>
                          {allObjects.map(obj => {
                            const perm = selectedTeam.objectPermissions.find(p => p.objectName === obj.tableName) || {} as ObjectPermission;
                            return (
                              <tr key={obj.tableName} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>{obj.name}</td>
                                <td style={{ padding: '10px' }}><input type="checkbox" className="klao-checkbox" checked={!!perm.canRead} onChange={e => handleUpdateObjectPerm(obj.tableName, 'canRead', e.target.checked)} /></td>
                                <td style={{ padding: '10px' }}><input type="checkbox" className="klao-checkbox" checked={!!perm.canCreate} onChange={e => handleUpdateObjectPerm(obj.tableName, 'canCreate', e.target.checked)} /></td>
                                <td style={{ padding: '10px' }}><input type="checkbox" className="klao-checkbox" checked={!!perm.canUpdate} onChange={e => handleUpdateObjectPerm(obj.tableName, 'canUpdate', e.target.checked)} /></td>
                                <td style={{ padding: '10px' }}><input type="checkbox" className="klao-checkbox" checked={!!perm.canDelete} onChange={e => handleUpdateObjectPerm(obj.tableName, 'canDelete', e.target.checked)} /></td>
                                <td style={{ padding: '10px' }}><input type="checkbox" className="klao-checkbox" checked={!!perm.viewAllData} onChange={e => handleUpdateObjectPerm(obj.tableName, 'viewAllData', e.target.checked)} /></td>
                                <td style={{ padding: '10px' }}><input type="checkbox" className="klao-checkbox" checked={!!perm.modifyAllData} onChange={e => handleUpdateObjectPerm(obj.tableName, 'modifyAllData', e.target.checked)} /></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* CREATE TEAM MODAL (Standard Platform Theme) */}
      {showCreateTeamModal && createPortal(
        <div className="klao-modal-overlay">
          <div className="klao-card" style={{ width: '460px', padding: '28px', borderRadius: 'var(--klao-radius-lg, 20px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <GitBranch size={20} color="var(--klao-primary)" />
                Create New Team
              </h3>
              <button 
                onClick={() => setShowCreateTeamModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--klao-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="klao-form-group" style={{ marginBottom: '20px' }}>
              <label className="klao-label" style={{ display: 'block', marginBottom: '8px' }}>
                Team Name
              </label>
              <input 
                type="text" 
                placeholder="e.g. Sales Department, Product Engineering..."
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') submitCreateTeam(); }}
              />
            </div>

            <div className="klao-form-group" style={{ marginBottom: '24px', position: 'relative' }}>
              <label className="klao-label" style={{ display: 'block', marginBottom: '8px' }}>
                Parent Team (Optional)
              </label>
              <button
                type="button"
                onClick={() => setIsParentSelectOpen(!isParentSelectOpen)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'var(--klao-bg-card, rgba(255,255,255,0.05))',
                  border: '1px solid var(--klao-border-color, rgba(255,255,255,0.15))',
                  borderRadius: 'var(--klao-radius-md, 10px)',
                  color: 'var(--klao-text-main, inherit)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  textAlign: 'left'
                }}
              >
                <span>
                  {teams.find(t => t.id === modalParentTeamId)?.name || 'None (Top-Level Team)'}
                </span>
                <ChevronDown size={16} style={{ color: 'var(--klao-text-muted)', transform: isParentSelectOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>

              {isParentSelectOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '6px',
                    maxHeight: '220px',
                    overflowY: 'auto',
                    background: 'var(--klao-bg-card, rgba(30, 41, 59, 0.95))',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    border: '1px solid var(--klao-border-color, rgba(255, 255, 255, 0.15))',
                    borderRadius: 'var(--klao-radius-md, 12px)',
                    boxShadow: 'var(--klao-shadow-lg, 0 10px 25px rgba(0,0,0,0.3))',
                    zIndex: 100,
                    padding: '6px'
                  }}
                >
                  <div
                    onClick={() => {
                      setModalParentTeamId(null);
                      setIsParentSelectOpen(false);
                    }}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      background: modalParentTeamId === null ? 'var(--klao-bg-hover, rgba(255,255,255,0.08))' : 'transparent',
                      color: modalParentTeamId === null ? 'var(--klao-primary, #3b82f6)' : 'inherit',
                      fontWeight: modalParentTeamId === null ? 600 : 400,
                      fontSize: '0.88rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '2px'
                    }}
                  >
                    <span>None (Top-Level Team)</span>
                    {modalParentTeamId === null && <Check size={14} />}
                  </div>

                  {getHierarchicalTeamOptions().map(opt => {
                    const isSelected = modalParentTeamId === opt.id;
                    return (
                      <div
                        key={opt.id}
                        onClick={() => {
                          setModalParentTeamId(opt.id);
                          setIsParentSelectOpen(false);
                        }}
                        style={{
                          padding: '8px 12px',
                          paddingLeft: `${12 + opt.depth * 16}px`,
                          borderRadius: '6px',
                          cursor: 'pointer',
                          background: isSelected ? 'var(--klao-bg-hover, rgba(255,255,255,0.08))' : 'transparent',
                          color: isSelected ? 'var(--klao-primary, #3b82f6)' : 'inherit',
                          fontWeight: isSelected ? 600 : 400,
                          fontSize: '0.88rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          margin: '2px 0'
                        }}
                      >
                        <span>{opt.depth > 0 ? '└─ ' : ''}{opt.name}</span>
                        {isSelected && <Check size={14} />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button 
                className="klao-btn klao-btn--secondary"
                onClick={() => setShowCreateTeamModal(false)}
              >
                Cancel
              </button>
              <button 
                className="klao-btn klao-btn--primary"
                onClick={submitCreateTeam}
                disabled={!newTeamName.trim() || submittingTeam}
              >
                {submittingTeam ? 'Creating...' : 'Create Team'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* SEARCHABLE MULTI-SELECT ADD MEMBERS MODAL */}
      {showAddMembersModal && selectedTeam && createPortal(
        <div className="klao-modal-overlay">
          <div className="klao-card" style={{ width: '520px', padding: '28px', borderRadius: 'var(--klao-radius-lg, 20px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <UserPlus size={20} color="var(--klao-primary)" />
                Add Members to {selectedTeam.name}
              </h3>
              <button 
                onClick={() => setShowAddMembersModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--klao-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* SEARCH BOX */}
            <div className="klao-form-group" style={{ marginBottom: '16px', position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--klao-text-muted)' }} />
              <input 
                type="text"
                className="klao-input"
                style={{ paddingLeft: '38px', width: '100%' }}
                placeholder="Search by user name, email, or title..."
                value={memberSearchQuery}
                onChange={(e) => setMemberSearchQuery(e.target.value)}
                autoFocus
              />
            </div>

            {/* USERS LIST WITH MULTI SELECT */}
            {(() => {
              const availableUsers = tenantUsers
                .filter(u => !selectedTeam.members.some(m => m.userId === u.id))
                .filter(u => {
                  if (!memberSearchQuery.trim()) return true;
                  const q = memberSearchQuery.toLowerCase();
                  return (
                    (u.name && u.name.toLowerCase().includes(q)) ||
                    u.email.toLowerCase().includes(q) ||
                    (u.title && u.title.toLowerCase().includes(q))
                  );
                });

              const allSelected = availableUsers.length > 0 && selectedUserIdsForAdd.length === availableUsers.length;

              return (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', padding: '0 4px', fontSize: '0.85rem', color: 'var(--klao-text-muted)' }}>
                    <span>Available Users ({availableUsers.length})</span>
                    {availableUsers.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleSelectAllUsers(availableUsers)}
                        style={{ background: 'none', border: 'none', color: 'var(--klao-primary)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}
                      >
                        {allSelected ? 'Deselect All' : 'Select All'}
                      </button>
                    )}
                  </div>

                  <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid var(--klao-border-color)', borderRadius: '12px', padding: '6px', background: 'var(--klao-bg-hover, rgba(0,0,0,0.02))' }}>
                    {availableUsers.map(u => {
                      const isChecked = selectedUserIdsForAdd.includes(u.id);
                      return (
                        <div
                          key={u.id}
                          onClick={() => handleToggleUserSelection(u.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            background: isChecked ? 'var(--klao-bg-hover, rgba(255,255,255,0.08))' : 'transparent',
                            transition: 'background 0.15s ease',
                            margin: '2px 0'
                          }}
                        >
                          <input 
                            type="checkbox"
                            className="klao-checkbox"
                            checked={isChecked}
                            onChange={() => {}} // Handled by div click
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--klao-text-main)' }}>{u.name || 'Unnamed User'}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--klao-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</div>
                          </div>
                          {u.title && (
                            <span style={{ fontSize: '0.75rem', background: 'var(--klao-bg-hover)', padding: '2px 8px', borderRadius: '10px', color: 'var(--klao-text-muted)' }}>
                              {u.title}
                            </span>
                          )}
                        </div>
                      );
                    })}

                    {availableUsers.length === 0 && (
                      <div style={{ padding: '30px', textAlign: 'center', color: 'var(--klao-text-muted)', fontSize: '0.85rem' }}>
                        {memberSearchQuery ? 'No users matching your search.' : 'All users are already in this team.'}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button 
                className="klao-btn klao-btn--secondary"
                onClick={() => setShowAddMembersModal(false)}
              >
                Cancel
              </button>
              <button 
                className="klao-btn klao-btn--primary"
                onClick={submitBatchAddMembers}
                disabled={selectedUserIdsForAdd.length === 0 || submittingAddMembers}
              >
                {submittingAddMembers ? 'Saving...' : `Save (${selectedUserIdsForAdd.length} Selected)`}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* THEMED DELETE TEAM CONFIRMATION MODAL */}
      {deleteConfirmTeam && createPortal(
        <div className="klao-modal-overlay">
          <div className="klao-card" style={{ width: '440px', padding: '28px', borderRadius: 'var(--klao-radius-lg, 20px)' }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div style={{
                background: 'rgba(239, 68, 68, 0.12)',
                color: 'var(--klao-danger, #ef4444)',
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
                <h3 style={{ margin: '0 0 6px 0', fontSize: '1.2rem', fontWeight: 600, color: 'var(--klao-text-main)' }}>
                  Delete Team
                </h3>
                <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--klao-text-muted)', lineHeight: 1.5 }}>
                  Are you sure you want to delete the team <strong>"{deleteConfirmTeam.name}"</strong>? All associated user memberships and permissions for this team will be removed.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button 
                className="klao-btn klao-btn--secondary"
                onClick={() => setDeleteConfirmTeam(null)}
              >
                Cancel
              </button>
              <button 
                className="klao-btn klao-btn--danger"
                onClick={() => executeDeleteTeam(deleteConfirmTeam.id)}
              >
                Delete Team
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* THEMED NOTIFICATION / ERROR MODAL */}
      {notificationMsg && createPortal(
        <div className="klao-modal-overlay">
          <div className="klao-card" style={{ width: '400px', padding: '28px', borderRadius: 'var(--klao-radius-lg, 20px)', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', color: notificationMsg.type === 'error' ? 'var(--klao-danger, #ef4444)' : 'var(--klao-primary)' }}>
              {notificationMsg.type === 'error' ? <AlertCircle size={44} /> : <Check size={44} />}
            </div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.15rem', fontWeight: 600 }}>{notificationMsg.title}</h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--klao-text-muted)', margin: '0 0 20px 0', lineHeight: 1.5 }}>
              {notificationMsg.message}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button 
                className="klao-btn klao-btn--primary"
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
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <div 
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '10px 15px', cursor: 'pointer',
        borderBottom: active ? '2px solid var(--klao-primary)' : '2px solid transparent',
        color: active ? 'var(--klao-primary)' : 'var(--klao-text-muted)',
        fontWeight: active ? 'bold' : 'normal',
        transition: 'all 0.2s'
      }}
    >
      {icon} {label}
    </div>
  );
}
