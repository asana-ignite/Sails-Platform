import React, { createContext, useContext, useState, useEffect } from 'react';
import { ConsoleApp, ConsoleMenu } from '@sails/shared';

export type { ConsoleApp, ConsoleMenu };
import { useAuth } from './AuthContext';
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
  pageTitle: string | null;
  setPageTitle: (title: string | null) => void;
  pageSubtitle: string | null;
  setPageSubtitle: (subtitle: string | null) => void;
  showAddUserDrawer: boolean;
  setShowAddUserDrawer: (show: boolean) => void;
}

const ConsoleContext = createContext<ConsoleContextType | undefined>(undefined);

export const ConsoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
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
          
          // Try to find which app contains the current URL path
          const currentPath = location.pathname;
          let matchedAppId = null;

          if (currentPath !== '/') {
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

          // Default to the matched app, or the first app if none matched
          if (filteredApps.length > 0 && !activeAppId) {
            setActiveAppId(matchedAppId || filteredApps[0].id);
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

    if (user) {
      fetchConfig();
    }
  }, [location.pathname, user]); 

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
