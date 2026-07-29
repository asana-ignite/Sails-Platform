import React, { Suspense, useState, useRef, useEffect, useCallback } from 'react';
import { Pin, PinOff } from 'lucide-react';
import { ConsoleWidget } from '@sails/shared';
import { WidgetRegistry } from '../../features/widgets/registry';
import './WidgetBar.css';

interface WidgetBarProps {
  widgets: ConsoleWidget[];
}

const WidgetBar: React.FC<WidgetBarProps> = ({ widgets }) => {
  const [docked, setDocked] = useState(true);
  const [revealed, setRevealed] = useState(true);
  const dockedRef = useRef(docked);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const enabledWidgets = widgets.filter(w => w.enabled !== false);

  const scheduleAutoHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setRevealed(false), 500);
  }, []);

  const reveal = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setRevealed(true);
  }, []);

  const toggleDock = useCallback(() => {
    setDocked(prev => {
      const next = !prev;
      dockedRef.current = next;
      if (next) {
        setRevealed(true);
        if (hideTimer.current) clearTimeout(hideTimer.current);
      } else {
        scheduleAutoHide();
      }
      return next;
    });
  }, [scheduleAutoHide]);

  const handleMouseLeave = useCallback(() => {
    if (dockedRef.current) return;
    scheduleAutoHide();
  }, [scheduleAutoHide]);

  useEffect(() => {
    dockedRef.current = docked;
  }, [docked]);

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  if (enabledWidgets.length === 0) return null;

  const isHidden = !docked && !revealed;

  return (
    <>
      {!docked && (
        <div className="sails-widget-bar__detector" onMouseEnter={reveal} />
      )}
      <footer
        className={`sails-widget-bar${isHidden ? ' sails-widget-bar--hidden' : ''}`}
        onMouseEnter={reveal}
        onMouseLeave={handleMouseLeave}
      >
        <div className="sails-widget-bar__items">
          {enabledWidgets.map(widget => {
            const Component = widget.componentKey ? WidgetRegistry[widget.componentKey] : null;

            return (
              <div key={widget.id} className="sails-widget-bar__item">
                {Component ? (
                  <Suspense fallback={
                    <span className="sails-widget-bar__label">{widget.label}</span>
                  }>
                    <Component config={widget.config} />
                  </Suspense>
                ) : (
                  <span className="sails-widget-bar__label">{widget.label}</span>
                )}
              </div>
            );
          })}
        </div>
        <button
          className="sails-widget-bar__toggle"
          onClick={toggleDock}
          title={docked ? 'Unpin (auto-hide)' : 'Pin (always visible)'}
        >
          {docked ? <PinOff size={14} /> : <Pin size={14} />}
        </button>
      </footer>
    </>
  );
};

export default WidgetBar;
