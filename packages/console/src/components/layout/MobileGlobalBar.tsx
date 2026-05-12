import React from 'react';
import { Grid, Menu, Search, Bell, LayoutGrid, User } from 'lucide-react';


import './MobileGlobalBar.css';

interface MobileGlobalBarProps {
  onMenuToggle: () => void;
  onSearchToggle: () => void;
  onAppSwitcherToggle: () => void;
}

const MobileGlobalBar: React.FC<MobileGlobalBarProps> = ({
  onMenuToggle,
  onSearchToggle,
  onAppSwitcherToggle
}) => {
  return (
    <nav className="inidos-mobile-global-bar">
      <ul className="inidos-mobile-global-bar__list">
        <li className="inidos-mobile-global-bar__item">
          <button className="inidos-mobile-global-bar__action" onClick={onAppSwitcherToggle}>
            <LayoutGrid size={28} />
          </button>
        </li>
        <li className="inidos-mobile-global-bar__item">
          <button className="inidos-mobile-global-bar__action" onClick={onSearchToggle}>
            <Search size={28} />
          </button>
        </li>
        <li className="inidos-mobile-global-bar__item">
          <button className="inidos-mobile-global-bar__action" onClick={onMenuToggle}>
            <Menu size={28} />
          </button>
        </li>


        <li className="inidos-mobile-global-bar__item">
          <button className="inidos-mobile-global-bar__action">
            <Bell size={28} />
          </button>
        </li>
        <li className="inidos-mobile-global-bar__item">
          <button className="inidos-mobile-global-bar__action inidos-mobile-global-bar__action--profile">
            <User size={28} />
          </button>
        </li>
      </ul>
    </nav>
  );
};

export default MobileGlobalBar;
