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
  const { navigationItems, activeApp, headerActions } = useConsole();
  const location = useLocation();
  const { appSlug } = useParams<{ appSlug: string }>();

  React.useEffect(() => {
    console.log("SHELL: Header Actions Updated ->", headerActions ? "PRESENT" : "EMPTY");
  }, [headerActions]);

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
  
  // High-fidelity subtitle resolution
  let subtitle = `Managing all records and configuration for the ${activeMenu?.label?.toLowerCase() || activeApp?.name?.toLowerCase() || 'module'}.`;
  
  if (componentKey === 'AdminUserManager') {
    subtitle = 'Manage platform access, assigned roles, and security permissions for all system members.';
  } else if (activeMenu?.requiredCapability) {
    subtitle = `Secured access module requiring ${activeMenu.requiredCapability} authorization.`;
  }

  return (
    <div className="klao-admin-shell klao-page-container">
      <header className="klao-page-header klao-admin-shell__header">
        <div className="klao-page-header__left">
          <div className="klao-page-header__icon-wrapper">
             <DynamicIcon name={iconName} size={24} />
          </div>
          <div className="klao-page-header__title-group">
            <div className="klao-page-header__title-row">
              <h1 className="klao-page-header__title">{title}</h1>
            </div>
            <p className="klao-page-header__subtitle">{subtitle}</p>
          </div>
        </div>
        
        <div className="klao-page-header__right">
           {headerActions}
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
