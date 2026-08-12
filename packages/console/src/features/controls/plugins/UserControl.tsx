/**
 * UserControl — user picker (with role filter).
 */
import React, { useState, useEffect, useRef } from 'react';
import { User, UserCheck, Search, ChevronDown, X, Check } from 'lucide-react';
import type { FieldControlPlugin, FieldControlProps } from '../types';
import { useAuth } from '../../../contexts/AuthContext';
import '../controls.css';

interface UserItem {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

const DEFAULT_USERS: UserItem[] = [
  { id: 'usr_001', name: 'Somsak Chaiyaporn', email: 'somsak@sails.io' },
  { id: 'usr_002', name: 'Anong Kongkaew', email: 'anong@sails.io' },
  { id: 'usr_003', name: 'Pranee Srisuk', email: 'pranee@sails.io' },
];

let cachedUsers: UserItem[] | null = null;

/** Load the tenant user list once per session; shared by edit + display renderers. */
export function useTenantUsers(): { users: UserItem[]; loaded: boolean } {
  const [users, setUsers] = useState<UserItem[]>(cachedUsers || DEFAULT_USERS);
  const [loaded, setLoaded] = useState(!!cachedUsers);

  useEffect(() => {
    if (cachedUsers) return;
    let isMounted = true;
    fetch('/api/tenant/users')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && Array.isArray(data) && data.length > 0) {
          const mapped: UserItem[] = data.map((u: any) => ({
            id: u.id,
            name: u.name || u.email,
            email: u.email,
            avatar: u.image || u.avatar,
          }));
          cachedUsers = mapped;
          setUsers(mapped);
        }
      })
      .catch(() => {
        // Keep DEFAULT_USERS fallback
      })
      .finally(() => {
        if (isMounted) setLoaded(true);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  return { users, loaded };
}

const RenderEdit: React.FC<FieldControlProps> = ({ field, value, onChange, disabled, readOnly }) => {
  const { users, loaded } = useTenantUsers();
  const { user: sessionUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const config = (field?.config as any) || {};
  const defaultToCurrentUser = config.defaultToCurrentUser ?? true;

  // Auto-populate the current logged-in user if empty and defaultToCurrentUser is
  // enabled. Waits for the real tenant user list (loaded) so it never assigns a
  // mock fallback user, then prefers the session user over the first list entry.
  useEffect(() => {
    if (!value && defaultToCurrentUser && onChange) {
      if (!loaded) return;
      const current = users.find((u) => u.id === sessionUser?.id) || users[0];
      onChange(current?.id || sessionUser?.id || '');
    }
  }, [value, defaultToCurrentUser, users, loaded, onChange, sessionUser?.id]);

  const currentValueStr = typeof value === 'object' ? (value?.id || value?.name || '') : String(value || '');

  const selectedUser = users.find(
    (u) => u.id === currentValueStr || u.name === currentValueStr || u.email === currentValueStr
  );

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (user: UserItem) => {
    if (onChange) {
      onChange(user.id);
    }
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onChange) onChange('');
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div
        onClick={() => !disabled && !readOnly && setIsOpen(!isOpen)}
        className={`sails-input sails-control-user-edit ${isOpen ? 'is-open' : ''} ${disabled || readOnly ? 'is-disabled' : ''}`}
      >
        <div className="sails-control-user-edit__main">
          {selectedUser ? (
            <>
              {selectedUser.avatar ? (
                <img src={selectedUser.avatar} alt={selectedUser.name} className="sails-control-user-avatar sails-control-user-avatar--img" />
              ) : (
                <div className="sails-control-user-avatar">
                  {selectedUser.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="sails-control-user-edit__name">{selectedUser.name}</span>
              <span className="sails-control-user-edit__meta">({selectedUser.email})</span>
            </>
          ) : currentValueStr ? (
            <>
              <User size={14} className="sails-control-user-edit__icon" />
              <span className="sails-control-user-edit__name">{currentValueStr}</span>
            </>
          ) : (
            <>
              <UserCheck size={14} className="sails-control-user-edit__icon" />
              <span className="sails-control-user-edit__placeholder">Select user...</span>
            </>
          )}
        </div>

        <div className="sails-control-user-edit__actions">
          {currentValueStr && !disabled && !readOnly && (
            <button
              type="button"
              onClick={handleClear}
              className="sails-control-user-edit__clear"
            >
              <X size={12} />
            </button>
          )}
          <ChevronDown size={14} className="sails-control-user-edit__icon" />
        </div>
      </div>

      {isOpen && (
        <div className="sails-control-user-dropdown">
          <div className="sails-control-user-dropdown__search">
            <Search size={12} className="sails-control-user-dropdown__search-icon" />
            <input
              type="text"
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or email..."
              className="sails-control-user-dropdown__search-input"
            />
          </div>
          <div className="sails-control-user-dropdown__list">
            {filteredUsers.length === 0 ? (
              <div className="sails-control-user-dropdown__empty">No users found</div>
            ) : (
              filteredUsers.map((user) => {
                const isSelected = selectedUser?.id === user.id || currentValueStr === user.name;
                return (
                  <div
                    key={user.id}
                    onClick={() => handleSelect(user)}
                    className={`sails-control-user-dropdown__option ${isSelected ? 'is-selected' : ''}`}
                  >
                    <div className="sails-control-user-dropdown__option-main">
                      {user.avatar ? (
                        <img src={user.avatar} alt={user.name} className="sails-control-user-avatar sails-control-user-avatar--lg sails-control-user-avatar--img" />
                      ) : (
                        <div className="sails-control-user-avatar sails-control-user-avatar--lg">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="sails-control-user-dropdown__option-text">
                        <span className="sails-control-user-dropdown__option-name">{user.name}</span>
                        <span className="sails-control-user-dropdown__option-email">{user.email}</span>
                      </div>
                    </div>
                    {isSelected && <Check size={14} className="sails-control-user-dropdown__check" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const resolveUser = (value: any, users: UserItem[]): UserItem | null => {
  if (typeof value === 'object' && value) {
    const id = value.id || value.name || value.email;
    if (id) return users.find((u) => u.id === id || u.name === id || u.email === id) || null;
    return null;
  }
  if (typeof value !== 'string' || value.trim() === '') return null;
  return users.find((u) => u.id === value || u.name === value || u.email === value) || null;
};

const UserAvatar: React.FC<{ user?: UserItem | null; size?: 'sm' | 'lg' }> = ({ user, size = 'sm' }) => {
  const cls = `sails-control-user-avatar${size === 'lg' ? ' sails-control-user-avatar--lg' : ''}`;

  if (user?.avatar) {
    return <img src={user.avatar} alt={user.name} className={`${cls} sails-control-user-avatar--img`} />;
  }
  const initial = user?.name ? user.name.trim().charAt(0).toUpperCase() : null;
  return <div className={cls}>{initial || '@'}</div>;
};

const RenderDisplay: React.FC<FieldControlProps> = ({ field, value }) => {
  const { users } = useTenantUsers();

  if (value === undefined || value === null || value === '') {
    return <span>—</span>;
  }

  const user = resolveUser(value, users);
  const displayVal = user?.name || (typeof value === 'object' ? value?.name || value?.email || value?.id : String(value));

  return (
    <div className="sails-control-user-display">
      <UserAvatar user={user} />
      <span>{displayVal}</span>
    </div>
  );
};

export const UserControl: FieldControlPlugin = {
  id: 'control:user',
  name: 'User Selector',
  description: 'Internal user combobox picker',
  iconName: 'UserCheck',
  compatibleTypes: ['user'],
  isDefault: true,

  mockValue: () => DEFAULT_USERS[0]?.id ?? 'usr_001',

  RenderEdit,
  RenderDisplay,
};
