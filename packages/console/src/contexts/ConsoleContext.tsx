/**
 * ConsoleContext — the console shell state: apps/menus loaded from
 * /api/console/config, page header/title controls, theme and navigation
 * helpers. Sidebar and page titles subscribe to this context.
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ConsoleApp, ConsoleMenu, ConsoleWidget } from '@sails/shared';

export type { ConsoleApp, ConsoleMenu, ConsoleWidget };
import { useAuth } from './AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { fetchCached, invalidateCache } from '../api/client';

interface ConsoleContextType {
  apps: ConsoleApp[];
  activeApp: ConsoleApp | null;
  navigationItems: ConsoleMenu[];
  widgets: ConsoleWidget[];
  /** Tenant default locale — fallback for dynamic-content localization. */
  defaultLocale: string;
  isLoading: boolean;
  error: string | null;
  setActiveApp: (appId: string) => void;
  headerActions: React.ReactNode | null;
  setHeaderActions: (actions: React.ReactNode | null) => void;
  pageTitle: string | null;
  setPageTitle: (title: string | null) => void;
  pageSubtitle: string | null;
  setPageSubtitle: (subtitle: string | null) => void;
  showAddUserDrawer: boolean;
  setShowAddUserDrawer: (show: boolean) => void;
  refreshConfig: () => Promise<void>;
}

const ConsoleContext = createContext<ConsoleContextType | undefined>(undefined);

const normalizePath = (p: string | null | undefined) => (p ? p.replace(/\/+$/, '').toLowerCase() : '');

const hasMatchingMenu = (menus: ConsoleMenu[], currentPath: string): boolean => {
  return menus.some(m => {
    if (m.path && currentPath.startsWith(m.path)) return true;
    if (m.children) return hasMatchingMenu(m.children, currentPath);
    return false;
  });
};

const findFirstPath = (menus: ConsoleMenu[]): string | null => {
  for (const m of menus) {
    if (m.path) return m.path;
    if (m.children) {
      const childPath = findFirstPath(m.children);
      if (childPath) return childPath;
    }
  }
  return null;
};

const resolveAppForPath = (apps: ConsoleApp[], currentPath: string): string | null => {
  if (!currentPath || currentPath === '/' || currentPath === '/dashboard' || currentPath.startsWith('/notifications') || currentPath.startsWith('/tasks')) {
    return null; // Global neutral paths
  }

  // 1. Direct record detail path: /_r/:tableName/...
  const pathParts = currentPath.split('/').filter(Boolean);
  if (pathParts[0] === '_r' && pathParts[1]) {
    const tableName = pathParts[1].toLowerCase();
    for (const app of apps) {
      const match = (app.menus || []).some(m => {
        const checkMenu = (item: ConsoleMenu): boolean => {
          const norm = normalizePath(item.path);
          if (norm.endsWith(`/${tableName}`) || norm.includes(`/tables/${tableName}`) || norm.includes(`/${tableName}/`)) return true;
          return item.children ? item.children.some(checkMenu) : false;
        };
        return checkMenu(m);
      });
      if (match) return app.id;
    }
  }

  // 2. First segment is app slug: /:appSlug/...
  const firstSegment = pathParts[0]?.toLowerCase();
  if (firstSegment) {
    const slugApp = apps.find(a => a.slug && a.slug.toLowerCase() === firstSegment);
    if (slugApp) return slugApp.id;
  }

  // 3. Fallback: menu path prefix match
  for (const app of apps) {
    if (hasMatchingMenu(app.menus || [], currentPath)) {
      return app.id;
    }
  }

  return null;
};

