import React from 'react';
import { useLocation } from 'react-router-dom';
import { Layers, Database, Plus, Search } from 'lucide-react';
import { useConsole } from '../contexts/ConsoleContext';
import { ConsoleMenu } from '@sails/shared';
import DynamicIcon from '../components/common/DynamicIcon';
import './DynamicTablePage.css';

const DynamicTablePage: React.FC = () => {
  const { navigationItems } = useConsole();
  const location = useLocation();

  // Helper to normalize paths for comparison
  const normalizePath = (p: string | null) => p ? p.replace(/\/+$/, '').toLowerCase() : '';

  // Find the current menu item to get the correct Label and Icon from metadata
  const findMenu = (menus: ConsoleMenu[]): ConsoleMenu | null => {
    const target = normalizePath(location.pathname);
    for (const menu of menus) {
      if (normalizePath(menu.path) === target) return menu;
      if (menu.children) {
        const found = findMenu(menu.children);
        if (found) return found;
      }
    }
    return null;
  };

  const activeMenu = findMenu(navigationItems);
  const displayTitle = activeMenu?.label || 'Data Table';
  const displaySubtitle = `Managing all records for the ${displayTitle.toLowerCase()} entity.`;
  const iconName = activeMenu?.icon || 'Database';

  return (
    <div className="sails-dynamic-table sails-page-container">
      <header className="sails-page-header sails-dynamic-table__header">
        <div className="sails-page-header__left">
          <div className="sails-page-header__icon-wrapper">
            <DynamicIcon name={iconName} size={24} />
          </div>
          <div>
            <h1 className="sails-page-header__title">{displayTitle}</h1>
            <p className="sails-page-header__subtitle">{displaySubtitle}</p>
          </div>
        </div>
        <div className="sails-page-header__right">
          <button className="sails-btn sails-btn--primary">
            <Plus size={18} />
            <span>Add New</span>
          </button>
        </div>
      </header>

      <section className="sails-dynamic-table__controls">
        <div className="sails-card sails-dynamic-table__toolbar">
          <div className="sails-dynamic-table__search">
            <Search size={18} className="sails-dynamic-table__search-icon" />
            <input 
              type="text" 
              placeholder={`Search ${displayTitle.toLowerCase()}...`} 
              className="sails-dynamic-table__search-input"
            />
          </div>
          <div className="sails-dynamic-table__actions">
            <button className="sails-btn sails-btn--ghost">Filter</button>
            <button className="sails-btn sails-btn--ghost">Export</button>
          </div>
        </div>
      </section>

      <section className="sails-dynamic-table__content">
        <div className="sails-card sails-dynamic-table__placeholder">
          <div className="sails-dynamic-table__empty-state">
            <Layers size={48} className="sails-dynamic-table__empty-icon" />
            <h3>No Records Found</h3>
            <p>You haven't added any data to the {displayTitle.toLowerCase()} table yet.</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default DynamicTablePage;
