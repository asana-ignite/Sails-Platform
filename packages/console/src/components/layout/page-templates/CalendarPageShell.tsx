/**
 * CalendarPageShell — Asymmetric 2-Column Calendar Archetype
 * Left companion sidebar (Mini datepicker + Active event + Upcoming agenda feed)
 * Right main interactive calendar canvas
 */
import React from 'react';
import './CalendarPageShell.css';

export interface CalendarPageShellProps {
  sidebar: React.ReactNode;
  children: React.ReactNode;
  title?: React.ReactNode;
  breadcrumbs?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const CalendarPageShell: React.FC<CalendarPageShellProps> = ({
  sidebar,
  children,
  title,
  breadcrumbs,
  className = '',
  style,
}) => {
  return (
    <div className={`sails-cal-page ${className}`} style={style}>
      {(title || breadcrumbs) && (
        <div className="sails-cal-page__header">
          {title && <h1 className="sails-cal-page__title">{title}</h1>}
          {breadcrumbs && <div className="sails-cal-page__breadcrumbs">{breadcrumbs}</div>}
        </div>
      )}
      <div className="sails-cal-page__grid">
        <aside className="sails-cal-page__sidebar">
          {sidebar}
        </aside>
        <main className="sails-cal-page__main">
          {children}
        </main>
      </div>
    </div>
  );
};

export default CalendarPageShell;
