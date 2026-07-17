import React, { useState, useRef, useEffect } from 'react';
import {
   Search, Bell, User, LayoutGrid,
   Menu, Settings, LogOut, ChevronDown
} from 'lucide-react';
import { useConsole } from '../../contexts/ConsoleContext';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import DynamicIcon from '../common/DynamicIcon';
import logo from '../../assets/logo.png';
import './Topbar.css';
import Spinner from '../common/Spinner';

interface TopbarProps {
  onMenuToggle: () => void;
  isMobileSearchVisible?: boolean;
}

const Topbar: React.FC<TopbarProps> = ({ onMenuToggle, isMobileSearchVisible }) => {
  const { apps, activeApp, setActiveApp, isLoading } = useConsole();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  
  const switcherRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<any>(null);

  const handleAppClick = (appId: string) => {
    setActiveApp(appId);
    setIsSwitcherOpen(false);
  };

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsClosing(false);
    setIsSwitcherOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsClosing(true);
      // Wait for fade-out animation (0.3s)
      timeoutRef.current = setTimeout(() => {
        setIsSwitcherOpen(false);
        setIsClosing(false);
      }, 300);
    }, 500); // 0.5 second delay
  };

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(event.target as Node)) {
        setIsSwitcherOpen(false);
        setIsClosing(false);
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const formatRole = (role: string | undefined) => {
    if (!role) return 'User';
    switch (role.toUpperCase()) {
      case 'MEMBER': return 'Member';
      case 'TENANT_ADMIN': return 'Administrator';
      case 'SUPER_ADMIN': return 'Super Administrator';
      case 'ADMIN': return 'Administrator';
      default: return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
    }
  };

  return (
    <header className={`klao-topbar ${isMobileSearchVisible ? 'klao-topbar--mobile-visible' : ''}`}>
      <div className="klao-topbar__left">
        <button className="klao-topbar__menu-trigger" onClick={onMenuToggle}>
          <Menu size={20} />
        </button>
        <div className="klao-topbar__logo">
          <img src={logo} alt="KLAO Logo" className="klao-topbar__logo-icon" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
          <span className="klao-topbar__logo-text">KLAO</span>
        </div>
      </div>

      <div className="klao-topbar__center">
        <div className="klao-topbar__search">
          <Search className="klao-topbar__search-icon" size={18} />
          <input
            type="text"
            className="klao-topbar__search-input"
            placeholder="Search leads, contacts, orders..."
          />
        </div>
      </div>

      <div className="klao-topbar__right">
        <div
          className="klao-topbar__action-wrapper"
          ref={switcherRef}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <button
            className={`klao-topbar__action ${isSwitcherOpen ? 'klao-topbar__action--active' : ''}`}
            title="App Switcher"
          >
            <LayoutGrid size={20} />
          </button>

          {isSwitcherOpen && (
            <div className={`klao-app-switcher ${isClosing ? 'klao-app-switcher--closing' : ''}`}>
              {isLoading ? (
                <div className="klao-app-switcher__loading">
                  <Spinner size={32} label="Loading Apps..." />
                </div>
              ) : (
                <div className="klao-app-switcher__grid">
                  {apps.map((app) => (
                    <div
                      key={app.id}
                      className={`klao-app-switcher__item ${activeApp?.id === app.id ? 'klao-app-switcher__item--active' : ''}`}
                      onClick={() => handleAppClick(app.id)}
                    >
                      <div className="klao-app-switcher__icon">
                        <DynamicIcon name={app.icon || 'Box'} size={20} />
                      </div>
                      <span className="klao-app-switcher__name">{app.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <button className="klao-topbar__action">
          <Bell size={20} />
          <span className="klao-topbar__badge"></span>
        </button>

        <div className="klao-topbar__profile-container" ref={profileRef}>
          <div 
            className={`klao-topbar__profile ${isProfileOpen ? 'klao-topbar__profile--active' : ''}`} 
            onClick={() => setIsProfileOpen(!isProfileOpen)}
          >
            <div className="klao-topbar__avatar">
              {user?.image ? (
                <img src={user.image} alt={user.name} style={{ borderRadius: '50%', width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <User size={20} />
              )}
            </div>
            <div className="klao-topbar__user-info">
              <span className="klao-topbar__user-name">{user?.name || 'Guest'}</span>
              <span className="klao-topbar__user-role">{formatRole(user?.role)}</span>
            </div>
            <ChevronDown size={14} className={`klao-topbar__profile-chevron ${isProfileOpen ? 'klao-topbar__profile-chevron--active' : ''}`} />
          </div>

          {isProfileOpen && (
            <div className="klao-profile-dropdown">
              <div className="klao-profile-dropdown__item" onClick={() => { navigate('/settings/profile'); setIsProfileOpen(false); }}>
                <Settings size={16} />
                <span>Setting</span>
              </div>
              <div className="klao-profile-dropdown__item klao-profile-dropdown__item--danger" onClick={logout}>
                <LogOut size={16} />
                <span>Logout</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Topbar;
