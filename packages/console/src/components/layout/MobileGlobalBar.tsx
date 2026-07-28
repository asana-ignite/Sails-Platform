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
    <nav className="sails-mobile-global-bar">
      <ul className="sails-mobile-global-bar__list">
        <li className="sails-mobile-global-bar__item">
          <button className="sails-mobile-global-bar__action" onClick={onAppSwitcherToggle}>
            <LayoutGrid size={28} />
          </button>
        </li>
        <li className="sails-mobile-global-bar__item">
          <button className="sails-mobile-global-bar__action" onClick={onSearchToggle}>
            <Search size={28} />
          </button>
        </li>
        <li className="sails-mobile-global-bar__item">
          <button className="sails-mobile-global-bar__action" onClick={onMenuToggle}>
            <Menu size={28} />
          </button>
        </li>


        <li className="sails-mobile-global-bar__item">
          <button className="sails-mobile-global-bar__action">
            <Bell size={28} />
          </button>
        </li>
        <li className="sails-mobile-global-bar__item">
          <button className="sails-mobile-global-bar__action sails-mobile-global-bar__action--profile">
            <User size={28} />
          </button>
        </li>
      </ul>
    </nav>
  );
};

export default MobileGlobalBar;
