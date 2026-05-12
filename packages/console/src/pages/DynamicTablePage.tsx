import React from 'react';
import { useLocation } from 'react-router-dom';
import { Layers, Database, Plus, Search } from 'lucide-react';
import { useConsole } from '../contexts/ConsoleContext';
import { ConsoleMenu } from '@inidos/shared';
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
    <div className="inidos-dynamic-table inidos-page-container">
      <header className="inidos-page-header inidos-dynamic-table__header">
        <div className="inidos-page-header__left">
          <div className="inidos-page-header__icon-wrapper">
            <DynamicIcon name={iconName} size={24} />
          </div>
          <div>
            <h1 className="inidos-page-header__title">{displayTitle}</h1>
            <p className="inidos-page-header__subtitle">{displaySubtitle}</p>
          </div>
        </div>
        <div className="inidos-page-header__right">
          <button className="inidos-btn inidos-btn--primary">
            <Plus size={18} />
            <span>Add New</span>
          </button>
        </div>
      </header>

      <section className="inidos-dynamic-table__controls">
        <div className="inidos-card inidos-dynamic-table__toolbar">
          <div className="inidos-dynamic-table__search">
            <Search size={18} className="inidos-dynamic-table__search-icon" />
            <input 
              type="text" 
              placeholder={`Search ${displayTitle.toLowerCase()}...`} 
              className="inidos-dynamic-table__search-input"
            />
          </div>
          <div className="inidos-dynamic-table__actions">
            <button className="inidos-btn inidos-btn--ghost">Filter</button>
            <button className="inidos-btn inidos-btn--ghost">Export</button>
          </div>
        </div>
      </section>

      <section className="inidos-dynamic-table__content">
        <div className="inidos-card inidos-dynamic-table__placeholder">
          <div className="inidos-dynamic-table__empty-state">
            <Layers size={48} className="inidos-dynamic-table__empty-icon" />
            <h3>No Records Found</h3>
            <p>You haven't added any data to the {displayTitle.toLowerCase()} table yet.</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default DynamicTablePage;
