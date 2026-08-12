/**
 * WidgetsTab — console widget bar editor for an app.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, GripVertical, ChevronUp, ChevronDown, SwitchCamera } from 'lucide-react';
import { ConsoleWidget } from '@sails/shared';
import { useConsole } from '../../contexts/ConsoleContext';

interface WidgetsTabProps {
  appId: string;
  widgetBarEnabled: boolean;
}

const WIDGET_KEYS = ['OmniChannelQuickAccept', 'AgentChatWindows'];

const WidgetsTab: React.FC<WidgetsTabProps> = ({ appId, widgetBarEnabled }) => {
  const { refreshConfig } = useConsole();
  const [widgets, setWidgets] = useState<ConsoleWidget[]>([]);
  const [loading, setLoading] = useState(true);
  const [addKey, setAddKey] = useState(WIDGET_KEYS[0]);
  const [saving, setSaving] = useState(false);
  const [barEnabled, setBarEnabled] = useState(widgetBarEnabled);
  const [barSaving, setBarSaving] = useState(false);

  const fetchWidgets = useCallback(async () => {
    try {
      const res = await fetch(`/api/console/widgets?appId=${appId}`);
      const data = await res.json();
      if (data.success) setWidgets(data.data);
    } catch (e) {
      console.error('Failed to fetch widgets', e);
    } finally {
      setLoading(false);
    }
  }, [appId]);

  useEffect(() => { fetchWidgets(); }, [fetchWidgets]);

  useEffect(() => {
    setBarEnabled(widgetBarEnabled);
  }, [widgetBarEnabled]);

  const handleBarToggle = async () => {
    setBarSaving(true);
    const next = !barEnabled;
    setBarEnabled(next);
    try {
      await fetch('/api/console/apps', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: appId, widgetBarEnabled: next }),
      });
      refreshConfig();
    } catch (e) {
      setBarEnabled(!next);
    } finally {
      setBarSaving(false);
    }
  };

  const handleAdd = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/console/widgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId,
          label: addKey === 'OmniChannelQuickAccept' ? 'Quick Accept' : 'Agent Chat',
          componentKey: addKey,
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchWidgets();
        refreshConfig();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/console/widgets?id=${id}`, { method: 'DELETE' });
    fetchWidgets();
    refreshConfig();
  };

  const handleToggle = async (widget: ConsoleWidget) => {
    await fetch('/api/console/widgets', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: widget.id, enabled: !widget.enabled }),
    });
    fetchWidgets();
    refreshConfig();
  };

  const handleMove = async (id: string, delta: number) => {
    const idx = widgets.findIndex(w => w.id === id);
    if (idx < 0) return;
    const other = widgets[idx + delta];
    if (!other) return;
    await fetch('/api/console/widgets', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, order: other.order }),
    });
    await fetch('/api/console/widgets', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: other.id, order: widgets[idx].order }),
    });
    fetchWidgets();
    refreshConfig();
  };

  if (loading) return <div className="sails-app-detail__section">Loading widgets...</div>;

  const availableKeys = WIDGET_KEYS.filter(k => !widgets.some(w => w.componentKey === k));

  return (
    <div className="sails-app-detail__section sails-widgets-tab">
      <div className="sails-app-detail__setting-row">
        <div className="sails-app-detail__setting-info">
          <h4 style={{ margin: 0 }}>Widget Bar</h4>
          <p className="sails-app-field-hint" style={{ margin: 0 }}>Show footer widget bar when this app is active</p>
        </div>
        <label className="sails-toggle">
          <input
            type="checkbox"
            checked={barEnabled}
            onChange={handleBarToggle}
            disabled={barSaving}
          />
          <span className="sails-toggle__slider" />
        </label>
      </div>

      <div className="sails-widgets-tab__divider" />

      <div className="sails-widgets-tab__header">
        <div>
          <h4>Assigned Widgets</h4>
          <p className="sails-app-field-hint">Widgets shown in the footer bar when this app is active</p>
        </div>
        <div className="sails-widgets-tab__add-row">
          <select
            className="sails-widgets-tab__select"
            value={addKey}
            onChange={e => setAddKey(e.target.value)}
            disabled={availableKeys.length === 0}
          >
            {availableKeys.length === 0 ? (
              <option value="">All added</option>
            ) : (
              availableKeys.map(k => (
                <option key={k} value={k}>
                  {k === 'OmniChannelQuickAccept' ? 'Quick Accept' : 'Agent Chat'}
                </option>
              ))
            )}
          </select>
          <button
            className="sails-btn sails-btn--primary"
            onClick={handleAdd}
            disabled={saving || availableKeys.length === 0}
          >
            <Plus size={14} />
            <span>Add</span>
          </button>
        </div>
      </div>

      {widgets.length === 0 ? (
        <div className="sails-widgets-tab__empty">
          No widgets assigned. Add one above to get started.
        </div>
      ) : (
        <div className="sails-widgets-tab__list">
          {widgets.map((w, i) => (
            <div key={w.id} className={`sails-widgets-tab__row ${!w.enabled ? 'sails-widgets-tab__row--disabled' : ''}`}>
              <div className="sails-widgets-tab__drag">
                <GripVertical size={14} />
              </div>
              <div className="sails-widgets-tab__info">
                <span className="sails-widgets-tab__label">{w.label}</span>
                <span className="sails-widgets-tab__key">{w.componentKey}</span>
              </div>
              <div className="sails-widgets-tab__actions">
                <button
                  className="sails-widgets-tab__btn-icon"
                  onClick={() => handleToggle(w)}
                  title={w.enabled ? 'Disable' : 'Enable'}
                >
                  <SwitchCamera size={14} style={{ opacity: w.enabled ? 1 : 0.4 }} />
                </button>
                <button
                  className="sails-widgets-tab__btn-icon"
                  onClick={() => handleMove(w.id, -1)}
                  disabled={i === 0}
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  className="sails-widgets-tab__btn-icon"
                  onClick={() => handleMove(w.id, 1)}
                  disabled={i === widgets.length - 1}
                >
                  <ChevronDown size={14} />
                </button>
                <button
                  className="sails-widgets-tab__btn-icon sails-widgets-tab__btn-icon--danger"
                  onClick={() => handleDelete(w.id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WidgetsTab;
