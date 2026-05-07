import React from 'react';
import { useLocation } from 'react-router-dom';
import { Layers, Database, Plus, Search } from 'lucide-react';
import { useConsole } from '../contexts/ConsoleContext';
import { ConsoleMenu } from '@klao/shared';
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

  return (
    <div className="klao-dynamic-table">
      <header className="klao-page-header klao-dynamic-table__header">
        <div className="klao-page-header__left">
          <div className="klao-page-header__icon-wrapper">
            <Database size={24} />
          </div>
          <div>
            <h1 className="klao-page-header__title">{displayTitle}</h1>
            <p className="klao-page-header__subtitle">{displaySubtitle}</p>
          </div>
        </div>
        <div className="klao-page-header__right">
          <button className="klao-btn klao-btn--primary">
            <Plus size={18} />
            <span>Add New</span>
          </button>
        </div>
      </header>

      <section className="klao-dynamic-table__controls">
        <div className="klao-card klao-dynamic-table__toolbar">
          <div className="klao-dynamic-table__search">
            <Search size={18} className="klao-dynamic-table__search-icon" />
            <input 
              type="text" 
              placeholder={`Search ${displayTitle.toLowerCase()}...`} 
              className="klao-dynamic-table__search-input"
            />
          </div>
          <div className="klao-dynamic-table__actions">
            <button className="klao-btn klao-btn--ghost">Filter</button>
            <button className="klao-btn klao-btn--ghost">Export</button>
          </div>
        </div>
      </section>

      <section className="klao-dynamic-table__content">
        <div className="klao-card klao-dynamic-table__placeholder">
          <div className="klao-dynamic-table__empty-state">
            <Layers size={48} className="klao-dynamic-table__empty-icon" />
            <h3>No Records Found</h3>
            <p>You haven't added any data to the {displayTitle.toLowerCase()} table yet.</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default DynamicTablePage;
