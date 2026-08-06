import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Plus, Trash2, Award, Users, Search, Filter, X, 
  ArrowUpDown, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, 
  MoreHorizontal, Edit2, UserPlus, Check
} from 'lucide-react';
import { useConsole } from '../../contexts/ConsoleContext';
import { CustomSelect } from '../../components/common/CustomSelect';
import { UiTableCard, UiTable, UiTh, UiTr, UiTd, UiActionsMenu, UiActionsItem, UiActionsDivider, UiPagination, UiCheckboxTh, UiCheckboxTd } from '../../components/ui';
import '../custom/UserManager.css';
import './AdminPositionManager.css';

interface PositionSlot {
  id: string;
  positionId: string;
  userId: string | null;
  user?: {
    id: string;
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
  slots: PositionSlot[];
}

function generateAcronym(name: string): string {
  const clean = name.trim().replace(/[^a-zA-Z0-9\s]/g, '');
  if (!clean) return '';
  const words = clean.split(/\s+/).filter((w) => w.length > 0);

  if (words.length === 1) {
    const word = words[0].toUpperCase();
    if (word === 'DEVELOPER' || word === 'DEV') return 'DEV';
    if (word === 'MANAGER' || word === 'MGR') return 'MGR';
    if (word === 'DIRECTOR' || word === 'DIR') return 'DIR';
    if (word === 'EXECUTIVE' || word === 'EXEC') return 'EXEC';
    if (word === 'ACCOUNTANT') return 'ACCT';
    if (word === 'ENGINEER' || word === 'ENG') return 'ENG';
    if (word.length <= 4) return word;
    const vowelsRemoved = word[0] + word.slice(1).replace(/[AEIOU]/g, '');
    return (vowelsRemoved.length >= 3 ? vowelsRemoved.slice(0, 4) : word.slice(0, 4)).toUpperCase();
  }

  const stopWords = new Set(['of', 'and', 'the', 'in', 'at', 'for', 'to', 'a', 'an']);
  const acronym = words
    .filter((w) => !stopWords.has(w.toLowerCase()))
    .map((w) => w[0].toUpperCase())
    .join('');

  return acronym.slice(0, 6);
}

function renderHighlightedText(text: string | null | undefined, query: string): React.ReactNode {
  if (!text) return null;
  if (!query.trim()) return text;

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i}>{part}</mark>
        ) : (
          part
        )
      )}
    </>
  );
}

interface UserPickerModalProps {
  slotId: string;
  tenantUsers: { id: string; name: string; email: string }[];
  currentUserId: string | null;
  onSelectUser: (userId: string | null) => void;
  onClose: () => void;
}

