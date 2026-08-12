/**
 * AppPluginShell — the shell that mounts the active console app/page plugin.
 */
import React from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useConsole } from '../../contexts/ConsoleContext';
import { ConsoleMenu } from '@sails/shared';
import { AdminPluginRegistry } from '../../features/admin/registry';
import DynamicIcon from '../../components/common/DynamicIcon';
import './AppPluginShell.css';

/**
 * Universal App Plugin Shell
 * Resolves metadata and dynamic components for ANY application workspace.
 */
const AppPluginShell: React.FC = () => {
  const { t } = useTranslation();
  const { navigationItems, activeApp, headerActions, pageTitle, pageSubtitle } = useConsole();
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
    const allMenus: ConsoleMenu[] = [];
    const collect = (items: ConsoleMenu[]) => {
      for (const item of items) {
        allMenus.push(item);
        if (item.children) collect(item.children);
      }
    };
    collect(menus);

    // 1. Exact match
    const exact = allMenus.find(m => normalizePath(m.path) === target);
    if (exact) return exact;

    // 2. Longest matching prefix
    const prefixMatches = allMenus
      .map(m => ({ menu: m, path: normalizePath(m.path) }))
      .filter(x => x.path && target.startsWith(x.path + '/'))
      .sort((a, b) => b.path.length - a.path.length);

    return prefixMatches[0]?.menu || null;
  };

  const activeMenu = findMenuByPath(navigationItems, location.pathname);

  // Check if this menu lives under "Platform Studio"
  const isPlatformStudioMenu = React.useMemo(() => {
    if (!activeMenu) return false;
    const isDescendant = (item: ConsoleMenu): boolean =>
      item.children?.some(c => c.id === activeMenu.id || isDescendant(c)) ?? false;
    return navigationItems.some(m =>
      m.label === 'Platform Studio' && isDescendant(m)
    );
  }, [activeMenu, navigationItems]);

  // Resolve Component from Registry
  const componentKey = activeMenu?.componentKey;
  const PluginComponent = componentKey ? (AdminPluginRegistry as any)[componentKey] : null;

  // Header Data with App-level defaults & Component overrides
  const title = pageTitle || (activeMenu?.label && isPlatformStudioMenu ? `${activeMenu.label} Studio` : activeMenu?.label) || activeApp?.name || 'Workspace';
  const iconName = activeMenu?.icon || activeApp?.icon || 'Box';
  
  // High-fidelity subtitle resolution
  let subtitle = pageSubtitle || `Managing all records and configuration for the ${activeMenu?.label?.toLowerCase() || activeApp?.name?.toLowerCase() || 'module'}.`;
  
  if (!pageSubtitle) {
    if (componentKey === 'AdminUserManager') {
      subtitle = 'Manage platform access, assigned roles, and security permissions for all system members.';
    } else if (activeMenu?.requiredCapability) {
      subtitle = `Secured access module requiring ${activeMenu.requiredCapability} authorization.`;
    }
  }

  return (
    <div className="sails-admin-shell sails-page-container">
      <header className="sails-page-header sails-admin-shell__header">
        <div className="sails-page-header__left">
          <div className="sails-page-header__icon-wrapper">
             <DynamicIcon name={iconName} size={24} />
          </div>
          <div className="sails-page-header__title-group">
            <div className="sails-page-header__title-row">
              <h1 className="sails-page-header__title">{title}</h1>
            </div>
            <p className="sails-page-header__subtitle">{subtitle}</p>
          </div>
        </div>
        
        <div className="sails-page-header__right">
           {headerActions}
        </div>
      </header>

      <main className="sails-admin-shell__content">
        {PluginComponent ? (
          <React.Suspense fallback={<div className="sails-admin-loading">{t('common.loading')}</div>}>
            <PluginComponent />
          </React.Suspense>
        ) : (
          <div className="sails-card" style={{ textAlign: 'center', padding: '60px' }}>
            <div style={{ opacity: 0.2, marginBottom: '16px' }}>
               <DynamicIcon name={iconName} size={64} />
            </div>
            <h2 style={{ marginBottom: '16px' }}>Custom Module Ready</h2>
            <p style={{ color: 'var(--sails-text-muted)' }}>
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
