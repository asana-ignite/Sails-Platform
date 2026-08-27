/**
 * UiAvatar & UiAvatarGroup — Circular avatars and overlapping avatar stack cluster with +N badge.
 */
import React from 'react';

export type UiAvatarSize = '2xs' | 'xs' | 'sm' | 'md' | 'lg';

export interface UiAvatarProps {
  src?: string;
  name?: string;
  initials?: string;
  icon?: React.ReactNode;
  size?: UiAvatarSize;
  shape?: 'circle' | 'rounded';
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export const UiAvatar: React.FC<UiAvatarProps> = ({
  src,
  name,
  initials,
  icon,
  size = 'md',
  shape = 'circle',
  className = '',
  style,
  onClick,
}) => {
  const getInitials = (n?: string) => {
    if (!n) return '';
    return n
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  const displayText = initials || getInitials(name);

  return (
    <div
      className={`ui-avatar ui-avatar--${size} ui-avatar--${shape} ${onClick ? 'ui-avatar--clickable' : ''} ${className}`}
      style={style}
      onClick={onClick}
      title={name}
    >
      {src ? (
        <img src={src} alt={name || 'Avatar'} className="ui-avatar__img" />
      ) : icon ? (
        <span className="ui-avatar__icon">{icon}</span>
      ) : (
        <span className="ui-avatar__initials">{displayText}</span>
      )}
    </div>
  );
};

export interface UiAvatarGroupProps {
  children?: React.ReactNode;
  max?: number;
  size?: UiAvatarSize;
  className?: string;
  style?: React.CSSProperties;
}

export const UiAvatarGroup: React.FC<UiAvatarGroupProps> = ({
  children,
  max = 4,
  size = 'sm',
  className = '',
  style,
}) => {
  const items = React.Children.toArray(children);
  const visible = items.slice(0, max);
  const overflow = items.length - max;

  return (
    <div className={`ui-avatar-group ui-avatar-group--${size} ${className}`} style={style}>
      {visible.map((child, idx) => (
        <div key={idx} className="ui-avatar-group__item">
          {child}
        </div>
      ))}
      {overflow > 0 && (
        <div className={`ui-avatar ui-avatar--${size} ui-avatar--circle ui-avatar--overflow`}>
          <span>+{overflow}</span>
        </div>
      )}
    </div>
  );
};

export default UiAvatarGroup;