function UserPickerModal({ slotId, tenantUsers, currentUserId, onSelectUser, onClose }: UserPickerModalProps) {
  const [searchTerm, setSearchTerm] = useState<string>('');

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return tenantUsers.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [tenantUsers, searchTerm]);

  return createPortal(
    <div className="sails-modal-overlay" style={{ zIndex: 10000, justifyContent: 'center', alignItems: 'center' }}>
      <div
        className="sails-card"
        style={{
          width: '440px',
          maxHeight: '75vh',
          borderRadius: '20px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--sails-shadow-lg)',
          animation: 'sails-modal-slide-up 0.18s ease-out'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--sails-text-main)' }}>
              Map User to Slot {slotId}
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--sails-text-muted)' }}>
              Select a user from your organization
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--sails-text-muted)', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ position: 'relative', marginBottom: '14px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--sails-text-muted)' }} />
          <input
            type="text"
            className="sails-input"
            style={{ width: '100%', paddingLeft: '36px', fontSize: '0.85rem' }}
            placeholder="Search user by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
          />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '2px' }}>
          <button
            type="button"
            className="sails-btn sails-btn--ghost"
            style={{ justifyContent: 'flex-start', fontSize: '0.825rem', color: 'var(--sails-text-muted)', padding: '10px 12px', borderRadius: '10px' }}
            onClick={() => {
              onSelectUser(null);
              onClose();
            }}
          >
            -- Vacant (Unassigned) --
          </button>

          {filtered.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--sails-text-muted)' }}>
              No users found matching your search.
            </div>
          ) : (
            filtered.map((u) => (
              <button
                key={u.id}
                type="button"
                className="sails-btn sails-btn--ghost"
                style={{
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  display: 'flex',
                  fontSize: '0.85rem',
                  padding: '10px 12px',
                  textAlign: 'left',
                  borderRadius: '10px',
                  background: currentUserId === u.id ? 'rgba(59,130,246,0.08)' : 'transparent'
                }}
                onClick={() => {
                  onSelectUser(u.id);
                  onClose();
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--sails-text-main)' }}>{u.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--sails-text-muted)' }}>{u.email}</div>
                </div>
                {currentUserId === u.id && <Check size={16} color="var(--sails-primary, #3b82f6)" />}
              </button>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

interface PositionDetailsModalProps {
  pos: Position;
  tenantUsers: { id: string; name: string; email: string }[];
  onSaveAssignments: (slotUpdates: { slotId: string; userId: string | null }[]) => Promise<void>;
  onClose: () => void;
}

function PositionDetailsModal({ pos, tenantUsers, onSaveAssignments, onClose }: PositionDetailsModalProps) {
  // Local state for slot mappings: slotId -> userId | null
  const [slotMap, setSlotMap] = useState<Record<string, string | null>>(() => {
    const map: Record<string, string | null> = {};
    pos.slots.forEach((s) => {
      map[s.id] = s.userId;
    });
    return map;
  });

  const [activeSearchSlotId, setActiveSearchSlotId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const occupiedCount = Object.values(slotMap).filter(Boolean).length;
  const vacantCount = pos.headCount - occupiedCount;

  const handleSelectUserForSlot = (slotId: string, userId: string | null) => {
    setSlotMap((prev) => ({ ...prev, [slotId]: userId }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates = Object.entries(slotMap).map(([slotId, userId]) => ({ slotId, userId }));
      await onSaveAssignments(updates);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <div className="sails-modal-overlay" style={{ zIndex: 9999, justifyContent: 'center', alignItems: 'center' }}>
      <div
        className="sails-card"
        style={{
          width: '560px',
          maxHeight: '82vh',
          borderRadius: '20px',
          padding: '24px 28px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--sails-shadow-lg)',
          animation: 'sails-modal-slide-up 0.2s ease-out',
          position: 'relative'
        }}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', paddingBottom: '14px', borderBottom: '1px solid var(--sails-border-color)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{
                background: 'rgba(59,130,246,0.15)',
                color: 'var(--sails-primary, #3b82f6)',
                padding: '2px 8px',
                borderRadius: '6px',
                fontWeight: 700,
                fontSize: '0.85rem'
              }}>
                {pos.prefix}
              </span>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--sails-text-main)' }}>
                {pos.name}
              </h3>
            </div>
            <p style={{ margin: 0, fontSize: '0.825rem', color: 'var(--sails-text-muted)' }}>
              {pos.description || 'No description provided'}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--sails-text-muted)', cursor: 'pointer', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        {/* Position Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '20px' }}>
          <div style={{ padding: '10px 12px', background: 'var(--sails-bg-body)', borderRadius: '10px', border: '1px solid var(--sails-border-color)' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--sails-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Headcount</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '2px' }}>{pos.headCount}</div>
          </div>
          <div style={{ padding: '10px 12px', background: 'rgba(34,197,94,0.08)', borderRadius: '10px', border: '1px solid rgba(34,197,94,0.2)' }}>
            <div style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: 600, textTransform: 'uppercase' }}>Occupied</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#16a34a', marginTop: '2px' }}>{occupiedCount}</div>
          </div>
          <div style={{ padding: '10px 12px', background: 'var(--sails-bg-body)', borderRadius: '10px', border: '1px solid var(--sails-border-color)' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--sails-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Vacant</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '2px' }}>{vacantCount}</div>
          </div>
        </div>

        {/* Slots Detail Section */}
        <h4 style={{ margin: '0 0 10px', fontSize: '0.9rem', fontWeight: 700, color: 'var(--sails-text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Users size={16} />
          <span>Head Count Slots Mapping</span>
        </h4>

        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {pos.slots.map((slot) => {
              const assignedUserId = slotMap[slot.id];
              const assignedUser = tenantUsers.find((u) => u.id === assignedUserId);
              const isOccupied = Boolean(assignedUserId);

              return (
                <div key={slot.id} className={`sails-slot-card ${isOccupied ? 'sails-slot-card--occupied' : ''}`}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      background: isOccupied ? 'rgba(34,197,94,0.15)' : 'rgba(0,0,0,0.06)',
                      color: isOccupied ? '#15803d' : 'var(--sails-text-muted)'
                    }}>
                      {slot.id}
                    </span>
                    <div>
                      {assignedUser ? (
                        <>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--sails-text-main)' }}>
                            {assignedUser.name}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--sails-text-muted)' }}>
                            {assignedUser.email}
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize: '0.825rem', color: 'var(--sails-text-muted)', fontStyle: 'italic' }}>
                          Vacant Slot
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {isOccupied ? (
                      <>
                        <button
                          type="button"
                          className="sails-btn sails-btn--ghost sails-btn--sm"
                          style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                          onClick={() => setActiveSearchSlotId(slot.id)}
                        >
                          Change
                        </button>
                        <button
                          type="button"
                          className="sails-btn sails-btn--ghost sails-btn--sm"
                          style={{ fontSize: '0.75rem', padding: '4px 8px', color: 'var(--sails-danger)' }}
                          onClick={() => handleSelectUserForSlot(slot.id, null)}
                        >
                          Unmap
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="sails-btn sails-btn--secondary sails-btn--sm"
                        style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                        onClick={() => setActiveSearchSlotId(slot.id)}
                      >
                        <UserPlus size={14} style={{ marginRight: '4px' }} />
                        Map User
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* User Search Picker Sub-Modal Popup */}
        {activeSearchSlotId && (
          <UserPickerModal
            slotId={activeSearchSlotId}
            tenantUsers={tenantUsers}
            currentUserId={slotMap[activeSearchSlotId]}
            onSelectUser={(userId) => handleSelectUserForSlot(activeSearchSlotId, userId)}
            onClose={() => setActiveSearchSlotId(null)}
          />
        )}

        {/* Footer with Explicit Save */}
        <div style={{ paddingTop: '14px', borderTop: '1px solid var(--sails-border-color)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button className="sails-btn sails-btn--secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button className="sails-btn sails-btn--primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function AdminPositionManager() {
  const { setHeaderActions } = useConsole();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Position; direction: 'asc' | 'desc' } | null>(null);

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [editingPositionId, setEditingPositionId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', prefix: '', description: '', headCount: 1 });
  const [isPrefixCustomized, setIsPrefixCustomized] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Position Details Modal State
  const [selectedPositionDetails, setSelectedPositionDetails] = useState<Position | null>(null);
  const [tenantUsers, setTenantUsers] = useState<{ id: string; name: string; email: string }[]>([]);

  useEffect(() => {
    fetchPositions();
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/tenant/users');
      if (res.ok) {
        const data = await res.json();
        setTenantUsers(data.map((u: any) => ({ id: u.id, name: u.name || u.email, email: u.email })));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveAssignments = async (slotUpdates: { slotId: string; userId: string | null }[]) => {
    try {
      await Promise.all(
        slotUpdates.map((u) =>
          fetch(`/api/tenant/positions/slots/${u.slotId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: u.userId })
          })
        )
      );
      fetchPositions();
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenCreateModal = () => {
    setFormData({ name: '', prefix: '', description: '', headCount: 1 });
    setEditingPositionId(null);
    setIsPrefixCustomized(false);
    setErrorMsg(null);
    setShowCreateModal(true);
  };

  const handleOpenEditModal = (pos: Position) => {
    setFormData({
      name: pos.name,
      prefix: pos.prefix,
      description: pos.description || '',
      headCount: pos.headCount
    });
    setEditingPositionId(pos.id);
    setIsPrefixCustomized(true);
    setErrorMsg(null);
    setShowCreateModal(true);
  };

  useEffect(() => {
    setHeaderActions(
      <button
        className="sails-btn sails-btn--primary"
        onClick={handleOpenCreateModal}
      >
        <Plus size={16} /> New Position
      </button>
    );
    return () => setHeaderActions(null);
  }, [setHeaderActions]);

  const fetchPositions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tenant/positions');
      if (res.ok) {
        const data = await res.json();
        setPositions(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      const url = editingPositionId ? `/api/tenant/positions/${editingPositionId}` : '/api/tenant/positions';
      const method = editingPositionId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          prefix: formData.prefix.toUpperCase(),
          description: formData.description,
          headCount: Number(formData.headCount)
        })
      });

      if (!res.ok) {
        const err = await res.json();
        setErrorMsg(err.error || 'Failed to save position');
        return;
      }

      setShowCreateModal(false);
      setEditingPositionId(null);
      setFormData({ name: '', prefix: '', description: '', headCount: 1 });
      fetchPositions();
    } catch (e: any) {
      setErrorMsg(e.message || 'An error occurred');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this position and all its slots?')) return;
    try {
      const res = await fetch(`/api/tenant/positions/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchPositions();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Filter & Sort
  const filteredPositions = useMemo(() => {
    return positions.filter((p) => {
      const query = searchTerm.toLowerCase();
      return (
        p.name.toLowerCase().includes(query) ||
        p.prefix.toLowerCase().includes(query) ||
        (p.description && p.description.toLowerCase().includes(query))
      );
    });
  }, [positions, searchTerm]);

  const sortedPositions = useMemo(() => {
    if (!sortConfig) return filteredPositions;
    return [...filteredPositions].sort((a, b) => {
      const aVal = a[sortConfig.key] ?? '';
      const bVal = b[sortConfig.key] ?? '';
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredPositions, sortConfig]);

  // Pagination
  const totalCount = sortedPositions.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const paginatedPositions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedPositions.slice(start, start + pageSize);
  }, [sortedPositions, currentPage, pageSize]);

  const startRange = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRange = Math.min(currentPage * pageSize, totalCount);

  // Selection
  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedPositions.length && paginatedPositions.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedPositions.map((p) => p.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSort = (key: keyof Position) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  return (
    <div className="sails-user-manager sails-position-manager">
      {/* 1. Header Toolbar */}
      <div className="sails-user-manager__toolbar">
        <div className="sails-user-manager__search-wrapper">
          <Search size={18} className="sails-user-manager__search-icon" />
          <input
            type="text"
            placeholder="Search positions..."
            className="sails-user-manager__search-input"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
        <div className="sails-user-manager__actions">
          <button className="sails-btn sails-btn--ghost">
            <Filter size={16} />
            <span>Filters</span>
          </button>
        </div>
      </div>

      {/* 2. Position Data Table */}
      <UiTableCard>
        <UiTable>
          <thead>
            <tr>
              <UiCheckboxTh
                checked={paginatedPositions.length > 0 && selectedIds.size === paginatedPositions.length}
                onChange={toggleSelectAll}
              />
              <UiTh sortable sortState={sortConfig?.key === 'prefix' ? sortConfig.direction : 'idle'} onSort={() => handleSort('prefix')}>PREFIX</UiTh>
              <UiTh sortable sortState={sortConfig?.key === 'name' ? sortConfig.direction : 'idle'} onSort={() => handleSort('name')}>POSITION NAME</UiTh>
              <UiTh sortable sortState={sortConfig?.key === 'headCount' ? sortConfig.direction : 'idle'} onSort={() => handleSort('headCount')}>HEADCOUNT / SLOTS</UiTh>
              <th style={{ textAlign: 'right', width: 48 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '80px' }}>
                  <div className="sails-loading-spinner"></div>
                  <p style={{ marginTop: '16px', color: 'var(--sails-text-muted)' }}>Fetching positions...</p>
                </td>
              </tr>
            ) : paginatedPositions.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '80px' }}>
                  <p style={{ color: 'var(--sails-text-muted)' }}>No positions found matching your criteria.</p>
                </td>
              </tr>
            ) : (
              paginatedPositions.map((pos) => (
                <UiTr key={pos.id} onClick={() => setSelectedPositionDetails(pos)} selected={selectedIds.has(pos.id)}>
                  <UiCheckboxTd checked={selectedIds.has(pos.id)} onChange={() => toggleSelect(pos.id)} onClick={(e) => e.stopPropagation()} />
                  <UiTd>
                    <span style={{
                      background: 'rgba(59,130,246,0.12)',
                      color: 'var(--sails-primary, #3b82f6)',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontWeight: 600,
                      fontSize: '0.85rem'
                    }}>
                      {renderHighlightedText(pos.prefix, searchTerm)}
                    </span>
                  </UiTd>
                  <UiTd>
                    <div className="sails-user-manager__info">
                      <span className="sails-user-manager__name">
                        {renderHighlightedText(pos.name, searchTerm)}
                      </span>
                      {pos.description && (
                        <span className="sails-user-manager__email" style={{ marginTop: '2px' }}>
                          {renderHighlightedText(pos.description, searchTerm)}
                        </span>
                      )}
                    </div>
                  </UiTd>
                  <UiTd>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 10px',
                      borderRadius: '20px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      background: 'rgba(34,197,94,0.1)',
                      color: '#16a34a',
                      border: '1px solid rgba(34,197,94,0.2)'
                    }}>
                      <Users size={14} />
                      {pos.slots.filter((s) => s.userId).length} / {pos.headCount} Occupied
                    </span>
                  </UiTd>
                  <UiTd align="right" onClick={(e) => e.stopPropagation()}>
                    <UiActionsMenu open={activeMenuId === pos.id} onToggle={() => setActiveMenuId(activeMenuId === pos.id ? null : pos.id)}>
                      <UiActionsItem onClick={() => { setActiveMenuId(null); handleOpenEditModal(pos); }}>
                        <Edit2 size={14} /> Edit Details
                      </UiActionsItem>
                      <UiActionsDivider />
                      <UiActionsItem danger onClick={() => { setActiveMenuId(null); handleDelete(pos.id); }}>
                        <Trash2 size={14} /> Delete Position
                      </UiActionsItem>
                    </UiActionsMenu>
                  </UiTd>
                </UiTr>
              ))
            )}
          </tbody>
        </UiTable>

        <UiPagination
          page={currentPage}
          totalPages={totalPages || 1}
          total={totalCount}
          pageSize={pageSize === totalCount ? 50 : pageSize}
          label="positions"
          onPageChange={setCurrentPage}
          onPageSizeChange={(n) => { setPageSize(n); setCurrentPage(1); }}
          pageSizeOptions={[10, 25, 50]}
        />
      </UiTableCard>

      {/* Create / Edit Modal */}
      {showCreateModal && createPortal(
        <div className="sails-modal-overlay" style={{ zIndex: 9999 }}>
          <div className="sails-card" style={{ width: '460px', padding: '28px', borderRadius: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>
                {editingPositionId ? 'Edit Position' : 'Create New Position'}
              </h3>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', color: 'var(--sails-text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {errorMsg && (
              <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '16px' }}>
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSave}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Position Name</label>
                <input
                  type="text"
                  className="sails-input"
                  style={{ width: '100%' }}
                  placeholder="e.g. Senior Software Engineer"
                  value={formData.name}
                  onChange={(e) => {
                    const newName = e.target.value;
                    const autoPrefix = isPrefixCustomized ? formData.prefix : generateAcronym(newName);
                    setFormData({ ...formData, name: newName, prefix: autoPrefix });
                  }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>Prefix</label>
                    <span style={{ fontSize: '0.75rem', color: 'var(--sails-primary, #3b82f6)', fontWeight: 500 }}>Auto-Generated</span>
                  </div>
                  <input
                    type="text"
                    className="sails-input"
                    style={{ width: '100%', textTransform: 'uppercase', fontFamily: 'monospace', fontWeight: 700 }}
                    placeholder="SSE"
                    maxLength={10}
                    value={formData.prefix}
                    onChange={(e) => {
                      setIsPrefixCustomized(true);
                      setFormData({ ...formData, prefix: e.target.value.toUpperCase() });
                    }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Head Count (Slots)</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    className="sails-input"
                    style={{ width: '100%' }}
                    value={formData.headCount}
                    onChange={(e) => setFormData({ ...formData, headCount: Number(e.target.value) })}
                    required
                  />
                </div>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>Description</label>
                <textarea
                  className="sails-input"
                  style={{ width: '100%', minHeight: '80px', fontFamily: 'inherit' }}
                  placeholder="Responsibilities and position details..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" className="sails-btn sails-btn--secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="sails-btn sails-btn--primary">
                  {editingPositionId ? 'Save Changes' : 'Create Position'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Position Details Modal */}
      {selectedPositionDetails && (
        <PositionDetailsModal
          pos={selectedPositionDetails}
          tenantUsers={tenantUsers}
          onSaveAssignments={handleSaveAssignments}
          onClose={() => setSelectedPositionDetails(null)}
        />
      )}
    </div>
  );
}
