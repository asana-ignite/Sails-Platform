/**
 * Sidebar — DB-driven navigation rendered from ConsoleContext menus.
 */
import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { localizeFallback } from '../../lib/translate';
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
  const { navigationItems, isLoading, defaultLocale } = useConsole();
  const { t } = useTranslation();
  const location = useLocation();
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
    'sails-sidebar',
    (isCollapsed || isMobileView) ? 'sails-sidebar--collapsed' : '',
    isMobileOpen ? 'sails-sidebar--mobile-open' : ''
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

  // Keep flyout submenus inside the viewport: the flyout is anchored to the
  // item's screen Y, so clamp it after it renders (and again on resize) so it
  // can never extend past the browser bottom edge.
  React.useEffect(() => {
    const clampFlyouts = () => {
      const flyouts = sidebarRef.current?.querySelectorAll<HTMLElement>('.sails-sidebar__submenu--flyout');
      if (!flyouts) return;
      flyouts.forEach((el) => {
        if (!el.style.top) return;
        const top = parseFloat(el.style.top);
        if (isNaN(top)) return;
        const maxTop = window.innerHeight - el.offsetHeight - 8;
        if (top > maxTop) el.style.top = `${Math.max(8, maxTop)}px`;
      });
    };
    clampFlyouts();
    window.addEventListener('resize', clampFlyouts);
    return () => window.removeEventListener('resize', clampFlyouts);
  }, [openMenus]);

  // Auto-expand menu items if they contain the current path
  React.useEffect(() => {
    const currentPath = location.pathname;
    const itemsToOpen: Record<string, boolean> = {};

    const findAndOpen = (items: any[]) => {
      for (const item of items) {
        if (item.children) {
          const hasActiveChild = item.children.some((child: any) => 
            child.path && currentPath === child.path
          );
          if (hasActiveChild) {
            itemsToOpen[item.id] = true;
          }
          findAndOpen(item.children || []); // Search deeper if needed
        }
      }
    };

    findAndOpen(navigationItems);
    setOpenMenus(prev => ({ ...prev, ...itemsToOpen }));
  }, [location.pathname, navigationItems]);

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
      <button className="sails-sidebar__toggle" onClick={onToggle}>
        {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>

      <nav className="sails-sidebar__nav">
        {isLoading ? (
          <div className="sails-sidebar__loading">
            <Spinner size={20} label={t('common.syncing')} />
          </div>
        ) : (
          <ul className="sails-sidebar__menu">
            {navigationItems.map((item) => {
              const hasChildren = item.children && item.children.length > 0;
              const isOpen = openMenus[item.id];
              const menuTop = menuTops[item.id];
              const path = getMenuPath(item);
              const hasActiveChild = hasChildren && item.children?.some((sub: any) => getMenuPath(sub) === location.pathname);

              return (
                <li 
                  key={item.id} 
                  className={`sails-sidebar__item ${isOpen ? 'sails-sidebar__item--open' : ''}`}
                  onMouseEnter={(e) => hasChildren && handleMouseEnter(item.id, e)}
                  onMouseLeave={() => hasChildren && handleMouseLeave(item.id)}
                >
                  <NavLink 
                    to={hasChildren ? '#' : path} 
                    className={({ isActive }) => 
                      `sails-sidebar__link ${(isActive && !hasChildren) || (isEffectivelyCollapsed && hasActiveChild) ? 'sails-sidebar__link--active' : ''} ${hasChildren ? 'sails-sidebar__link--has-children' : ''} ${(!isEffectivelyCollapsed && hasActiveChild) ? 'sails-sidebar__link--has-active-child' : ''}`
                    }
                    onClick={(e) => hasChildren ? toggleSubMenu(item.id, e) : undefined}
                  >
                    <span className="sails-sidebar__icon">
                      <DynamicIcon name={item.icon || 'Circle'} size={18} />
                    </span>
                    {!isEffectivelyCollapsed && (
                      <>
                        <span className="sails-sidebar__text">{localizeFallback(item.translationKey, (item as any).labelI18n ?? item.label, defaultLocale)}</span>
                        {hasChildren && (
                          <span className="sails-sidebar__chevron">
                            <ChevronRight size={14} style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.3s' }} />
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>

                  {hasChildren && (
                    <ul 
                      className={`sails-sidebar__submenu ${isEffectivelyCollapsed ? 'sails-sidebar__submenu--flyout' : ''}`}
                      style={isEffectivelyCollapsed && isOpen ? { top: `${menuTop}px` } : {}}
                    >
                      {item.children?.map((sub) => (
                        <li key={sub.id} className="sails-sidebar__submenu-item">
                          <NavLink 
                            to={getMenuPath(sub)} 
                            className={({ isActive }) => 
                              `sails-sidebar__submenu-link ${isActive ? 'sails-sidebar__submenu-link--active' : ''}`
                            }
                          >
                            <span className="sails-sidebar__submenu-icon">
                              <DynamicIcon name={sub.icon || 'Circle'} size={16} />
                            </span>
                            <span className="sails-sidebar__submenu-text">{localizeFallback(sub.translationKey, (sub as any).labelI18n ?? sub.label, defaultLocale)}</span>
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

      <div className="sails-sidebar__footer">
        <div 
          className={`sails-sidebar__status ${showStatus ? 'sails-sidebar__status--active' : ''}`}
          onClick={handleStatusClick}
        >
          <div className="sails-sidebar__status-indicator"></div>
          {(!isEffectivelyCollapsed || showStatus) && (
            <span className="sails-sidebar__status-text">{t('common.coreSystemVersion')}</span>
          )}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
