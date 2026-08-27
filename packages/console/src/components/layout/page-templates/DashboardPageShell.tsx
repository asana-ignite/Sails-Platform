/**
 * DashboardPageShell — 2-Column Responsive Dashboard Page Template
 * Ghost Glass standard BEM layout shell with header, main content flow,
 * and optional side content rail for analytics, distribution, and dispatch widgets.
 */
import React from 'react';
import './DashboardPageShell.css';

export interface DashboardPageShellProps {
  header?: React.ReactNode;
  sideContent?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const DashboardPageShell: React.FC<DashboardPageShellProps> = ({
  header,
  sideContent,
  children,
  className = '',
  style,
}) => {
  return (
    <div className={`sails-page-shell sails-dashboard-shell ${className}`} style={style}>
      {header && <header className="sails-dashboard-shell__header">{header}</header>}
      
      <div className={`sails-dashboard-shell__body ${sideContent ? 'sails-dashboard-shell__body--with-side' : ''}`}>
        <main className="sails-dashboard-shell__main">
          {children}
        </main>
        
        {sideContent && (
          <aside className="sails-dashboard-shell__side">
            {sideContent}
          </aside>
        )}
      </div>
    </div>
  );
};

export default DashboardPageShell;
