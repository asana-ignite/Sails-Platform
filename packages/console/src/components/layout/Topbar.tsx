/**
 * Topbar — page header strip (app switcher, search, user menu).
 */
import React, { useState, useRef, useEffect } from 'react';
import {
   Search, Bell, User, LayoutGrid,
   Menu, Settings, LogOut, ChevronDown, Languages
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { safeT as translate, localizeFallback } from '../../lib/translate';
import { useConsole } from '../../contexts/ConsoleContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useI18nLocale } from '../../contexts/I18nContext';
import { useNavigate } from 'react-router-dom';
import DynamicIcon from '../common/DynamicIcon';
import './Topbar.css';
import Spinner from '../common/Spinner';
import { NotificationDropdown } from './NotificationDropdown';

interface TopbarProps {
  onMenuToggle: () => void;
  isMobileSearchVisible?: boolean;
}

const Topbar: React.FC<TopbarProps> = ({ onMenuToggle, isMobileSearchVisible }) => {
  const { apps, activeApp, setActiveApp, isLoading, defaultLocale } = useConsole();
  const { user, logout } = useAuth();
  const { logoLightUrl, logoDarkUrl, themeMode } = useTheme();
  const { t } = useTranslation();
  const { locale, setLocale, availableLocales } = useI18nLocale();
  const navigate = useNavigate();
  
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  
  const switcherRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
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
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
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
    if (!role) return t('common.role.user');
    switch (role.toUpperCase()) {
      case 'MEMBER': return t('common.role.member');
      case 'TENANT_ADMIN': return t('common.role.administrator');
      case 'SUPER_ADMIN': return t('common.role.super_administrator');
      case 'ADMIN': return t('common.role.administrator');
      default: return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
    }
  };

  const [pendingTaskCount, setPendingTaskCount] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;
    const fetchPendingTaskCount = async () => {
      try {
        const [tasksRes, notifsRes] = await Promise.all([
          fetch('/api/workflow/tasks?count=true').then((r) => r.json()).catch(() => null),
          fetch('/api/notifications?count=true').then((r) => r.json()).catch(() => null),
        ]);
        if (isMounted) {
          const taskCount = tasksRes?.success ? (tasksRes.data.count || 0) : 0;
          const notifCount = notifsRes?.success ? (notifsRes.data.unread || 0) : 0;
          setPendingTaskCount(taskCount + notifCount);
        }
      } catch {
        // Silently catch network failures
      }
    };

    fetchPendingTaskCount();
    const interval = setInterval(fetchPendingTaskCount, 30000); // 30s poll

    const handleCountUpdate = (e: any) => {
      if (isMounted && typeof e.detail?.count === 'number') {
        setPendingTaskCount(e.detail.count);
      }
    };

    window.addEventListener('sails:notif-count-updated', handleCountUpdate);

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener('sails:notif-count-updated', handleCountUpdate);
    };
  }, []);

  return (
    <header className={`sails-topbar ${isMobileSearchVisible ? 'sails-topbar--mobile-visible' : ''}`}>
      <div className="sails-topbar__left">
        <button className="sails-topbar__menu-trigger" onClick={onMenuToggle}>
          <Menu size={20} />
        </button>
        <div className="sails-topbar__logo">
          <img src={themeMode === 'dark' ? logoDarkUrl : logoLightUrl} alt="SAILS Logo" className="sails-topbar__logo-icon" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
          <span className="sails-topbar__logo-text">Sails</span>
        </div>
      </div>

      <div className="sails-topbar__center">
        <div className="sails-topbar__search">
          <Search className="sails-topbar__search-icon" size={18} />
          <input
            type="text"
            className="sails-topbar__search-input"
            placeholder={t('common.searchPlaceholder')}
          />
        </div>
      </div>

      <div className="sails-topbar__right">
        <div className="sails-notif-wrapper" ref={notifRef}>
          <button
            className={`sails-topbar__action ${isNotifOpen ? 'sails-topbar__action--active' : ''}`}
            title="Notifications & Approvals"
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Bell size={20} />
            {pendingTaskCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  background: '#e11d48',
                  color: '#ffffff',
                  fontSize: 10,
                  fontWeight: 700,
                  borderRadius: 10,
                  minWidth: 17,
                  height: 17,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px',
                  lineHeight: 1,
                  border: '2px solid var(--sails-bg-topbar, #ffffff)',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                  pointerEvents: 'none',
                }}
              >
                {pendingTaskCount > 99 ? '99+' : pendingTaskCount}
              </span>
            )}
          </button>

          {isNotifOpen && (
            <NotificationDropdown onClose={() => setIsNotifOpen(false)} />
          )}
        </div>

        <div
          className="sails-topbar__action-wrapper"
          ref={switcherRef}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <button
            className={`sails-topbar__action ${isSwitcherOpen ? 'sails-topbar__action--active' : ''}`}
            title={t('common.appSwitcher')}
          >
            <LayoutGrid size={20} />
          </button>

          {isSwitcherOpen && (
            <div className={`sails-app-switcher ${isClosing ? 'sails-app-switcher--closing' : ''}`}>
              {isLoading ? (
                <div className="sails-app-switcher__loading">
                  <Spinner size={32} label={t('common.loadingApps')} />
                </div>
              ) : (
                <div className="sails-app-switcher__grid">
                  {apps.map((app) => (
                    <div
                      key={app.id}
                      className={`sails-app-switcher__item ${activeApp?.id === app.id ? 'sails-app-switcher__item--active' : ''}`}
                      onClick={() => handleAppClick(app.id)}
                    >
                      <div className="sails-app-switcher__icon">
                        <DynamicIcon name={app.icon || 'Box'} size={20} />
                      </div>
                      <span className="sails-app-switcher__name">{localizeFallback(app.translationKey, (app as any).nameI18n ?? app.name, defaultLocale)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>


        <div className="sails-topbar__profile-container" ref={profileRef}>
          <div 
            className={`sails-topbar__profile ${isProfileOpen ? 'sails-topbar__profile--active' : ''}`} 
            onClick={() => setIsProfileOpen(!isProfileOpen)}
          >
            <div className="sails-topbar__avatar">
              {user?.image ? (
                <img src={user.image} alt={user.name} style={{ borderRadius: '50%', width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <User size={20} />
              )}
            </div>
            <div className="sails-topbar__user-info">
              <span className="sails-topbar__user-name">{user?.name || t('common.guest')}</span>
              <span className="sails-topbar__user-role">{formatRole(user?.role)}</span>
            </div>
            <ChevronDown size={14} className={`sails-topbar__profile-chevron ${isProfileOpen ? 'sails-topbar__profile-chevron--active' : ''}`} />
          </div>

          {isProfileOpen && (
            <div className="sails-profile-dropdown">
              <div className="sails-profile-dropdown__section">
                {availableLocales.map((l) => (
                  <div
                    key={l.code}
                    className={`sails-profile-dropdown__item ${locale === l.code ? 'sails-profile-dropdown__item--active' : ''}`}
                    onClick={() => { setLocale(l.code); }}
                  >
                    <Languages size={16} />
                    <span>{l.label}</span>
                  </div>
                ))}
              </div>
              <div className="sails-profile-dropdown__divider" />
              <div className="sails-profile-dropdown__item" onClick={() => { navigate('/settings/profile'); setIsProfileOpen(false); }}>
                <Settings size={16} />
                <span>{t('common.settings')}</span>
              </div>
              <div className="sails-profile-dropdown__item sails-profile-dropdown__item--danger" onClick={logout}>
                <LogOut size={16} />
                <span>{t('common.logout')}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Topbar;
