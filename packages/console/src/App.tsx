import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import LoadingScreen from './components/common/LoadingScreen';
import './styles/globals.css';
import { ConsoleProvider, useConsole, ConsoleMenu } from './contexts/ConsoleContext';

// Lazy load pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const DynamicTablePage = lazy(() => import('./pages/DynamicTablePage'));
const AppPluginShell = lazy(() => import('./pages/admin/AppPluginShell'));

/**
 * SmartPageRouter
 * Decides whether to render a Table or a Plugin based on database metadata.
 */
const SmartPageRouter: React.FC = () => {
  const { navigationItems } = useConsole();
  const location = useLocation();

  // Helper to normalize paths
  const normalizePath = (p: string | null) => p ? p.replace(/\/+$/, '').toLowerCase() : '';

  // Recursive search to find the menu item for the current URL
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

  // If the metadata says it's a table, render the DynamicTablePage
  if (activeMenu?.actionType === 'table') {
    return <DynamicTablePage />;
  }

  // Default to the AppPluginShell for everything else (Plugins, Dashboards, Custom)
  return <AppPluginShell />;
};

function App() {
  return (
    <BrowserRouter>
      <ConsoleProvider>
        <AppLayout>
          <Suspense fallback={<LoadingScreen />}>
            <Routes>
              {/* Default Redirect to Dashboard */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />

              {/* CLEAN UNIVERSAL ROUTING (Metadata-Driven) */}
              {/* 1. Dashboard is always specific */}
              <Route path="/dashboard" element={<Dashboard />} />

              {/* 2. Catch-all App Router (/:appSlug/*) */}
              {/* This handles /crm/leads, /admin/profile, /sales/orders etc. */}
              <Route path="/:appSlug/*" element={<SmartPageRouter />} />

              {/* 404 Fallback */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </AppLayout>
      </ConsoleProvider>
    </BrowserRouter>
  );
}

export default App;
