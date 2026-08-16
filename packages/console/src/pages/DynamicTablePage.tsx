/**
 * DynamicTablePage — the runtime LIST page shell hosting ListViewEngine.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { Layers, AlertCircle } from 'lucide-react';
import { useConsole } from '../contexts/ConsoleContext';
import type { ConsoleMenu, ListAction } from '@sails/shared';
import DynamicIcon from '../components/common/DynamicIcon';
import LoadingScreen from '../components/common/LoadingScreen';
import { fetchCached } from '../api/client';
import { ListViewEngine } from '../components/list/ListViewEngine';
import { ActionRegistry } from '../features/actions';
import '../features/controls/controls.css';
import './DynamicTablePage.css';
import './custom/LayoutStudio.css';
import './custom/layouts-responsive.css';

const DynamicTablePage: React.FC = () => {
  const { t } = useTranslation();
  const { apps, navigationItems } = useConsole();
  const location = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const animClass = navigationType === 'POP' ? 'sails-dynamic-table--back' : '';

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

  const displayTitle = activeMenu?.label || 'Data Table';
  const iconName = activeMenu?.icon || 'Database';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tableName, setTableName] = useState<string | null>(null);
  const [layoutId, setLayoutId] = useState<string | null>(null);
  const [resolvedLayout, setResolvedLayout] = useState<any>(null);
  const [pageActions, setPageActions] = useState<{ actions: ListAction[]; execute: (a: ListAction) => void } | null>(null);

  const handleActionsReady = useCallback((actions: ListAction[], execute: (a: ListAction) => void) => {
    setPageActions({ actions, execute });
  }, []);

  useEffect(() => {
    if (!activeMenu?.dataModelId && !activeMenu?.listViewId) {
      setLoading(false);
      return;
    }

    const init = async () => {
      setLoading(true);
      setError(null);
      try {
        let targetLayout: any = null;
        let dataModelId = activeMenu?.dataModelId || null;

        // Menu may only reference the list view layout — resolve the table from it.
        if (!dataModelId && activeMenu?.listViewId) {
          const byId = await fetchCached(`/api/console/layouts?id=${activeMenu.listViewId}`);
          if (byId.success) targetLayout = byId.data;
          dataModelId = targetLayout?.tableId || null;
        }

        // All layouts for this table — resolve the LIST layout to render.
        const lResult = dataModelId ? await fetchCached(`/api/console/layouts?tableId=${dataModelId}&page=1&limit=100`) : null;
        const rows: any[] = lResult?.data?.rows || [];

        if (!targetLayout && activeMenu?.listViewId) {
          targetLayout = rows.find((r: any) => r.id === activeMenu.listViewId || r.systemName === activeMenu.listViewId) || null;
        }
        if (!targetLayout) {
          targetLayout =
            rows.find((r: any) => r.viewType === 'LIST' && r.status === 'active' && r.isDefault) ||
            rows.find((r: any) => r.viewType === 'LIST' && r.status === 'active') ||
            rows.find((r: any) => r.viewType === 'LIST') ||
            null;
        }

        let tn: string | null = targetLayout?.table?.tableName || null;
        if (!tn && dataModelId) {
          const objectsData = await fetchCached('/api/metadata/objects', undefined, 60000);
          const objectRows = Array.isArray(objectsData) ? objectsData : (objectsData?.rows || objectsData?.data || []);
          const foundTable = objectRows.find((t: any) => t.id === dataModelId || t.tableName === dataModelId);
          if (foundTable) tn = foundTable.tableName;
        }

        if (!tn) {
          setError('Data model table reference not found');
          return;
        }

        setTableName(tn);
        setLayoutId(targetLayout?.id || null);
        setResolvedLayout(targetLayout || null);
      } catch (err: any) {
        setError(err.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [activeMenu?.dataModelId, activeMenu?.listViewId, location.pathname]);

  if (!activeMenu?.dataModelId && !activeMenu?.listViewId) {
    return (
      <div className={`sails-dynamic-table sails-page-container ${animClass}`}>
        <header className="sails-page-header sails-dynamic-table__header">
          <div className="sails-page-header__left">
            <div className="sails-page-header__icon-wrapper">
              <DynamicIcon name={iconName} size={24} />
            </div>
            <div>
              <h1 className="sails-page-header__title">{displayTitle}</h1>
              <p className="sails-page-header__subtitle">No data model linked to this navigation item.</p>
            </div>
          </div>
        </header>
      </div>
    );
  }

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <div className={`sails-dynamic-table sails-page-container ${animClass}`}>
        <header className="sails-page-header sails-dynamic-table__header">
          <div className="sails-page-header__left">
            <div className="sails-page-header__icon-wrapper">
              <AlertCircle size={24} />
            </div>
            <div>
              <h1 className="sails-page-header__title">{displayTitle}</h1>
              <p className="sails-page-header__subtitle">{error}</p>
            </div>
          </div>
        </header>
      </div>
    );
  }

  return (
    <div className={`sails-dynamic-table sails-page-container ${animClass}`}>
      <header className="sails-page-header sails-dynamic-table__header">
        <div className="sails-page-header__left">
          <div className="sails-page-header__icon-wrapper">
            <DynamicIcon name={iconName} size={24} />
          </div>
          <div>
            <h1 className="sails-page-header__title">{displayTitle}</h1>
            <p className="sails-page-header__subtitle">Managing all records for the {displayTitle.toLowerCase()} entity.</p>
          </div>
        </div>
        <div className="sails-page-header__right">
          {(pageActions?.actions || []).map((act) => {
            const plugin = ActionRegistry.getInstance().getAction(act.actionKey);
            const actIcon = plugin?.iconName || (act.actionKey === 'create' ? 'Plus' : 'Zap');
            const variant = act.variant || 'primary';
            const variantClass = variant === 'primary' ? 'sails-btn--primary'
              : variant === 'danger' ? 'sails-btn--danger'
              : variant === 'secondary' ? 'sails-btn--secondary'
              : 'sails-btn--ghost';
            return (
              <button key={act.id} type="button" className={`sails-btn ${variantClass}`}
                onClick={() => pageActions && pageActions.execute(act)}>
                <DynamicIcon name={actIcon} size={18} />
                <span>{act.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      <section className="sails-dynamic-table__content">
        {tableName && layoutId ? (
          <ListViewEngine
            tableName={tableName}
            layoutId={layoutId}
            initialLayout={resolvedLayout}
            title={displayTitle}
            menuPath={activeMenu?.path || undefined}
            navigate={(p) => navigate(p as any)}
            actionsBar="none"
            onActionsReady={handleActionsReady}
          />
        ) : tableName ? (
          <div className="sails-card" style={{ textAlign: 'center', padding: '60px 40px', color: 'var(--sails-text-muted)' }}>
            <Layers size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
            <h3>No List View Configured</h3>
            <p>This data model doesn't have a default List View yet. Go to Layouts to create one.</p>
          </div>
        ) : null}
      </section>
    </div>
  );
};

export default DynamicTablePage;
