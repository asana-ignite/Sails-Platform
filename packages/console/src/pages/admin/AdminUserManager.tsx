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
  { id: '1', name: 'Alex Thompson', email: 'alex.t@sails.io', role: 'Admin', status: 'Active', lastLogin: '2 mins ago' },
  { id: '2', name: 'Sarah Chen', email: 's.chen@sails.io', role: 'Member', status: 'Active', lastLogin: '1 hour ago' },
  { id: '3', name: 'Marcus Wright', email: 'marcus.w@sails.io', role: 'Member', status: 'Inactive', lastLogin: '2 days ago' },
  { id: '4', name: 'Elena Rodriguez', email: 'elena.r@sails.io', role: 'Guest', status: 'Active', lastLogin: '5 mins ago' },
  { id: '5', name: 'James Wilson', email: 'j.wilson@sails.io', role: 'Member', status: 'Pending', lastLogin: 'Never' },
];

const AdminUserManager: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="sails-user-manager">
      {/* 1. Header Toolbar */}
      <div className="sails-user-manager__toolbar">
        <div className="sails-user-manager__search-wrapper">
          <Search size={18} className="sails-user-manager__search-icon" />
          <input 
            type="text" 
            placeholder="Search by name, email or role..." 
            className="sails-user-manager__search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="sails-user-manager__actions">
          <button className="sails-btn sails-btn--ghost">
            <Filter size={18} />
            <span>Filters</span>
          </button>
          <button className="sails-btn sails-btn--primary">
            <UserPlus size={18} />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {/* 2. User Data Table */}
      <div className="sails-card sails-user-manager__table-wrapper">
        <table className="sails-user-manager__table">
          <thead>
            <tr>
              <th className="sails-user-manager__th sails-user-manager__th--checkbox">
                <input type="checkbox" className="sails-checkbox" />
              </th>
              <th className="sails-user-manager__th">User Identity</th>
              <th className="sails-user-manager__th">Role</th>
              <th className="sails-user-manager__th">Status</th>
              <th className="sails-user-manager__th">Last Activity</th>
              <th className="sails-user-manager__th sails-user-manager__th--actions"></th>
            </tr>
          </thead>
          <tbody>
            {MOCK_USERS.map((user) => (
              <tr key={user.id} className="sails-user-manager__tr">
                <td className="sails-user-manager__td sails-user-manager__td--checkbox">
                  <input type="checkbox" className="sails-checkbox" />
                </td>
                <td className="sails-user-manager__td">
                  <div className="sails-user-manager__identity">
                    <div className="sails-user-manager__avatar">
                      {user.name.charAt(0)}
                    </div>
                    <div className="sails-user-manager__info">
                      <span className="sails-user-manager__name">{user.name}</span>
                      <span className="sails-user-manager__email">{user.email}</span>
                    </div>
                  </div>
                </td>
                <td className="sails-user-manager__td">
                  <div className="sails-user-manager__role-tag">
                    <Shield size={14} />
                    <span>{user.role}</span>
                  </div>
                </td>
                <td className="sails-user-manager__td">
                  <div className={`sails-status-badge sails-status-badge--${user.status.toLowerCase()}`}>
                    <Circle size={8} fill="currentColor" />
                    <span>{user.status}</span>
                  </div>
                </td>
                <td className="sails-user-manager__td">
                  <span className="sails-user-manager__last-login">{user.lastLogin}</span>
                </td>
                <td className="sails-user-manager__td sails-user-manager__td--actions">
                  <button className="sails-user-manager__action-btn">
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
