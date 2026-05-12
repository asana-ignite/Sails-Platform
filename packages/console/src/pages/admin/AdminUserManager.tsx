import React, { useState } from 'react';
import { Search, Plus, MoreHorizontal, Mail, Shield, Circle, UserPlus, Filter } from 'lucide-react';

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
  { id: '1', name: 'Alex Thompson', email: 'alex.t@inidos.io', role: 'Admin', status: 'Active', lastLogin: '2 mins ago' },
  { id: '2', name: 'Sarah Chen', email: 's.chen@inidos.io', role: 'Member', status: 'Active', lastLogin: '1 hour ago' },
  { id: '3', name: 'Marcus Wright', email: 'marcus.w@inidos.io', role: 'Member', status: 'Inactive', lastLogin: '2 days ago' },
  { id: '4', name: 'Elena Rodriguez', email: 'elena.r@inidos.io', role: 'Guest', status: 'Active', lastLogin: '5 mins ago' },
  { id: '5', name: 'James Wilson', email: 'j.wilson@inidos.io', role: 'Member', status: 'Pending', lastLogin: 'Never' },
];

const AdminUserManager: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="inidos-user-manager">
      {/* 1. Header Toolbar */}
      <div className="inidos-user-manager__toolbar">
        <div className="inidos-user-manager__search-wrapper">
          <Search size={18} className="inidos-user-manager__search-icon" />
          <input 
            type="text" 
            placeholder="Search by name, email or role..." 
            className="inidos-user-manager__search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="inidos-user-manager__actions">
          <button className="inidos-btn inidos-btn--ghost">
            <Filter size={18} />
            <span>Filters</span>
          </button>
          <button className="inidos-btn inidos-btn--primary">
            <UserPlus size={18} />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {/* 2. User Data Table */}
      <div className="inidos-card inidos-user-manager__table-wrapper">
        <table className="inidos-user-manager__table">
          <thead>
            <tr>
              <th className="inidos-user-manager__th inidos-user-manager__th--checkbox">
                <input type="checkbox" className="inidos-checkbox" />
              </th>
              <th className="inidos-user-manager__th">User Identity</th>
              <th className="inidos-user-manager__th">Role</th>
              <th className="inidos-user-manager__th">Status</th>
              <th className="inidos-user-manager__th">Last Activity</th>
              <th className="inidos-user-manager__th inidos-user-manager__th--actions"></th>
            </tr>
          </thead>
          <tbody>
            {MOCK_USERS.map((user) => (
              <tr key={user.id} className="inidos-user-manager__tr">
                <td className="inidos-user-manager__td inidos-user-manager__td--checkbox">
                  <input type="checkbox" className="inidos-checkbox" />
                </td>
                <td className="inidos-user-manager__td">
                  <div className="inidos-user-manager__identity">
                    <div className="inidos-user-manager__avatar">
                      {user.name.charAt(0)}
                    </div>
                    <div className="inidos-user-manager__info">
                      <span className="inidos-user-manager__name">{user.name}</span>
                      <span className="inidos-user-manager__email">{user.email}</span>
                    </div>
                  </div>
                </td>
                <td className="inidos-user-manager__td">
                  <div className="inidos-user-manager__role-tag">
                    <Shield size={14} />
                    <span>{user.role}</span>
                  </div>
                </td>
                <td className="inidos-user-manager__td">
                  <div className={`inidos-status-badge inidos-status-badge--${user.status.toLowerCase()}`}>
                    <Circle size={8} fill="currentColor" />
                    <span>{user.status}</span>
                  </div>
                </td>
                <td className="inidos-user-manager__td">
                  <span className="inidos-user-manager__last-login">{user.lastLogin}</span>
                </td>
                <td className="inidos-user-manager__td inidos-user-manager__td--actions">
                  <button className="inidos-user-manager__action-btn">
                    <MoreHorizontal size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminUserManager;