export const ConsoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [apps, setApps] = useState<ConsoleApp[]>([]);
  const [widgets, setWidgets] = useState<ConsoleWidget[]>([]);
  const [defaultLocale, setDefaultLocale] = useState('en');
  const [activeAppId, setActiveAppId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const location = useLocation();

  const pathnameRef = useRef(location.pathname);
  pathnameRef.current = location.pathname;
  const activeAppIdRef = useRef(activeAppId);
  activeAppIdRef.current = activeAppId;

  const loadConfig = useCallback(async (opts?: { silent?: boolean }) => {
      try {
        if (!opts?.silent) setIsLoading(true);
        const result = await fetchCached('/api/console/config', undefined, 30000);
        if (result.success) {
          const fetchedApps = result.data.apps;
          const fetchedWidgets = result.data.widgets || [];
          if (result.data.defaultLocale) setDefaultLocale(result.data.defaultLocale);
          
          // ROLE-BASED FILTERING:
          const filteredApps = fetchedApps.filter((app: ConsoleApp) => {
            if (!app.requiredCapability) return true;
            if (app.requiredCapability === 'ADMIN') {
              return user?.role === 'SUPER_ADMIN' || user?.role === 'TENANT_ADMIN' || user?.role === 'ADMIN';
            }
            return true;
          });
          
          setApps(filteredApps);
          setWidgets(fetchedWidgets);
          
          // Try to find which app contains the current URL path
          const currentPath = pathnameRef.current;
          const currentActiveAppId = activeAppIdRef.current;
          const matchedAppId = resolveAppForPath(filteredApps, currentPath);

          // Sync activeAppId: Switch active app if matchedAppId is found, or default to first app if none set
          if (matchedAppId && matchedAppId !== currentActiveAppId) {
            setActiveAppId(matchedAppId);
          } else if (filteredApps.length > 0 && !currentActiveAppId) {
            setActiveAppId(matchedAppId || filteredApps[0].id);
          }
        } else {
          throw new Error(result.error || 'Unknown error');
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        if (!opts?.silent) setIsLoading(false);
      }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadConfig();
    }
  }, [user, loadConfig]);

  // Reactive URL routing sync: update activeAppId when navigating across apps or record links
  useEffect(() => {
    if (apps.length === 0) return;
    const matchedAppId = resolveAppForPath(apps, location.pathname);
    if (matchedAppId && matchedAppId !== activeAppId) {
      setActiveAppId(matchedAppId);
    }
  }, [location.pathname, apps, activeAppId]);

  /**
   * Refetches the console config after a mutation (menu/widget/app save, delete, toggle).
   * Bypasses the in-memory cache and refreshes in the background (no loading flash).
   * Call after any API call that invalidates the server-side config cache.
   */
  const refreshConfig = useCallback(() => {
    invalidateCache('GET:/api/console/config');
    return loadConfig({ silent: true });
  }, [loadConfig]);

  const activeApp = useMemo(() => apps.find(app => app.id === activeAppId) || null, [apps, activeAppId]);
  const navigationItems = useMemo(() => activeApp?.menus || [], [activeApp]);

  const setActiveApp = useCallback((appId: string) => {
    const targetApp = apps.find(a => a.id === appId);
    if (!targetApp) return;

    setActiveAppId(appId);

    const firstPath = findFirstPath(targetApp.menus);
    if (firstPath) {
      navigate(firstPath);
    }
  }, [apps, navigate]);

  const [headerActions, setHeaderActions] = useState<React.ReactNode | null>(null);
  const [pageTitle, setPageTitle] = useState<string | null>(null);
  const [pageSubtitle, setPageSubtitle] = useState<string | null>(null);
  const [showAddUserDrawer, setShowAddUserDrawer] = useState(false);

  useEffect(() => {
    // Clear header actions & title overrides on route change
    setHeaderActions(null);
    setPageTitle(null);
    setPageSubtitle(null);
    setShowAddUserDrawer(false);
  }, [location.pathname]);

  // Dynamic browser tab title: "Sails - <Page Label>"
  const allMenuPaths = useMemo(() => {
    const flat: { menu: ConsoleMenu; path: string }[] = [];
    const collect = (items: ConsoleMenu[]) => {
      for (const item of items) {
        const normalized = normalizePath(item.path);
        if (normalized) flat.push({ menu: item, path: normalized });
        if (item.children) collect(item.children);
      }
    };
    for (const app of apps) {
      if (app.menus) collect(app.menus);
    }
    return flat;
  }, [apps]);

  useEffect(() => {
    const target = normalizePath(location.pathname);
    const exact = allMenuPaths.find(x => x.path === target);
    const prefixMatches = allMenuPaths
      .filter(x => x.path && target.startsWith(x.path + '/'))
      .sort((a, b) => b.path.length - a.path.length);

    const menu = exact?.menu || prefixMatches[0]?.menu || null;

    let label: string | null = null;
    if (pageTitle) {
      label = pageTitle;
    } else if (menu) {
      const isPlatformStudioMenu = navigationItems.some(m => {
        const isDescendant = (item: ConsoleMenu): boolean => item.children?.some(c => c.id === menu!.id || isDescendant(c)) ?? false;
        return m.label === 'Platform Studio' && isDescendant(m);
      });
      label = isPlatformStudioMenu ? `${menu.label} Studio` : menu.label;
    } else if (activeApp) {
      label = activeApp.name;
    } else if (normalizePath(location.pathname) === '/dashboard') {
      label = 'Dashboard';
    }

    document.title = label ? `Sails - ${label}` : 'Sails';
  }, [location.pathname, pageTitle, allMenuPaths, navigationItems, activeApp]);

  const contextValue = useMemo(() => ({
    apps,
    activeApp,
    navigationItems,
    widgets,
    defaultLocale,
    isLoading,
    error,
    setActiveApp,
    headerActions,
    setHeaderActions,
    pageTitle,
    setPageTitle,
    pageSubtitle,
    setPageSubtitle,
    showAddUserDrawer,
    setShowAddUserDrawer,
    refreshConfig
  }), [
    apps, activeApp, navigationItems, widgets, defaultLocale, isLoading, error,
    setActiveApp, headerActions, pageTitle, pageSubtitle,
    showAddUserDrawer, refreshConfig
  ]);

  return (
    <ConsoleContext.Provider value={contextValue}>
      {children}
    </ConsoleContext.Provider>
  );
};

export const useConsole = () => {
  const context = useContext(ConsoleContext);
  if (context === undefined) {
    throw new Error('useConsole must be used within a ConsoleProvider');
  }
  return context;
};
