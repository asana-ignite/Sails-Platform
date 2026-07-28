import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Users, GitBranch, Shield, Database, Plus, Search, 
  Trash2, UserPlus, Check, X, ChevronRight, ChevronDown, MoreHorizontal, AlertCircle, Award, Sliders, Save 
} from 'lucide-react';
import Spinner from '../../components/common/Spinner';
import { useConsole } from '../../contexts/ConsoleContext';
import { CustomSelect } from '../../components/common/CustomSelect';

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

interface PositionSlot {
  id: string;
  userId: string | null;
  user?: {
    name: string | null;
    email: string;
  } | null;
}

interface Position {
  id: string;
  name: string;
  prefix: string;
  description: string | null;
  headCount: number;
  slots?: PositionSlot[];
}

interface TeamPosition {
  teamId: string;
  positionId: string;
  position: Position;
}

interface SystemPermission {
  capability: string;
}

interface ObjectPermission {
  id?: string;
  objectName: string;
  canCreate: boolean;
  canDelete: boolean;
  readScope: 'NONE' | 'OWNER' | 'TEAM' | 'HIERARCHY' | 'ALL';
  modifyScope: 'NONE' | 'OWNER' | 'TEAM' | 'HIERARCHY' | 'ALL';
}

interface Team {
  id: string;
  name: string;
  parentId: string | null;
  isSystemAdmin: boolean;
  members: TeamMember[];
  positions?: TeamPosition[];
  systemPermissions: SystemPermission[];
  objectPermissions: ObjectPermission[];
}

