/**
 * UiKpiCard — Executive KPI stat metric card with optional circular progress meter,
 * directional percentage trend chips, and contextual actions.
 */
import React, { useState, useRef, useEffect } from 'react';
import { TrendingUp, TrendingDown, MoreHorizontal } from 'lucide-react';

export type UiKpiTone = 'primary' | 'success' | 'warning' | 'danger' | 'info';

export interface UiKpiTrend {
  value: string | number;
  direction?: 'up' | 'down';
  label?: string;
}

export interface UiKpiCardProps {
  title: string;
  value: string | number;
  unit?: string;
  trend?: UiKpiTrend;
  icon?: React.ReactNode;
  progress?: number; // 0 to 100
  tone?: UiKpiTone;
  menuOptions?: string[];
  onMenuSelect?: (option: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

export const UiKpiCard: React.FC<UiKpiCardProps> = ({
  title,
  value,
  unit,
  trend,
  icon,
  progress,
  tone = 'primary',
  menuOptions,
  onMenuSelect,
  className = '',
  style,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  // SVG Circular progress constants
  const size = 44;
  const strokeWidth = 3.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = progress !== undefined ? circumference - (progress / 100) * circumference : 0;

  return (
    <div className={`ui-kpi-card ui-kpi-card--${tone} ${className}`} style={style}>
      <div className="ui-kpi-card__top">
        <div className="ui-kpi-card__info">
          <span className="ui-kpi-card__title">{title}</span>
          {trend && (
            <div className="ui-kpi-card__trend-row">
              <span className={`ui-kpi-card__trend ui-kpi-card__trend--${trend.direction || 'up'}`}>
                {trend.direction === 'down' ? (
                  <TrendingDown size={13} className="ui-kpi-card__trend-icon" />
                ) : (
                  <TrendingUp size={13} className="ui-kpi-card__trend-icon" />
                )}
                {trend.value}
              </span>
              {trend.label && <span className="ui-kpi-card__trend-label">{trend.label}</span>}
            </div>
          )}
        </div>

        {/* Circular Progress Gauge & Icon Avatar */}
        <div className="ui-kpi-card__avatar-progress">
          {progress !== undefined && (
            <svg className="ui-kpi-card__progress-svg" width={size} height={size}>
              <circle
                className="ui-kpi-card__progress-bg"
                cx={size / 2}
                cy={size / 2}
                r={radius}
                strokeWidth={strokeWidth}
              />
              <circle
                className="ui-kpi-card__progress-circle"
                cx={size / 2}
                cy={size / 2}
                r={radius}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
              />
            </svg>
          )}
          <div className={`ui-kpi-card__icon-badge ui-kpi-card__icon-badge--${tone}`}>
            {icon}
          </div>
        </div>
      </div>

      <div className="ui-kpi-card__bottom">
        <div className="ui-kpi-card__value-group">
          <span className="ui-kpi-card__value">{value}</span>
          {unit && <span className="ui-kpi-card__unit">{unit}</span>}
        </div>

        {menuOptions && menuOptions.length > 0 && (
          <div className="ui-kpi-card__menu-wrapper" ref={menuRef}>
            <button
              type="button"
              className="ui-kpi-card__menu-btn"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Options"
            >
              <MoreHorizontal size={16} />
            </button>
            {isMenuOpen && (
              <div className="ui-kpi-card__dropdown">
                {menuOptions.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className="ui-kpi-card__dropdown-item"
                    onClick={() => {
                      onMenuSelect?.(opt);
                      setIsMenuOpen(false);
                    }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default UiKpiCard;
