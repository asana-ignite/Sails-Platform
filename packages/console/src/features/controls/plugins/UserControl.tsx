import React, { useState, useEffect, useRef } from 'react';
import { User, UserCheck, Search, ChevronDown, X, Check } from 'lucide-react';
import type { FieldControlPlugin, FieldControlProps } from '../types';

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

const RenderEdit: React.FC<FieldControlProps> = ({ field, value, onChange, disabled, readOnly }) => {
  const [users, setUsers] = useState<UserItem[]>(DEFAULT_USERS);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    fetch('/api/tenant/users')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (isMounted && Array.isArray(data) && data.length > 0) {
          const mapped = data.map((u: any) => ({
            id: u.id,
            name: u.name || u.email,
            email: u.email,
            avatar: u.image || u.avatar
          }));
          setUsers(mapped);
        }
      })
      .catch(() => {
        // Keep DEFAULT_USERS fallback
      });
    return () => { isMounted = false; };
  }, []);

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

  // Auto-populate default current user if empty and defaultToCurrentUser is enabled
  useEffect(() => {
    if (!value && defaultToCurrentUser && users.length > 0 && onChange) {
      onChange(users[0].id);
    }
  }, [value, defaultToCurrentUser, users, onChange]);

  const currentValueStr = typeof value === 'object' ? (value?.id || value?.name || '') : String(value || '');

  const selectedUser = users.find(
    u => u.id === currentValueStr || u.name === currentValueStr || u.email === currentValueStr
  );

  const filteredUsers = users.filter(
    u => u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
    <div ref={containerRef} className="relative w-full">
      <div
        onClick={() => !disabled && !readOnly && setIsOpen(!isOpen)}
        className={`sails-input sails-control-user-edit flex items-center justify-between cursor-pointer transition-colors min-h-[36px] ${
          isOpen ? 'border-cyan-500' : ''
        } ${disabled || readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          {selectedUser ? (
            <>
              {selectedUser.avatar ? (
                <img src={selectedUser.avatar} alt={selectedUser.name} className="w-5 h-5 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center text-[10px] font-semibold shrink-0">
                  {selectedUser.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="truncate font-medium text-slate-200">{selectedUser.name}</span>
              <span className="truncate text-slate-400 text-[11px]">({selectedUser.email})</span>
            </>
          ) : currentValueStr ? (
            <>
              <User size={14} className="text-slate-400 shrink-0" />
              <span className="truncate text-slate-200">{currentValueStr}</span>
            </>
          ) : (
            <>
              <UserCheck size={14} className="text-slate-500 shrink-0" />
              <span className="text-slate-500">Select user...</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-1">
          {currentValueStr && !disabled && !readOnly && (
            <button
              type="button"
              onClick={handleClear}
              className="text-slate-400 hover:text-slate-200 p-0.5 rounded"
            >
              <X size={12} />
            </button>
          )}
          <ChevronDown size={14} className="text-slate-400" />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden text-xs">
          <div className="p-2 border-b border-slate-800 flex items-center gap-2">
            <Search size={12} className="text-slate-400 shrink-0" />
            <input
              type="text"
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or email..."
              className="bg-transparent border-none outline-none w-full text-xs text-slate-200 placeholder:text-slate-500"
            />
          </div>
          <div className="max-h-48 overflow-y-auto py-1">
            {filteredUsers.length === 0 ? (
              <div className="px-3 py-2 text-slate-500 text-center">No users found</div>
            ) : (
              filteredUsers.map((user) => {
                const isSelected = selectedUser?.id === user.id || currentValueStr === user.name;
                return (
                  <div
                    key={user.id}
                    onClick={() => handleSelect(user)}
                    className={`flex items-center justify-between px-3 py-2 cursor-pointer transition-colors ${
                      isSelected ? 'bg-cyan-500/10 text-cyan-300' : 'hover:bg-slate-800/80 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      {user.avatar ? (
                        <img src={user.avatar} alt={user.name} className="w-6 h-6 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center text-[11px] font-semibold shrink-0">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex flex-col overflow-hidden">
                        <span className="font-medium text-slate-200 truncate">{user.name}</span>
                        <span className="text-[11px] text-slate-400 truncate">{user.email}</span>
                      </div>
                    </div>
                    {isSelected && <Check size={14} className="text-cyan-400 shrink-0 ml-2" />}
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

const RenderDisplay: React.FC<FieldControlProps> = ({ field, value }) => {
  if (value === undefined || value === null || value === '') {
    return <span className="text-slate-500 text-xs">—</span>;
  }

  const displayVal = typeof value === 'object' ? value?.name || value?.email || value?.id : String(value);
  const initial = displayVal.charAt(0).toUpperCase();

  return (
    <div className="sails-control-user-display inline-flex items-center gap-2 text-xs font-medium text-slate-200">
      <div className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center text-[10px] font-semibold shrink-0">
        {initial}
      </div>
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

  RenderEdit,
  RenderDisplay,
};
