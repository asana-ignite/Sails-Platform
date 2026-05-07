import React from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useConsole } from '../../contexts/ConsoleContext';
import { ConsoleMenu } from '@klao/shared';
import { AdminPluginRegistry } from '../../features/admin/registry';
import DynamicIcon from '../../components/common/DynamicIcon';
import './AppPluginShell.css';

/**
 * Universal App Plugin Shell
 * Resolves metadata and dynamic components for ANY application workspace.
 */
const AppPluginShell: React.FC = () => {
  const { navigationItems, activeApp } = useConsole();
  const location = useLocation();
  const { appSlug } = useParams<{ appSlug: string }>();

  // Helper to normalize paths for comparison
  const normalizePath = (p: string | null) => {
    if (!p) return '';
    return p.replace(/\/+$/, '').toLowerCase();
  };

  // Recursive menu search
  const findMenuByPath = (menus: ConsoleMenu[], path: string): ConsoleMenu | null => {
    const target = normalizePath(path);
    for (const menu of menus) {
      const menuPath = normalizePath(menu.path);
      if (menuPath === target) return menu;
      
      // Handle nested/deep paths within a plugin
      if (menuPath && target.startsWith(menuPath)) return menu;

      if (menu.children) {
        const found = findMenuByPath(menu.children, path);
        if (found) return found;
      }
    }
    return null;
  };

  const activeMenu = findMenuByPath(navigationItems, location.pathname);

  // Resolve Component from Registry
  const componentKey = activeMenu?.componentKey;
  const PluginComponent = componentKey ? (AdminPluginRegistry as any)[componentKey] : null;

  // Header Data with App-level defaults
  const title = activeMenu?.label || activeApp?.name || 'Workspace';
  const iconName = activeMenu?.icon || activeApp?.icon || 'Box';
  const subtitle = activeMenu?.requiredCapability 
    ? `Secured via ${activeMenu.requiredCapability}` 
    : `Managing all records for the ${activeMenu?.label?.toLowerCase() || activeApp?.name?.toLowerCase() || 'module'} entity.`;

  return (
    <div className="klao-admin-shell">
      <header className="klao-admin-shell__header">
        <div className="klao-page-header__left">
          <div className="klao-page-header__icon-wrapper">
             <DynamicIcon name={iconName} size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 className="klao-page-header__title">{title}</h1>
              <span className="klao-admin-shell__plugin-badge">{activeApp?.name || 'App'}</span>
            </div>
            <p className="klao-page-header__subtitle">{subtitle}</p>
          </div>
        </div>
        
        {/* Universal Action Area */}
        <div className="klao-page-header__actions">
           {/* Context-aware actions could be injected here */}
        </div>
      </header>

      <main className="klao-admin-shell__content">
        {PluginComponent ? (
          <React.Suspense fallback={<div className="klao-admin-loading">Loading Component...</div>}>
            <PluginComponent />
          </React.Suspense>
        ) : (
          <div className="klao-card" style={{ textAlign: 'center', padding: '60px' }}>
            <div style={{ opacity: 0.2, marginBottom: '16px' }}>
               <DynamicIcon name={iconName} size={64} />
            </div>
            <h2 style={{ marginBottom: '16px' }}>Custom Module Ready</h2>
            <p style={{ color: 'var(--klao-text-muted)' }}>
              This is a dynamic plugin slot for <strong>{title}</strong>.<br />
              Connect your React component in <code>registry.tsx</code> to display custom UI here.
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default AppPluginShell;
