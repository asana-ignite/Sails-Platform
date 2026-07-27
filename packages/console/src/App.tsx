import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import LoadingScreen from './components/common/LoadingScreen';
import './styles/globals.css';
import { ConsoleProvider, useConsole, ConsoleMenu } from './contexts/ConsoleContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';

// Lazy load pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const DynamicTablePage = lazy(() => import('./pages/DynamicTablePage'));
const AppPluginShell = lazy(() => import('./pages/admin/AppPluginShell'));
const AdminAuditLog = lazy(() => import('./pages/admin/AdminAuditLog'));
const Login = lazy(() => import('./pages/Login'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const Unauthorized = lazy(() => import('./pages/Unauthorized'));
const LayoutDemo = lazy(() => import('./pages/__mockups__/LayoutDemo'));
const RouteBuilder = lazy(() => import('./pages/__mockups__/RouteBuilder'));

/**
 * ProtectedRoute
 * Redirects to /login if not authenticated.
 * Optional role check: redirects to /dashboard if role is not allowed.
 */
const ProtectedRoute: React.FC<{ 
  children: React.ReactNode, 
  allowedRoles?: string[] 
}> = ({ children, allowedRoles }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    console.warn(`Access denied for role: ${user.role}. Required: ${allowedRoles.join(', ')}`);
    return <Unauthorized />;
  }

  return <>{children}</>;
};

/**
 * SmartPageRouter
 * Decides whether to render a Table or a Plugin based on database metadata.
 */
const SmartPageRouter: React.FC = () => {
  const { navigationItems } = useConsole();
  const location = useLocation();

  const normalizePath = (p: string | null) => p ? p.replace(/\/+$/, '').toLowerCase() : '';

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

  const { user } = useAuth();
  
  // 1. Explicit path check for sensitive areas (e.g., /admin)
  // This catches cases where the menu item was filtered out of navigationItems
  if (location.pathname.startsWith('/admin')) {
    if (user?.role !== 'SUPER_ADMIN' && user?.role !== 'TENANT_ADMIN' && user?.role !== 'ADMIN') {
      return <Unauthorized />;
    }
  }

  // 2. Extra layer of security: Check if the found menu item requires a capability
  if (activeMenu?.requiredCapability === 'ADMIN') {
    if (user?.role !== 'SUPER_ADMIN' && user?.role !== 'TENANT_ADMIN' && user?.role !== 'ADMIN') {
      return <Unauthorized />;
    }
  }

  if (activeMenu?.actionType === 'table') {
    return <DynamicTablePage />;
  }

  return <AppPluginShell />;
};

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
      <AuthProvider>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/admin-login" element={<AdminLogin />} />
            <Route path="/layout-demo" element={<LayoutDemo />} />
            <Route path="/route-builder" element={<RouteBuilder />} />

            {/* Protected Application Routes */}
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <ConsoleProvider>
                    <Routes>
                      <Route path="/audit-live" element={<Suspense fallback={<LoadingScreen />}><AdminAuditLog /></Suspense>} />
                      <Route path="*" element={
                        <AppLayout>
                          <Routes>
                            <Route path="/" element={<Navigate to="/dashboard" replace />} />
                            <Route path="/dashboard" element={<Dashboard />} />
                            <Route path="/:appSlug/*" element={<SmartPageRouter />} />
                            <Route path="*" element={<Navigate to="/dashboard" replace />} />
                          </Routes>
                        </AppLayout>
                      } />
                    </Routes>
                  </ConsoleProvider>
                </ProtectedRoute>
              }
            />
          </Routes>
        </Suspense>
      </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
