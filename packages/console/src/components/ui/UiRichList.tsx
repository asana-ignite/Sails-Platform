/**
 * UiRichList — Standard 3-zone list primitive (Prepend + Content + Append)
 * Used for top products, customer lists, platform distributions, and activity feeds.
 */
import React from 'react';

export interface UiRichListItemProps {
  prepend?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  append?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export const UiRichListItem: React.FC<UiRichListItemProps> = ({
  prepend,
  title,
  subtitle,
  append,
  onClick,
  className = '',
  style,
}) => {
  return (
    <div
      className={`ui-rich-list-item ${onClick ? 'ui-rich-list-item--clickable' : ''} ${className}`}
      onClick={onClick}
      style={style}
    >
      {prepend && <div className="ui-rich-list-prepend">{prepend}</div>}
      <div className="ui-rich-list-content">
        <div className="ui-rich-list-title">{title}</div>
        {subtitle && <div className="ui-rich-list-subtitle">{subtitle}</div>}
      </div>
      {append && <div className="ui-rich-list-append">{append}</div>}
    </div>
  );
};

export interface UiRichListProps {
  children: React.ReactNode;
  maxHeight?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

export const UiRichList: React.FC<UiRichListProps> = ({
  children,
  maxHeight,
  className = '',
  style = {},
}) => {
  const containerStyle: React.CSSProperties = {
    ...style,
    ...(maxHeight ? { maxHeight, overflowY: 'auto' } : {}),
  };

  return (
    <div
      className={`ui-rich-list ${maxHeight ? 'sails-scroll-area' : ''} ${className}`}
      style={containerStyle}
    >
      {children}
    </div>
  );
};

export default UiRichList;
