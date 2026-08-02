import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
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

export const ConsoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [apps, setApps] = useState<ConsoleApp[]>([]);
  const [widgets, setWidgets] = useState<ConsoleWidget[]>([]);
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
          
          // ROLE-BASED FILTERING:
          // Filter apps based on requiredCapability and user role.
          const filteredApps = fetchedApps.filter((app: ConsoleApp) => {
            if (!app.requiredCapability) return true;
            
            // ADMIN apps only for TENANT_ADMIN and SUPER_ADMIN
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
          let matchedAppId = null;

          if (currentPath !== '/') {
            // 1. App-first routing: match the first URL segment against app slugs
            //    (e.g. /test/testtype/test_type_details_view/<recordId> -> slug "test").
            //    This handles deep links that don't prefix any menu path.
            const firstSegment = currentPath.split('/').filter(Boolean)[0]?.toLowerCase();
            if (firstSegment) {
              const slugApp = filteredApps.find((a: ConsoleApp) => a.slug && a.slug.toLowerCase() === firstSegment);
              if (slugApp) {
                matchedAppId = slugApp.id;
              }
            }

            // 2. Fallback: match by menu path prefix (legacy paths like /table/..., /admin/...)
            if (!matchedAppId) {
              for (const app of filteredApps) {
                const hasMatchingMenu = (menus: ConsoleMenu[]): boolean => {
                  return menus.some(m => {
                    if (m.path && currentPath.startsWith(m.path)) return true;
                    if (m.children) return hasMatchingMenu(m.children);
                    return false;
                  });
                };

                if (hasMatchingMenu(app.menus)) {
                  matchedAppId = app.id;
                  break;
                }
              }
            }
          }

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

  /**
   * Refetches the console config after a mutation (menu/widget/app save, delete, toggle).
   * Bypasses the in-memory cache and refreshes in the background (no loading flash).
   * Call after any API call that invalidates the server-side config cache.
   */
  const refreshConfig = useCallback(() => {
    invalidateCache('GET:/api/console/config');
    return loadConfig({ silent: true });
  }, [loadConfig]);

  const activeApp = apps.find(app => app.id === activeAppId) || null;
  const navigationItems = activeApp?.menus || [];

  const setActiveApp = (appId: string) => {
    const targetApp = apps.find(a => a.id === appId);
    if (!targetApp) return;

    setActiveAppId(appId);

    // AUTOMATIC NAVIGATION: 
    // When switching apps, find the first valid path in that app and navigate to it.
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

    const firstPath = findFirstPath(targetApp.menus);
    if (firstPath) {
      navigate(firstPath);
    }
  };

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

  return (
    <ConsoleContext.Provider value={{ 
      apps, 
      activeApp, 
      navigationItems,
      widgets, 
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
    }}>
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
