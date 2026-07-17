import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useConsole, ConsoleMenu } from '../../contexts/ConsoleContext';
import DynamicIcon from '../common/DynamicIcon';
import './MobileNav.css';

interface MobileNavProps {
  isVisible: boolean;
}

const MobileNav: React.FC<MobileNavProps> = ({ isVisible }) => {
  const { navigationItems, isLoading } = useConsole();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const navRef = React.useRef<HTMLElement>(null);

  // Click-away logic
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setExpandedId(null);
      }
    };
    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isVisible]);

  const getMenuPath = (item: any) => {
    if (item.actionType === 'table') {
      return `/table/${item.label.toLowerCase()}`;
    }
    return item.path || '/';
  };

  const handleItemClick = (item: ConsoleMenu, e: React.MouseEvent) => {
    if (item.children && item.children.length > 0) {
      e.preventDefault();
      setExpandedId(item.id);
    }
  };

  const activeFolder = navigationItems.find(item => item.id === expandedId);

  return (
    <nav 
      ref={navRef}
      className={`klao-mobile-nav ${isVisible ? 'klao-mobile-nav--visible' : ''} ${expandedId ? 'klao-mobile-nav--expanded' : ''}`}
    >
      <div className="klao-mobile-nav__container">
        {isLoading ? (
          <div className="klao-mobile-nav__loading">Loading...</div>
        ) : (
          <>
            {/* Main Switcher Grid */}
            <div className={`klao-mobile-nav__grid ${expandedId ? 'klao-mobile-nav__grid--hidden' : ''}`}>
              {navigationItems.map((item) => (
                <NavLink 
                  key={item.id} 
                  to={getMenuPath(item)}
                  className="klao-mobile-nav__card"
                  onClick={(e) => handleItemClick(item, e)}
                >
                  <div className="klao-mobile-nav__icon-box">
                    <DynamicIcon name={item.icon || 'Circle'} size={24} />
                  </div>

                  <span className="klao-mobile-nav__label">{item.label}</span>
                  {item.children && item.children.length > 0 && <div className="klao-mobile-nav__folder-dot" />}
                </NavLink>
              ))}
            </div>

            {/* Smart Folder View */}
            <div className={`klao-mobile-nav__folder ${expandedId ? 'klao-mobile-nav__folder--visible' : ''}`}>
              <div className="klao-mobile-nav__folder-header">
                <button className="klao-mobile-nav__back" onClick={() => setExpandedId(null)}>
                  <ChevronLeft size={20} />
                  <span>{activeFolder?.label || 'Back'}</span>
                </button>
              </div>
              <div className="klao-mobile-nav__sub-grid">
                {activeFolder?.children?.map((sub) => (
                  <NavLink 
                    key={sub.id} 
                    to={getMenuPath(sub)}
                    className="klao-mobile-nav__sub-card"
                    onClick={() => setExpandedId(null)}
                  >
                    <div className="klao-mobile-nav__sub-icon">
                      <DynamicIcon name={sub.icon || 'Circle'} size={18} />
                    </div>
                    <span className="klao-mobile-nav__sub-label">{sub.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </nav>
  );
};

export default MobileNav;


