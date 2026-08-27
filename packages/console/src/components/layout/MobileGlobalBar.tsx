/**
 * MobileGlobalBar — bottom/global bar for mobile navigation.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Search, Bell, LayoutGrid, User } from 'lucide-react';
import './MobileGlobalBar.css';

interface MobileGlobalBarProps {
  onMenuToggle: () => void;
  onSearchToggle: () => void;
  onAppSwitcherToggle: () => void;
  onNotifToggle: () => void;
  isNotifVisible?: boolean;
}

const MobileGlobalBar: React.FC<MobileGlobalBarProps> = ({
  onMenuToggle,
  onSearchToggle,
  onAppSwitcherToggle,
  onNotifToggle,
  isNotifVisible = false,
}) => {
  const navigate = useNavigate();
  const [notifCount, setNotifCount] = useState<number>(0);

  const fetchNotifCount = async () => {
    try {
      const [tasksRes, notifsRes] = await Promise.all([
        fetch('/api/workflow/tasks?count=true').then((r) => r.json()).catch(() => null),
        fetch('/api/notifications?count=true').then((r) => r.json()).catch(() => null),
      ]);
      const tasksPending = tasksRes?.success ? tasksRes.data?.count || 0 : 0;
      const notifsUnread = notifsRes?.success ? notifsRes.data?.unread || 0 : 0;
      setNotifCount(tasksPending + notifsUnread);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchNotifCount();
    const interval = setInterval(fetchNotifCount, 30000);
    const handleCountUpdated = (e: any) => {
      if (typeof e.detail?.count === 'number') {
        setNotifCount(e.detail.count);
      }
    };
    window.addEventListener('sails:notif-count-updated', handleCountUpdated);
    return () => {
      clearInterval(interval);
      window.removeEventListener('sails:notif-count-updated', handleCountUpdated);
    };
  }, []);

  return (
    <nav className="sails-mobile-global-bar">
      <ul className="sails-mobile-global-bar__list">
        <li className="sails-mobile-global-bar__item">
          <button
            className="sails-mobile-global-bar__action"
            onClick={onAppSwitcherToggle}
            title="App Switcher"
          >
            <LayoutGrid size={24} />
          </button>
        </li>
        <li className="sails-mobile-global-bar__item">
          <button
            className="sails-mobile-global-bar__action"
            onClick={onSearchToggle}
            title="Search"
          >
            <Search size={24} />
          </button>
        </li>
        <li className="sails-mobile-global-bar__item">
          <button
            className="sails-mobile-global-bar__action"
            onClick={onMenuToggle}
            title="Menu"
          >
            <Menu size={24} />
          </button>
        </li>
        <li className="sails-mobile-global-bar__item">
          <button
            className={`sails-mobile-global-bar__action ${isNotifVisible ? 'sails-mobile-global-bar__action--active' : ''}`}
            onClick={onNotifToggle}
            title="Notifications & Tasks"
            style={{ position: 'relative' }}
          >
            <Bell size={24} />
            {notifCount > 0 && (
              <span className="sails-mobile-notif-badge">
                {notifCount > 99 ? '99+' : notifCount}
              </span>
            )}
          </button>
        </li>
        <li className="sails-mobile-global-bar__item">
          <button
            className="sails-mobile-global-bar__action sails-mobile-global-bar__action--profile"
            onClick={() => navigate('/settings')}
            title="Settings & Profile"
          >
            <User size={24} />
          </button>
        </li>
      </ul>
    </nav>
  );
};

export default MobileGlobalBar;
