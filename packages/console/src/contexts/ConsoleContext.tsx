import React, { createContext, useContext, useState, useEffect } from 'react';
import { ConsoleApp, ConsoleMenu } from '@klao/shared';

export type { ConsoleApp, ConsoleMenu };
import { useNavigate, useLocation } from 'react-router-dom';



interface ConsoleContextType {
  apps: ConsoleApp[];
  activeApp: ConsoleApp | null;
  navigationItems: ConsoleMenu[];
  isLoading: boolean;
  error: string | null;
  setActiveApp: (appId: string) => void;
  headerActions: React.ReactNode | null;
  setHeaderActions: (actions: React.ReactNode | null) => void;
  showAddUserDrawer: boolean;
  setShowAddUserDrawer: (show: boolean) => void;
}

const ConsoleContext = createContext<ConsoleContextType | undefined>(undefined);

export const ConsoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [apps, setApps] = useState<ConsoleApp[]>([]);
  const [activeAppId, setActiveAppId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/console/config');
        if (!response.ok) {
          throw new Error('Failed to fetch console configuration');
        }
        const result = await response.json();
        if (result.success) {
          const fetchedApps = result.data.apps;
          setApps(fetchedApps);
          
          // Try to find which app contains the current URL path
          const currentPath = location.pathname;
          let matchedAppId = null;

          if (currentPath !== '/') {
            for (const app of fetchedApps) {
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

          // Default to the matched app, or the first app if none matched
          if (fetchedApps.length > 0 && !activeAppId) {
            setActiveAppId(matchedAppId || fetchedApps[0].id);
          }
        } else {
          throw new Error(result.error || 'Unknown error');
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConfig();
  }, [location.pathname]); // Listen to pathname for deep linking on mount/refresh

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
  const [showAddUserDrawer, setShowAddUserDrawer] = useState(false);

  useEffect(() => {
    // Clear header actions on any route change to prevent leakage
    setHeaderActions(null);
    setShowAddUserDrawer(false);
  }, [location.pathname]);

  return (
    <ConsoleContext.Provider value={{ 
      apps, 
      activeApp, 
      navigationItems, 
      isLoading, 
      error, 
      setActiveApp,
      headerActions,
      setHeaderActions,
      showAddUserDrawer,
      setShowAddUserDrawer
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
