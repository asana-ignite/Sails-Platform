/**
 * UiPillTabs — Segmented pill tab switcher (e.g. Monthly / Yearly / Weekly).
 */
import React from 'react';

export interface UiPillTabItem {
  id: string;
  label: React.ReactNode;
}

export interface UiPillTabsProps {
  tabs: (UiPillTabItem | string)[];
  activeTab: string;
  onChange: (id: string) => void;
  size?: 'sm' | 'md';
  className?: string;
  style?: React.CSSProperties;
}

export const UiPillTabs: React.FC<UiPillTabsProps> = ({
  tabs,
  activeTab,
  onChange,
  size = 'md',
  className = '',
  style,
}) => {
  return (
    <div className={`ui-pill-tabs ui-pill-tabs--${size} ${className}`} style={style}>
      {tabs.map((tab) => {
        const id = typeof tab === 'string' ? tab : tab.id;
        const label = typeof tab === 'string' ? tab : tab.label;
        const isActive = activeTab === id;

        return (
          <button
            key={id}
            type="button"
            className={`ui-pill-tab ${isActive ? 'ui-pill-tab--active' : ''}`}
            onClick={() => onChange(id)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
};

export default UiPillTabs;
