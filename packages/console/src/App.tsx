import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import LoadingScreen from './components/common/LoadingScreen';
import './styles/globals.css';
import { ConsoleProvider, useConsole, ConsoleMenu } from './contexts/ConsoleContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { DateTimePrefsProvider } from './utils/systemDateTime';

// Lazy load pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const DynamicTablePage = lazy(() => import('./pages/DynamicTablePage'));
const DynamicDetailPage = lazy(() => import('./pages/DynamicDetailPage'));
const AppPluginShell = lazy(() => import('./pages/admin/AppPluginShell'));
const AdminAuditLog = lazy(() => import('./pages/admin/AdminAuditLog'));
const Login = lazy(() => import('./pages/Login'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const Unauthorized = lazy(() => import('./pages/Unauthorized'));
const LayoutDemo = lazy(() => import('./pages/__mockups__/LayoutDemo'));
const RouteBuilder = lazy(() => import('./pages/__mockups__/RouteBuilder'));
const LayoutStudio = lazy(() => import('./pages/custom/LayoutStudio'));
const TableBuilder = lazy(() => import('./pages/__mockups__/TableBuilder'));
const QueryStudioDemo = lazy(() => import('./pages/__mockups__/QueryStudioDemo'));

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
  const { apps, navigationItems, isLoading } = useConsole();
  const location = useLocation();
  const { user } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  const normalizePath = (p: string | null | undefined) => p ? p.replace(/\/+$/, '').toLowerCase() : '';

  const findMenu = (menus: ConsoleMenu[]): ConsoleMenu | null => {
    const target = normalizePath(location.pathname);
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

  let activeMenu = findMenu(navigationItems);
  if (!activeMenu && apps) {
    for (const app of apps) {
      const found = findMenu(app.menus || []);
      if (found) {
        activeMenu = found;
        break;
      }
    }
  }

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

  const isDataModelRoute =
    activeMenu?.actionType === 'data_model' ||
    activeMenu?.actionType === 'table' ||
    activeMenu?.actionType === 'list_view' ||
    Boolean(activeMenu?.dataModelId) ||
    Boolean(activeMenu?.listViewId);

  // Record detail routes use the nav path + layout + record id:
  // /test/testtype/test_type_details_view/<recordId> (or .../new).
  // If the URL extends the matched menu path, we are on a record route.
  const targetPath = normalizePath(location.pathname);
  const menuPath = normalizePath(activeMenu?.path);
  const isRecordDetailRoute = isDataModelRoute && !!menuPath && targetPath.length > menuPath.length && targetPath.startsWith(menuPath + '/');
  if (isRecordDetailRoute) {
    return <DynamicDetailPage />;
  }

  if (isDataModelRoute) {
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
            <Route path="/table-builder" element={<TableBuilder />} />
            <Route path="/query-studio-demo" element={<QueryStudioDemo />} />
            <Route path="/layout-studio/:tableId/:layoutId" element={
              <ProtectedRoute>
                <Suspense fallback={<LoadingScreen />}>
                  <LayoutStudio />
                </Suspense>
              </ProtectedRoute>
            } />

            {/* Protected Application Routes */}
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <ConsoleProvider>
                    <DateTimePrefsProvider>
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
                    </DateTimePrefsProvider>
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