function ContextMenuPortal({ anchorEl, onClose, children }: { anchorEl: HTMLElement | null; onClose: () => void; children: React.ReactNode }) {
  if (!anchorEl) return null;
  const rect = anchorEl.getBoundingClientRect();
  const top = rect.bottom + 4;
  const left = Math.max(10, rect.right - 180);

  return createPortal(
    <div
      className="sails-user-manager__context-menu"
      style={{
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        width: '180px',
        zIndex: 10000,
        boxShadow: 'var(--sails-shadow-lg, 0 10px 25px -5px rgba(0,0,0,0.25))'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body
  );
}

interface ManageDataAccessModalProps {
  targetType: 'user' | 'position';
  targetId: string;
  targetName: string;
  allObjects: any[];
  onClose: () => void;
  onSaveSuccess?: () => void;
}

function ManageDataAccessModal({ targetType, targetId, targetName, allObjects, onClose, onSaveSuccess }: ManageDataAccessModalProps) {
  const [permissions, setPermissions] = useState<ObjectPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchPermissions();
  }, [targetId, targetType]);

  const fetchPermissions = async () => {
    setLoading(true);
    try {
      const endpoint = targetType === 'user' 
        ? `/api/tenant/users/${targetId}/object-permissions`
        : `/api/tenant/positions/${targetId}/object-permissions`;
      const res = await fetch(endpoint);
      if (res.ok) {
        const fetched: ObjectPermission[] = await res.json();
        const initialPerms: ObjectPermission[] = allObjects.map(obj => {
          const objApiName = obj.tableName || obj.apiName || obj.name;
          const existing = fetched.find(p => p.objectName === objApiName);
          return existing || {
            objectName: objApiName,
            canCreate: false,
            canDelete: false,
            readScope: 'NONE' as const,
            modifyScope: 'NONE' as const
          };
        });
        setPermissions(initialPerms);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePermDraft = (objectName: string, updates: Partial<ObjectPermission>) => {
    setPermissions(prev => {
      const existing = prev.find(p => p.objectName === objectName) || {
        objectName,
        canCreate: false,
        canDelete: false,
        readScope: 'NONE',
        modifyScope: 'NONE'
      };

      const updated = { ...existing, ...updates };
      return [...prev.filter(p => p.objectName !== objectName), updated as ObjectPermission];
    });
  };

  const handleSaveChanges = async () => {
    setSaving(true);
    try {
      const endpoint = targetType === 'user' 
        ? `/api/tenant/users/${targetId}/object-permissions`
        : `/api/tenant/positions/${targetId}/object-permissions`;
      
      for (const perm of permissions) {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            objectName: perm.objectName,
            canCreate: perm.canCreate,
            canDelete: perm.canDelete,
            readScope: perm.readScope,
            modifyScope: perm.modifyScope
          })
        });
        if (!res.ok) {
          const errJson = await res.json();
          throw new Error(errJson.error || 'Failed to save individual object permission');
        }
      }

      if (onSaveSuccess) onSaveSuccess();
      onClose();
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Failed to save data access permissions.');
    } finally {
      setSaving(false);
    }
  };

  const filteredObjects = allObjects.filter(obj => {
    const name = (obj.name || obj.displayName || obj.tableName || '').toLowerCase();
    const apiName = (obj.tableName || obj.apiName || obj.name || '').toLowerCase();
    return name.includes(searchQuery.toLowerCase()) || apiName.includes(searchQuery.toLowerCase());
  });

  return createPortal(
    <div className="sails-modal-overlay" style={{ zIndex: 10000, justifyContent: 'center', alignItems: 'center' }}>
      <div
        className="sails-card"
        style={{
          width: '840px',
          maxHeight: '85vh',
          borderRadius: '20px',
          padding: '24px 28px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--sails-shadow-lg)',
          animation: 'sails-modal-slide-up 0.2s ease-out'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', paddingBottom: '14px', borderBottom: '1px solid var(--sails-border-color)' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--sails-text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={18} color="var(--sails-primary)" />
              Manage Data Access — {targetName}
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.825rem', color: 'var(--sails-text-muted)' }}>
              Configure granular visibility and modify scopes for {targetType === 'user' ? 'Member' : 'Position'}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--sails-text-muted)', cursor: 'pointer', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ position: 'relative', marginBottom: '12px', maxWidth: '300px' }}>
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sails-text-muted)' }} />
          <input
            type="text"
            className="sails-input"
            style={{ width: '100%', paddingLeft: '34px', fontSize: '0.85rem' }}
            placeholder="Search data object..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '16px' }}>
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center' }}><Spinner /></div>
          ) : (
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--sails-border-color)' }}>
                  <th style={{ padding: '10px', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--sails-text-muted)' }}>OBJECT</th>
                  <th style={{ padding: '10px', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--sails-text-muted)', textAlign: 'center' }}>CREATE</th>
                  <th style={{ padding: '10px', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--sails-text-muted)', minWidth: '240px' }}>VISIBILITY SCOPE</th>
                  <th style={{ padding: '10px', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--sails-text-muted)', minWidth: '240px' }}>MODIFY SCOPE</th>
                  <th style={{ padding: '10px', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--sails-text-muted)', textAlign: 'center' }}>DELETE</th>
                </tr>
              </thead>
              <tbody>
                {filteredObjects.map((obj) => {
                  const objApiName = obj.tableName || obj.apiName || obj.name;
                  const objDisplayName = obj.name || obj.displayName || obj.tableName;

                  const perm = permissions.find((p) => p.objectName === objApiName) || {
                    objectName: objApiName,
                    canCreate: false,
                    canDelete: false,
                    readScope: 'NONE',
                    modifyScope: 'NONE'
                  };

                  return (
                    <tr key={objApiName} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '10px' }}>{objDisplayName}</td>
                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          className="sails-checkbox"
                          checked={perm.canCreate}
                          onChange={(e) => handleUpdatePermDraft(objApiName, { canCreate: e.target.checked })}
                        />
                      </td>
                      <td style={{ padding: '10px' }}>
                        <CustomSelect
                          size="sm"
                          style={{ width: '100%' }}
                          value={perm.readScope || 'NONE'}
                          options={[
                            { value: 'NONE', label: '-- None --' },
                            { value: 'OWNER', label: 'Owner' },
                            { value: 'ALL', label: 'View All' },
                            { value: 'HIERARCHY', label: 'View Hierarchy' }
                          ]}
                          onChange={(val) => handleUpdatePermDraft(objApiName, { readScope: String(val) as any })}
                        />
                      </td>
                      <td style={{ padding: '10px' }}>
                        <CustomSelect
                          size="sm"
                          style={{ width: '100%' }}
                          value={perm.modifyScope || 'NONE'}
                          options={[
                            { value: 'NONE', label: '-- None --' },
                            { value: 'OWNER', label: 'Owner' },
                            { value: 'ALL', label: 'Modify All' },
                            { value: 'HIERARCHY', label: 'Modify Hierarchy' }
                          ]}
                          onChange={(val) => handleUpdatePermDraft(objApiName, { modifyScope: String(val) as any })}
                        />
                      </td>
                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          className="sails-checkbox"
                          checked={perm.canDelete}
                          onChange={(e) => handleUpdatePermDraft(objApiName, { canDelete: e.target.checked })}
                        />
                      </td>
                    </tr>
                  );
                })}
                {allObjects.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: '30px', textAlign: 'center', color: 'var(--sails-text-muted)' }}>No data models defined in system.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ paddingTop: '14px', borderTop: '1px solid var(--sails-border-color)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button className="sails-btn sails-btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="sails-btn sails-btn--primary" onClick={handleSaveChanges} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function AdminTeamManager() {
  const { setHeaderActions } = useConsole();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'members' | 'positions' | 'capabilities' | 'objects'>('members');
  const [tenantUsers, setTenantUsers] = useState<User[]>([]);
  const [tenantPositions, setTenantPositions] = useState<Position[]>([]);
  const [allCapabilities, setAllCapabilities] = useState<Record<string, any>>({});
  const [allObjects, setAllObjects] = useState<any[]>([]);
  const [teamObjectSearchQuery, setTeamObjectSearchQuery] = useState('');

  // Group permissions registry by category cleanly
  const capabilityCategories = React.useMemo(() => {
    const categories: Record<string, Array<{ code: string; label: string; description: string }>> = {};
    if (allCapabilities && typeof allCapabilities === 'object') {
      Object.entries(allCapabilities).forEach(([code, def]: [string, any]) => {
        const cat = def?.category || 'General';
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push({
          code,
          label: def?.label || code,
          description: def?.description || '',
        });
      });
    }
    return categories;
  }, [allCapabilities]);

  // Draft Team Object Permissions State
  const [teamObjectPermsDraft, setTeamObjectPermsDraft] = useState<ObjectPermission[]>([]);
  const [savingTeamObjectPerms, setSavingTeamObjectPerms] = useState(false);

  const selectedTeam = teams.find(t => t.id === selectedTeamId);

  // Sync draft team object permissions when selected team updates
  useEffect(() => {
    if (selectedTeam && allObjects.length > 0) {
      const initialPerms: ObjectPermission[] = allObjects.map(obj => {
        const objApiName = obj.tableName || obj.apiName || obj.name;
        const existing = (selectedTeam.objectPermissions || []).find(p => p.objectName === objApiName);
        return existing || {
          objectName: objApiName,
          canCreate: false,
          canDelete: false,
          readScope: 'NONE' as const,
          modifyScope: 'NONE' as const
        };
      });
      setTeamObjectPermsDraft(initialPerms);
    }
  }, [selectedTeamId, teams, allObjects]);

  // Portaled Context Menu Anchors
  const [activeMemberAnchor, setActiveMemberAnchor] = useState<{ id: string; el: HTMLElement } | null>(null);
  const [activePositionAnchor, setActivePositionAnchor] = useState<{ id: string; el: HTMLElement } | null>(null);

  // Manage Data Access Modal State
  const [manageModalState, setManageModalState] = useState<{
    targetType: 'user' | 'position';
    targetId: string;
    targetName: string;
  } | null>(null);

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

  // Add Positions Modal State & Multi-Select
  const [showAddPositionsModal, setShowAddPositionsModal] = useState(false);
  const [positionSearchQuery, setPositionSearchQuery] = useState('');
  const [selectedPositionIdsForAdd, setSelectedPositionIdsForAdd] = useState<string[]>([]);
  const [submittingAddPositions, setSubmittingAddPositions] = useState(false);

  const [isTeamActionMenuOpen, setIsTeamActionMenuOpen] = useState(false);
  const actionMenuRef = React.useRef<HTMLDivElement>(null);

  // Click-outside listener for Team Action Menu & Row Context Menus
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
        setIsTeamActionMenuOpen(false);
      }
      setActiveMemberAnchor(null);
      setActivePositionAnchor(null);
    };
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

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
      const [teamsRes, usersRes, capsRes, objsRes, positionsRes] = await Promise.all([
        fetch('/api/tenant/teams'),
        fetch('/api/tenant/users'),
        fetch('/api/console/permissions'),
        fetch('/api/metadata/objects'),
        fetch('/api/tenant/positions')
      ]);

      if (teamsRes.ok) setTeams(await teamsRes.json());
      if (usersRes.ok) setTenantUsers(await usersRes.json());
      if (capsRes.ok) setAllCapabilities((await capsRes.json()).data || {});
      if (objsRes.ok) setAllObjects(await objsRes.json());
      if (positionsRes.ok) setTenantPositions(await positionsRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

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
        className="sails-btn sails-btn--primary"
      >
        <Plus size={16} /> New Team
      </button>
    );
    return () => setHeaderActions(null);
  }, [setHeaderActions, selectedTeamId, teams]);

  const handleCreateTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    setSubmittingTeam(true);
    try {
      const res = await fetch('/api/tenant/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTeamName.trim(),
          parentId: modalParentTeamId
        })
      });

      if (res.ok) {
        const createdTeam = await res.json();
        setShowCreateTeamModal(false);
        setNewTeamName('');
        setModalParentTeamId(null);
        await fetchInitialData();
        setSelectedTeamId(createdTeam.id);
        if (createdTeam.parentId) {
          setExpandedNodes(prev => ({ ...prev, [createdTeam.parentId]: true }));
        }
      } else {
        const errData = await res.json();
        setNotificationMsg({
          title: 'Create Team Failed',
          message: errData.error || 'Failed to create team.',
          type: 'error'
        });
      }
    } catch (e: any) {
      console.error(e);
      setNotificationMsg({
        title: 'Error',
        message: e.message || 'An unexpected error occurred.',
        type: 'error'
      });
    } finally {
      setSubmittingTeam(false);
    }
  };

  const handleDeleteTeamClick = (team: { id: string; name: string }) => {
    setDeleteConfirmTeam(team);
  };

  const executeDeleteTeam = async (id: string) => {
    try {
      const res = await fetch(`/api/tenant/teams/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (selectedTeamId === id) setSelectedTeamId(null);
        setDeleteConfirmTeam(null);
        fetchInitialData();
      } else {
        const errData = await res.json();
        setDeleteConfirmTeam(null);
        setNotificationMsg({
          title: 'Delete Failed',
          message: errData.error || 'Failed to delete team.',
          type: 'error'
        });
      }
    } catch (e: any) {
      setDeleteConfirmTeam(null);
      setNotificationMsg({
        title: 'Error',
        message: e.message || 'An unexpected error occurred.',
        type: 'error'
      });
    }
  };

  // Handlers for Members
  const handleOpenAddMembersModal = () => {
    setSelectedUserIdsForAdd([]);
    setMemberSearchQuery('');
    setShowAddMembersModal(true);
  };

  const handleToggleUserSelection = (userId: string) => {
    setSelectedUserIdsForAdd(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleAddMembersSubmit = async () => {
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
        fetchInitialData();
      } else {
        const errData = await res.json();
        setNotificationMsg({
          title: 'Add Members Failed',
          message: errData.error || 'Failed to add selected members.',
          type: 'error'
        });
      }
    } catch (e: any) {
      console.error(e);
      setNotificationMsg({
        title: 'Error',
        message: e.message || 'An unexpected error occurred.',
        type: 'error'
      });
    } finally {
      setSubmittingAddMembers(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedTeamId) return;
    try {
      const res = await fetch(`/api/tenant/teams/${selectedTeamId}/members?userId=${userId}`, {
        method: 'DELETE'
      });
      if (res.ok) fetchInitialData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleLeader = async (userId: string, currentIsLeader: boolean) => {
    if (!selectedTeamId) return;
    try {
      const res = await fetch(`/api/tenant/teams/${selectedTeamId}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, isLeader: !currentIsLeader })
      });
      if (res.ok) fetchInitialData();
    } catch (e) {
      console.error(e);
    }
  };

  // Handlers for Positions
  const handleOpenAddPositionsModal = () => {
    setSelectedPositionIdsForAdd([]);
    setPositionSearchQuery('');
    setShowAddPositionsModal(true);
  };

  const handleTogglePositionSelection = (posId: string) => {
    setSelectedPositionIdsForAdd(prev => 
      prev.includes(posId) ? prev.filter(id => id !== posId) : [...prev, posId]
    );
  };

  const handleAddPositionsSubmit = async () => {
    if (!selectedTeamId || selectedPositionIdsForAdd.length === 0) return;
    setSubmittingAddPositions(true);
    try {
      await Promise.all(
        selectedPositionIdsForAdd.map(posId =>
          fetch(`/api/tenant/teams/${selectedTeamId}/positions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ positionId: posId })
          })
        )
      );
      setShowAddPositionsModal(false);
      setSelectedPositionIdsForAdd([]);
      fetchInitialData();
    } catch (e: any) {
      console.error(e);
      setNotificationMsg({
        title: 'Error',
        message: e.message || 'Failed to add positions to team.',
        type: 'error'
      });
    } finally {
      setSubmittingAddPositions(false);
    }
  };

  const handleUnlinkPosition = async (positionId: string) => {
    if (!selectedTeamId) return;
    try {
      const res = await fetch(`/api/tenant/teams/${selectedTeamId}/positions?positionId=${positionId}`, {
        method: 'DELETE'
      });
      if (res.ok) fetchInitialData();
    } catch (e) {
      console.error(e);
    }
  };

  // Handlers for System Capabilities
  const handleToggleCapability = async (capabilityCode: string, isChecked: boolean) => {
    if (!selectedTeamId) return;
    try {
      const endpoint = `/api/tenant/teams/${selectedTeamId}/system-permissions`;
      const method = isChecked ? 'POST' : 'DELETE';
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capability: capabilityCode })
      });
      if (res.ok) fetchInitialData();
    } catch (e) {
      console.error(e);
    }
  };

  // Handlers for Main Team Object Permissions (Draft Local State & Save Button)
  const handleToggleTeamObjectPermDraft = (objectName: string, updates: Partial<ObjectPermission>) => {
    setTeamObjectPermsDraft(prev => {
      const existing = prev.find(p => p.objectName === objectName) || {
        objectName,
        canCreate: false,
        canDelete: false,
        readScope: 'NONE',
        modifyScope: 'NONE'
      };
      const updated = { ...existing, ...updates };
      return [...prev.filter(p => p.objectName !== objectName), updated as ObjectPermission];
    });
  };

  const handleSaveTeamObjectPerms = async () => {
    if (!selectedTeamId) return;
    setSavingTeamObjectPerms(true);
    try {
      for (const perm of teamObjectPermsDraft) {
        const res = await fetch(`/api/tenant/teams/${selectedTeamId}/object-permissions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            objectName: perm.objectName,
            canCreate: perm.canCreate,
            canDelete: perm.canDelete,
            readScope: perm.readScope,
            modifyScope: perm.modifyScope
          })
        });
        if (!res.ok) {
          const errJson = await res.json();
          throw new Error(errJson.error || 'Failed to save team object permission');
        }
      }

      await fetchInitialData();
      setNotificationMsg({
        title: 'Permissions Saved',
        message: `Object permissions for ${selectedTeam?.name} saved successfully.`,
        type: 'success'
      });
    } catch (e: any) {
      console.error(e);
      setNotificationMsg({
        title: 'Save Failed',
        message: e.message || 'Failed to save team object permissions.',
        type: 'error'
      });
    } finally {
      setSavingTeamObjectPerms(false);
    }
  };

  // Tree Renderer & Hierarchy Calculation
  const toggleNodeExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const renderTeamTree = (parentId: string | null = null, depth = 0) => {
    const children = teams
      .filter(t => t.parentId === parentId)
      .sort((a, b) => {
        if (a.isSystemAdmin && !b.isSystemAdmin) return -1;
        if (!a.isSystemAdmin && b.isSystemAdmin) return 1;
        return a.name.localeCompare(b.name);
      });
    if (children.length === 0) return null;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginLeft: depth > 0 ? '16px' : '0' }}>
        {children.map(team => {
          const isSelected = team.id === selectedTeamId;
          const hasChildren = teams.some(t => t.parentId === team.id);
          const isExpanded = expandedNodes[team.id] ?? true;

          return (
            <div key={team.id}>
              <div 
                onClick={() => setSelectedTeamId(team.id)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', borderRadius: '8px', cursor: 'pointer',
                  background: isSelected ? 'rgba(59,130,246,0.15)' : 'transparent',
                  color: isSelected ? 'var(--sails-primary)' : 'var(--sails-text-main)',
                  fontWeight: isSelected ? 600 : 400
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                  {hasChildren ? (
                    <span onClick={(e) => toggleNodeExpand(team.id, e)} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '2px' }}>
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                  ) : (
                    <span style={{ width: '14px' }} />
                  )}
                  {team.isSystemAdmin ? <Shield size={16} color="var(--sails-warning, #f59e0b)" /> : <Users size={16} />}
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.9rem' }}>
                    {team.name}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '10px', color: 'var(--sails-text-muted)' }}>
                    {team.members.length}
                  </span>
                </div>
              </div>

              {hasChildren && isExpanded && renderTeamTree(team.id, depth + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) return <Spinner />;

  return (
    <div style={{ display: 'flex', height: '100%', gap: 'var(--sails-spacing-md)', fontFamily: 'var(--sails-font-family)' }}>
      {/* LEFT PANE: Team Tree */}
      <div className="sails-card" style={{ width: '300px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', paddingBottom: '10px', borderBottom: '1px solid var(--sails-border-color, rgba(255,255,255,0.1))' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <GitBranch size={18} /> Team Hierarchy
          </h3>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {renderTeamTree(null, 0)}
          {teams.length === 0 && <p style={{ color: 'var(--sails-text-muted)', fontSize: '0.85rem' }}>No teams found.</p>}
        </div>
      </div>

      {/* RIGHT PANE: Team Details */}
      <div className="sails-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {!selectedTeam ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--sails-text-muted)' }}>
            Select a team from the sidebar to view details.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--sails-border-color)', paddingBottom: '15px', marginBottom: '15px' }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem' }}>{selectedTeam.name}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div 
                  ref={actionMenuRef}
                  className="sails-user-manager__action-wrapper" 
                  style={{ position: 'relative' }}
                >
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsTeamActionMenuOpen(!isTeamActionMenuOpen);
                    }}
                    className={`sails-btn sails-btn--secondary ${isTeamActionMenuOpen ? 'active' : ''}`}
                    style={{ padding: '6px 10px' }}
                    title="Team Options"
                  >
                    <MoreHorizontal size={16} />
                  </button>

                  {isTeamActionMenuOpen && (
                    <div 
                      className="sails-user-manager__context-menu"
                      style={{ position: 'absolute', top: '100%', right: 0, marginTop: '4px', width: '170px', zIndex: 100 }}
                    >
                      <button 
                        className="sails-context-item"
                        onClick={() => {
                          setIsTeamActionMenuOpen(false);
                          handleOpenAddMembersModal();
                        }}
                      >
                        <UserPlus size={14} />
                        <span>Add Member</span>
                      </button>

                      <button 
                        className="sails-context-item"
                        onClick={() => {
                          setIsTeamActionMenuOpen(false);
                          handleOpenAddPositionsModal();
                        }}
                      >
                        <Award size={14} />
                        <span>Add Position</span>
                      </button>

                      {!selectedTeam.isSystemAdmin && (
                        <>
                          <div className="sails-context-divider" />
                          <button 
                            className="sails-context-item sails-context-item--danger"
                            onClick={() => {
                              setIsTeamActionMenuOpen(false);
                              handleDeleteTeamClick({ id: selectedTeam.id, name: selectedTeam.name });
                            }}
                          >
                            <Trash2 size={14} />
                            <span>Delete Team</span>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* TABS */}
            <div style={{ display: 'flex', gap: '20px', borderBottom: '1px solid var(--sails-border-color)', marginBottom: '15px' }}>
              <TabBtn active={activeTab === 'members'} onClick={() => setActiveTab('members')} icon={<Users size={16} />} label={`Members (${selectedTeam.members.length})`} />
              <TabBtn active={activeTab === 'positions'} onClick={() => setActiveTab('positions')} icon={<Award size={16} />} label={`Positions (${(selectedTeam.positions || []).length})`} />
              <TabBtn active={activeTab === 'capabilities'} onClick={() => setActiveTab('capabilities')} icon={<Shield size={16} />} label="System Capabilities" />
              <TabBtn active={activeTab === 'objects'} onClick={() => setActiveTab('objects')} icon={<Database size={16} />} label="Data Access" />
            </div>

            {/* TAB CONTENT */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              
              {/* MEMBERS TAB */}
              {activeTab === 'members' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                    <button 
                      className="sails-btn sails-btn--secondary sails-btn--sm"
                      onClick={handleOpenAddMembersModal}
                    >
                      <UserPlus size={14} />
                      <span>Add Member</span>
                    </button>
                  </div>
                  <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--sails-border-color)' }}>
                        <th style={{ padding: '10px', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--sails-text-muted)' }}>NAME</th>
                        <th style={{ padding: '10px', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--sails-text-muted)' }}>EMAIL</th>
                        <th style={{ padding: '10px', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--sails-text-muted)' }}>ROLE</th>
                        <th style={{ padding: '10px', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--sails-text-muted)', textAlign: 'right' }}>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedTeam.members.map(m => (
                        <tr key={m.userId} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '10px' }}>{m.user.name || '-'}</td>
                          <td style={{ padding: '10px', color: 'var(--sails-text-muted)' }}>{m.user.email}</td>
                          <td style={{ padding: '10px' }}>
                            <button
                              onClick={() => handleToggleLeader(m.userId, m.isLeader)}
                              className={`sails-btn ${m.isLeader ? 'sails-btn--primary' : 'sails-btn--secondary'}`}
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
                            <button
                              className={`sails-user-manager__action-btn ${activeMemberAnchor?.id === m.userId ? 'active' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMemberAnchor(activeMemberAnchor?.id === m.userId ? null : { id: m.userId, el: e.currentTarget });
                              }}
                            >
                              <MoreHorizontal size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {selectedTeam.members.length === 0 && (
                        <tr><td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: 'var(--sails-text-muted)' }}>No members found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* POSITIONS TAB */}
              {activeTab === 'positions' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--sails-text-muted)' }}>
                      Positions mapped to {selectedTeam.name} determine role structures and slot occupancies.
                    </p>
                    <button 
                      className="sails-btn sails-btn--secondary sails-btn--sm"
                      onClick={handleOpenAddPositionsModal}
                    >
                      <Plus size={14} />
                      <span>Add Position to Team</span>
                    </button>
                  </div>

                  <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--sails-border-color)' }}>
                        <th style={{ padding: '10px', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--sails-text-muted)' }}>PREFIX</th>
                        <th style={{ padding: '10px', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--sails-text-muted)' }}>POSITION NAME</th>
                        <th style={{ padding: '10px', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--sails-text-muted)' }}>HEADCOUNT / SLOTS</th>
                        <th style={{ padding: '10px', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--sails-text-muted)', textAlign: 'right' }}>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedTeam.positions || []).map(tp => {
                        const pos = tp.position;
                        const occupiedSlots = (pos.slots || []).filter(s => s.userId).length;
                        return (
                          <tr key={pos.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <td style={{ padding: '10px' }}>
                              <span style={{
                                background: 'rgba(59,130,246,0.15)',
                                color: 'var(--sails-primary, #3b82f6)',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontWeight: 700,
                                fontSize: '0.8rem'
                              }}>
                                {pos.prefix}
                              </span>
                            </td>
                            <td style={{ padding: '10px', fontWeight: 600 }}>{pos.name}</td>
                            <td style={{ padding: '10px' }}>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '3px 8px',
                                borderRadius: '12px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                background: 'rgba(34,197,94,0.1)',
                                color: '#16a34a',
                                border: '1px solid rgba(34,197,94,0.2)'
                              }}>
                                {occupiedSlots} / {pos.headCount} Occupied
                              </span>
                            </td>
                            <td style={{ padding: '10px', textAlign: 'right' }}>
                              <button
                                className={`sails-user-manager__action-btn ${activePositionAnchor?.id === pos.id ? 'active' : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActivePositionAnchor(activePositionAnchor?.id === pos.id ? null : { id: pos.id, el: e.currentTarget });
                                }}
                              >
                                <MoreHorizontal size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {(!selectedTeam.positions || selectedTeam.positions.length === 0) && (
                        <tr><td colSpan={4} style={{ padding: '30px', textAlign: 'center', color: 'var(--sails-text-muted)' }}>No positions mapped to this team yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* CAPABILITIES TAB */}
              {activeTab === 'capabilities' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {Object.keys(capabilityCategories).length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--sails-text-muted)' }}>
                      No system capabilities available.
                    </div>
                  ) : (
                    Object.entries(capabilityCategories).map(([category, items]) => (
                      <div key={category} style={{ background: 'rgba(255,255,255,0.02)', padding: '15px', borderRadius: '8px', border: '1px solid var(--sails-border-color)' }}>
                        <h4 style={{ margin: '0 0 10px 0', textTransform: 'capitalize', color: 'var(--sails-primary)', fontSize: '0.9rem', fontWeight: 700 }}>{category}</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          {items.map(item => {
                            const isChecked = (selectedTeam?.systemPermissions || []).some(p => p.capability === item.code);
                            return (
                              <label key={item.code} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--sails-border-color)', background: isChecked ? 'rgba(var(--sails-primary-r), var(--sails-primary-g), var(--sails-primary-b), 0.1)' : 'transparent', transition: 'all 0.2s' }}>
                                <input 
                                  type="checkbox" 
                                  className="sails-checkbox"
                                  checked={isChecked} 
                                  onChange={(e) => handleToggleCapability(item.code, e.target.checked)}
                                  style={{ marginTop: '3px' }}
                                />
                                <div>
                                  <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--sails-text-main)' }}>{item.label}</div>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--sails-text-muted)', marginTop: '2px' }}>{item.description}</div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* OBJECT PERMISSIONS TAB */}
              {activeTab === 'objects' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ position: 'relative', width: '300px' }}>
                      <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sails-text-muted)' }} />
                      <input
                        type="text"
                        className="sails-input"
                        style={{ width: '100%', paddingLeft: '34px', fontSize: '0.85rem' }}
                        placeholder="Search data object..."
                        value={teamObjectSearchQuery}
                        onChange={(e) => setTeamObjectSearchQuery(e.target.value)}
                      />
                    </div>

                    <button
                      className="sails-btn sails-btn--primary sails-btn--sm"
                      onClick={handleSaveTeamObjectPerms}
                      disabled={savingTeamObjectPerms}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Save size={14} />
                      <span>{savingTeamObjectPerms ? 'Saving...' : 'Save Changes'}</span>
                    </button>
                  </div>

                  <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--sails-border-color)' }}>
                        <th style={{ padding: '10px', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--sails-text-muted)' }}>OBJECT</th>
                        <th style={{ padding: '10px', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--sails-text-muted)', textAlign: 'center' }}>CREATE</th>
                        <th style={{ padding: '10px', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--sails-text-muted)', minWidth: '240px' }}>VISIBILITY SCOPE</th>
                        <th style={{ padding: '10px', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--sails-text-muted)', minWidth: '240px' }}>MODIFY SCOPE</th>
                        <th style={{ padding: '10px', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--sails-text-muted)', textAlign: 'center' }}>DELETE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allObjects
                        .filter(obj => {
                          const name = (obj.name || obj.displayName || obj.tableName || '').toLowerCase();
                          const apiName = (obj.tableName || obj.apiName || obj.name || '').toLowerCase();
                          return name.includes(teamObjectSearchQuery.toLowerCase()) || apiName.includes(teamObjectSearchQuery.toLowerCase());
                        })
                        .map(obj => {
                          const objApiName = obj.tableName || obj.apiName || obj.name;
                          const objDisplayName = obj.name || obj.displayName || obj.tableName;

                          const perm = teamObjectPermsDraft.find(p => p.objectName === objApiName) || {
                            objectName: objApiName,
                            canCreate: false,
                            canDelete: false,
                            readScope: 'NONE',
                            modifyScope: 'NONE'
                          };
                          return (
                            <tr key={objApiName} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                              <td style={{ padding: '10px' }}>{objDisplayName}</td>
                              <td style={{ padding: '10px', textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  className="sails-checkbox"
                                  checked={perm.canCreate}
                                  onChange={(e) => handleToggleTeamObjectPermDraft(objApiName, { canCreate: e.target.checked })}
                                />
                              </td>
                              <td style={{ padding: '10px' }}>
                                <CustomSelect
                                  size="sm"
                                  style={{ width: '100%' }}
                                  value={perm.readScope || 'NONE'}
                                  options={[
                                    { value: 'NONE', label: '-- None --' },
                                    { value: 'OWNER', label: 'Owner' },
                                    { value: 'ALL', label: 'View All' },
                                    { value: 'HIERARCHY', label: 'View Hierarchy' }
                                  ]}
                                  onChange={(val) => handleToggleTeamObjectPermDraft(objApiName, { readScope: String(val) as any })}
                                />
                              </td>
                              <td style={{ padding: '10px' }}>
                                <CustomSelect
                                  size="sm"
                                  style={{ width: '100%' }}
                                  value={perm.modifyScope || 'NONE'}
                                  options={[
                                    { value: 'NONE', label: '-- None --' },
                                    { value: 'OWNER', label: 'Owner' },
                                    { value: 'ALL', label: 'Modify All' },
                                    { value: 'HIERARCHY', label: 'Modify Hierarchy' }
                                  ]}
                                  onChange={(val) => handleToggleTeamObjectPermDraft(objApiName, { modifyScope: String(val) as any })}
                                />
                              </td>
                              <td style={{ padding: '10px', textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  className="sails-checkbox"
                                  checked={perm.canDelete}
                                  onChange={(e) => handleToggleTeamObjectPermDraft(objApiName, { canDelete: e.target.checked })}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      {allObjects.length === 0 && (
                        <tr><td colSpan={5} style={{ padding: '30px', textAlign: 'center', color: 'var(--sails-text-muted)' }}>No data models defined in system.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

            </div>
          </>
        )}
      </div>

      {/* MEMBER ROW PORTAL CONTEXT MENU */}
      {activeMemberAnchor && (
        <ContextMenuPortal anchorEl={activeMemberAnchor.el} onClose={() => setActiveMemberAnchor(null)}>
          <button
            className="sails-context-item"
            onClick={() => {
              const m = selectedTeam?.members.find(mem => mem.userId === activeMemberAnchor.id);
              setActiveMemberAnchor(null);
              if (m) {
                setManageModalState({
                  targetType: 'user',
                  targetId: m.userId,
                  targetName: m.user.name || m.user.email
                });
              }
            }}
          >
            <Database size={14} />
            <span>Manage Data Access</span>
          </button>
          <div className="sails-context-divider" />
          <button
            className="sails-context-item sails-context-item--danger"
            onClick={() => {
              const id = activeMemberAnchor.id;
              setActiveMemberAnchor(null);
              handleRemoveMember(id);
            }}
          >
            <X size={14} />
            <span>Unlink Member</span>
          </button>
        </ContextMenuPortal>
      )}

      {/* POSITION ROW PORTAL CONTEXT MENU */}
      {activePositionAnchor && (
        <ContextMenuPortal anchorEl={activePositionAnchor.el} onClose={() => setActivePositionAnchor(null)}>
          <button
            className="sails-context-item"
            onClick={() => {
              const tp = (selectedTeam?.positions || []).find(p => p.position.id === activePositionAnchor.id);
              setActivePositionAnchor(null);
              if (tp) {
                setManageModalState({
                  targetType: 'position',
                  targetId: tp.position.id,
                  targetName: `${tp.position.prefix} — ${tp.position.name}`
                });
              }
            }}
          >
            <Database size={14} />
            <span>Manage Data Access</span>
          </button>
          <div className="sails-context-divider" />
          <button
            className="sails-context-item sails-context-item--danger"
            onClick={() => {
              const id = activePositionAnchor.id;
              setActivePositionAnchor(null);
              handleUnlinkPosition(id);
            }}
          >
            <X size={14} />
            <span>Unlink Position</span>
          </button>
        </ContextMenuPortal>
      )}

      {/* INDIVIDUAL MANAGE DATA ACCESS MODAL */}
      {manageModalState && (
        <ManageDataAccessModal
          targetType={manageModalState.targetType}
          targetId={manageModalState.targetId}
          targetName={manageModalState.targetName}
          allObjects={allObjects}
          onClose={() => setManageModalState(null)}
          onSaveSuccess={() => {
            fetchInitialData();
            setNotificationMsg({
              title: 'Permissions Saved',
              message: `Data access permissions for ${manageModalState.targetName} saved successfully.`,
              type: 'success'
            });
          }}
        />
      )}

      {/* CREATE TEAM MODAL */}
      {showCreateTeamModal && createPortal(
        <div className="sails-modal-overlay">
          <div className="sails-card" style={{ width: '450px', padding: '24px', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Create New Team</h3>
              <button onClick={() => setShowCreateTeamModal(false)} style={{ background: 'none', border: 'none', color: 'var(--sails-text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateTeamSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Team Name</label>
                <input 
                  type="text" 
                  className="sails-input" 
                  style={{ width: '100%' }} 
                  placeholder="e.g. Frontend Engineering" 
                  value={newTeamName}
                  onChange={e => setNewTeamName(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Parent Team (Optional)</label>
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    className="sails-input"
                    style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left', cursor: 'pointer' }}
                    onClick={() => setIsParentSelectOpen(!isParentSelectOpen)}
                  >
                    <span>
                      {modalParentTeamId ? (teams.find(t => t.id === modalParentTeamId)?.name || 'Select Parent Team') : '-- No Parent (Top Level) --'}
                    </span>
                    <ChevronDown size={16} />
                  </button>

                  {isParentSelectOpen && (
                    <div className="sails-card" style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', maxHeight: '180px', overflowY: 'auto', zIndex: 100, padding: '4px' }}>
                      <div 
                        style={{ padding: '8px 12px', cursor: 'pointer', borderRadius: '6px', fontSize: '0.85rem' }}
                        onClick={() => { setModalParentTeamId(null); setIsParentSelectOpen(false); }}
                      >
                        -- No Parent (Top Level) --
                      </div>
                      {teams.filter(t => !t.isSystemAdmin).map(t => (
                        <div 
                          key={t.id}
                          style={{ padding: '8px 12px', cursor: 'pointer', borderRadius: '6px', fontSize: '0.85rem', background: modalParentTeamId === t.id ? 'rgba(59,130,246,0.1)' : 'transparent' }}
                          onClick={() => { setModalParentTeamId(t.id); setIsParentSelectOpen(false); }}
                        >
                          {t.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="sails-btn sails-btn--secondary" onClick={() => setShowCreateTeamModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="sails-btn sails-btn--primary" disabled={submittingTeam}>
                  {submittingTeam ? 'Creating...' : 'Create Team'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ADD MEMBERS MODAL */}
      {showAddMembersModal && createPortal(
        <div className="sails-modal-overlay">
          <div className="sails-card" style={{ width: '480px', maxHeight: '80vh', padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Add Members to {selectedTeam?.name}</h3>
              <button onClick={() => setShowAddMembersModal(false)} style={{ background: 'none', border: 'none', color: 'var(--sails-text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ position: 'relative', marginBottom: '12px' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sails-text-muted)' }} />
              <input 
                type="text"
                className="sails-input"
                style={{ width: '100%', paddingLeft: '34px', fontSize: '0.85rem' }}
                placeholder="Search user by name or email..."
                value={memberSearchQuery}
                onChange={e => setMemberSearchQuery(e.target.value)}
                autoFocus
              />
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px' }}>
              {tenantUsers
                .filter(u => !selectedTeam?.members.some(m => m.userId === u.id))
                .filter(u => (u.name || '').toLowerCase().includes(memberSearchQuery.toLowerCase()) || u.email.toLowerCase().includes(memberSearchQuery.toLowerCase()))
                .map(u => {
                  const isSelected = selectedUserIdsForAdd.includes(u.id);
                  return (
                    <div
                      key={u.id}
                      onClick={() => handleToggleUserSelection(u.id)}
                      style={{
                        padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        background: isSelected ? 'rgba(59,130,246,0.1)' : 'transparent',
                        border: '1px solid ' + (isSelected ? 'var(--sails-primary)' : 'transparent')
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{u.name || u.email}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--sails-text-muted)' }}>{u.email}</div>
                      </div>
                      {isSelected && <Check size={16} color="var(--sails-primary)" />}
                    </div>
                  );
                })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="sails-btn sails-btn--secondary" onClick={() => setShowAddMembersModal(false)}>
                Cancel
              </button>
              <button 
                className="sails-btn sails-btn--primary" 
                onClick={handleAddMembersSubmit}
                disabled={submittingAddMembers || selectedUserIdsForAdd.length === 0}
              >
                {submittingAddMembers ? 'Adding...' : `Add Selected (${selectedUserIdsForAdd.length})`}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ADD POSITIONS MODAL */}
      {showAddPositionsModal && createPortal(
        <div className="sails-modal-overlay" style={{ zIndex: 10000 }}>
          <div className="sails-card" style={{ width: '480px', maxHeight: '80vh', padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Add Positions to {selectedTeam?.name}</h3>
              <button onClick={() => setShowAddPositionsModal(false)} style={{ background: 'none', border: 'none', color: 'var(--sails-text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ position: 'relative', marginBottom: '12px' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sails-text-muted)' }} />
              <input 
                type="text"
                className="sails-input"
                style={{ width: '100%', paddingLeft: '34px', fontSize: '0.85rem' }}
                placeholder="Search position by name or prefix..."
                value={positionSearchQuery}
                onChange={e => setPositionSearchQuery(e.target.value)}
                autoFocus
              />
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
              {tenantPositions
                .filter(p => !(selectedTeam?.positions || []).some(tp => tp.positionId === p.id))
                .filter(p => p.name.toLowerCase().includes(positionSearchQuery.toLowerCase()) || p.prefix.toLowerCase().includes(positionSearchQuery.toLowerCase()))
                .map(p => {
                  const isSelected = selectedPositionIdsForAdd.includes(p.id);
                  return (
                    <div
                      key={p.id}
                      onClick={() => handleTogglePositionSelection(p.id)}
                      style={{
                        padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        background: isSelected ? 'rgba(59,130,246,0.1)' : 'transparent',
                        border: '1px solid ' + (isSelected ? 'var(--sails-primary)' : 'var(--sails-border-color)')
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{
                          background: 'rgba(59,130,246,0.15)',
                          color: 'var(--sails-primary, #3b82f6)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontWeight: 700,
                          fontSize: '0.75rem'
                        }}>
                          {p.prefix}
                        </span>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{p.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--sails-text-muted)' }}>{p.headCount} Headcount Slots</div>
                        </div>
                      </div>
                      {isSelected && <Check size={16} color="var(--sails-primary)" />}
                    </div>
                  );
                })}
              {tenantPositions.filter(p => !(selectedTeam?.positions || []).some(tp => tp.positionId === p.id)).length === 0 && (
                <div style={{ padding: '24px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--sails-text-muted)' }}>
                  All positions have been added to this team.
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="sails-btn sails-btn--secondary" onClick={() => setShowAddPositionsModal(false)}>
                Cancel
              </button>
              <button 
                className="sails-btn sails-btn--primary" 
                onClick={handleAddPositionsSubmit}
                disabled={submittingAddPositions || selectedPositionIdsForAdd.length === 0}
              >
                {submittingAddPositions ? 'Adding...' : `Add Selected (${selectedPositionIdsForAdd.length})`}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* THEMED CONFIRMATION MODAL */}
      {deleteConfirmTeam && createPortal(
        <div className="sails-modal-overlay">
          <div className="sails-card" style={{ width: '440px', padding: '24px', borderRadius: '16px' }}>
            <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.1)',
                color: 'var(--sails-danger, #ef4444)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Trash2 size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '1.2rem', fontWeight: 600, color: 'var(--sails-text-main)' }}>
                  Delete Team
                </h3>
                <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--sails-text-muted)', lineHeight: 1.5 }}>
                  Are you sure you want to delete the team <strong>"{deleteConfirmTeam.name}"</strong>? All associated user memberships and permissions for this team will be removed.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button 
                className="sails-btn sails-btn--secondary"
                onClick={() => setDeleteConfirmTeam(null)}
              >
                Cancel
              </button>
              <button 
                className="sails-btn sails-btn--danger"
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
        <div className="sails-modal-overlay">
          <div className="sails-card" style={{ width: '400px', padding: '28px', borderRadius: 'var(--sails-radius-lg, 20px)', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', color: notificationMsg.type === 'error' ? 'var(--sails-danger, #ef4444)' : 'var(--sails-primary)' }}>
              {notificationMsg.type === 'error' ? <AlertCircle size={44} /> : <Check size={44} />}
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
        borderBottom: active ? '2px solid var(--sails-primary)' : '2px solid transparent',
        color: active ? 'var(--sails-primary)' : 'var(--sails-text-muted)',
        fontWeight: active ? 'bold' : 'normal',
        transition: 'all 0.2s'
      }}
    >
      {icon} {label}
    </div>
  );
}
