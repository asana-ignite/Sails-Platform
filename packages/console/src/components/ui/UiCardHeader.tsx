/**
 * UiCardHeader — Standardized card header container with title, subtitle and addon slot.
 */
import React from 'react';

export interface UiCardHeaderProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  addon?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export const UiCardHeader: React.FC<UiCardHeaderProps> = ({
  title,
  subtitle,
  addon,
  className = '',
  children,
  style,
}) => {
  return (
    <div className={`ui-card-header ${className}`} style={style}>
      {children || (
        <>
          <div className="ui-card-header__left">
            {title && <h5 className="ui-card-header__title">{title}</h5>}
            {subtitle && <p className="ui-card-header__subtitle">{subtitle}</p>}
          </div>
          {addon && <div className="ui-card-header__addon">{addon}</div>}
        </>
      )}
    </div>
  );
};

export const UiCardBody: React.FC<{ className?: string; children?: React.ReactNode; style?: React.CSSProperties }> = ({
  className = '',
  children,
  style,
}) => <div className={`ui-card-body ${className}`} style={style}>{children}</div>;

export const UiCardFooter: React.FC<{ className?: string; children?: React.ReactNode; style?: React.CSSProperties }> = ({
  className = '',
  children,
  style,
}) => <div className={`ui-card-footer ${className}`} style={style}>{children}</div>;

export default UiCardHeader;
