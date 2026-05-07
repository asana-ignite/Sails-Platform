import React, { useState, useRef, useEffect } from 'react';
import {
   Search, Bell, User, LayoutGrid,
   Menu
} from 'lucide-react';
import { useConsole } from '../../contexts/ConsoleContext';
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
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);
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

  // Close switcher when clicking outside
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
    };

    if (isSwitcherOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isSwitcherOpen]);

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
        <div className="klao-topbar__profile">
          <div className="klao-topbar__avatar">
            <User size={20} />
          </div>
          <div className="klao-topbar__user-info">
            <span className="klao-topbar__user-name">Charlie Stone</span>
            <span className="klao-topbar__user-role">Lead Admin</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
