import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useConsole } from '../../contexts/ConsoleContext';
import DynamicIcon from '../common/DynamicIcon';
import './Sidebar.css';

import Spinner from '../common/Spinner';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  isMobileOpen?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle, isMobileOpen }) => {
  const { navigationItems, isLoading } = useConsole();
  const [showStatus, setShowStatus] = React.useState(false);
  const [isMobileView, setIsMobileView] = React.useState(window.innerWidth <= 768);
  const statusTimeoutRef = React.useRef<any>(null);

  // Sync mobile view state on resize
  React.useEffect(() => {
    const handleResize = () => setIsMobileView(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const sidebarClasses = [
    'klao-sidebar',
    (isCollapsed || isMobileView) ? 'klao-sidebar--collapsed' : '',
    isMobileOpen ? 'klao-sidebar--mobile-open' : ''
  ].filter(Boolean).join(' ');

  // Effectively collapsed if desktop-collapsed OR if on mobile
  const isEffectivelyCollapsed = isCollapsed || isMobileView;

  const handleStatusClick = () => {
    if (isEffectivelyCollapsed) {
      if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
      setShowStatus(true);
      statusTimeoutRef.current = setTimeout(() => {
        setShowStatus(false);
      }, 3000); // Hide after 3 seconds
    }
  };

  React.useEffect(() => {
    return () => {
      if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    };
  }, []);

  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const [menuTops, setMenuTops] = useState<Record<string, number>>({});
  const sidebarRef = React.useRef<HTMLDivElement>(null);
  const closeTimeoutRef = React.useRef<Record<string, any>>({});

  const toggleSubMenu = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    setOpenMenus(prev => ({ ...prev, [id]: !prev[id] }));
    if (isEffectivelyCollapsed) {
      const rect = e.currentTarget.getBoundingClientRect();
      setMenuTops(prev => ({ ...prev, [id]: rect.top }));
    }
  };

  const handleMouseLeave = (id: string) => {
    if (!isEffectivelyCollapsed) return;
    if (closeTimeoutRef.current[id]) clearTimeout(closeTimeoutRef.current[id]);
    closeTimeoutRef.current[id] = setTimeout(() => {
      setOpenMenus(prev => ({ ...prev, [id]: false }));
    }, 500);
  };

  const handleMouseEnter = (id: string, e: React.MouseEvent) => {
    if (closeTimeoutRef.current[id]) clearTimeout(closeTimeoutRef.current[id]);
  };

  // Click-away logic
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!isEffectivelyCollapsed) return;
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        setOpenMenus({});
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      Object.values(closeTimeoutRef.current).forEach(clearTimeout);
    };
  }, [isEffectivelyCollapsed]);

  const getMenuPath = (item: any) => {
    // Standardized: Always use the path from the database metadata.
    // This supports the new App-First routing (e.g., /crm/table/leads)
    return item.path || '/';
  };

  return (
    <aside className={sidebarClasses} ref={sidebarRef}>
      <button className="klao-sidebar__toggle" onClick={onToggle}>
        {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>

      <nav className="klao-sidebar__nav">
        {isLoading ? (
          <div className="klao-sidebar__loading">
            <Spinner size={20} label="Syncing..." />
          </div>
        ) : (
          <ul className="klao-sidebar__menu">
            {navigationItems.map((item) => {
              const hasChildren = item.children && item.children.length > 0;
              const isOpen = openMenus[item.id];
              const menuTop = menuTops[item.id];
              const path = getMenuPath(item);

              return (
                <li 
                  key={item.id} 
                  className={`klao-sidebar__item ${isOpen ? 'klao-sidebar__item--open' : ''}`}
                  onMouseEnter={(e) => hasChildren && handleMouseEnter(item.id, e)}
                  onMouseLeave={() => hasChildren && handleMouseLeave(item.id)}
                >
                  <NavLink 
                    to={hasChildren ? '#' : path} 
                    className={({ isActive }) => 
                      `klao-sidebar__link ${isActive && !hasChildren ? 'klao-sidebar__link--active' : ''} ${hasChildren ? 'klao-sidebar__link--has-children' : ''}`
                    }
                    onClick={(e) => hasChildren ? toggleSubMenu(item.id, e) : undefined}
                  >
                    <span className="klao-sidebar__icon">
                      <DynamicIcon name={item.icon || 'Circle'} size={18} />
                    </span>
                    {!isEffectivelyCollapsed && (
                      <>
                        <span className="klao-sidebar__text">{item.label}</span>
                        {hasChildren && (
                          <span className="klao-sidebar__chevron">
                            <ChevronRight size={14} style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.3s' }} />
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>

                  {hasChildren && (
                    <ul 
                      className={`klao-sidebar__submenu ${isEffectivelyCollapsed ? 'klao-sidebar__submenu--flyout' : ''}`}
                      style={isEffectivelyCollapsed && isOpen ? { top: `${menuTop}px` } : {}}
                    >
                      {item.children?.map((sub) => (
                        <li key={sub.id} className="klao-sidebar__submenu-item">
                          <NavLink 
                            to={getMenuPath(sub)} 
                            className={({ isActive }) => 
                              `klao-sidebar__submenu-link ${isActive ? 'klao-sidebar__submenu-link--active' : ''}`
                            }
                          >
                            <span className="klao-sidebar__submenu-icon">
                              <DynamicIcon name={sub.icon || 'Circle'} size={16} />
                            </span>
                            <span className="klao-sidebar__submenu-text">{sub.label}</span>
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      <div className="klao-sidebar__footer">
        <div 
          className={`klao-sidebar__status ${showStatus ? 'klao-sidebar__status--active' : ''}`}
          onClick={handleStatusClick}
        >
          <div className="klao-sidebar__status-indicator"></div>
          {(!isEffectivelyCollapsed || showStatus) && (
            <span className="klao-sidebar__status-text">Core System v1.0</span>
          )}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
