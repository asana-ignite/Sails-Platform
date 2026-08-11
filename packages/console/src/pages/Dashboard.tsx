import React from 'react';
import { useTranslation } from 'react-i18next';
import { Users, TrendingUp, DollarSign, Clock } from 'lucide-react';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const stats = [
    { label: t('common.dashboard.totalLeads'), value: '2,845', icon: <Users size={24} />, color: 'var(--sails-primary)', bgColor: 'var(--sails-primary-light)' },
    { label: t('common.dashboard.conversionRate'), value: '12.5%', icon: <TrendingUp size={24} />, color: 'var(--sails-success)', bgColor: 'var(--sails-success-light)' },
    { label: t('common.dashboard.revenue'), value: '$45,210', icon: <DollarSign size={24} />, color: 'var(--sails-info)', bgColor: 'var(--sails-info-light)' },
    { label: t('common.dashboard.avgResponse'), value: '4m 32s', icon: <Clock size={24} />, color: 'var(--sails-warning)', bgColor: 'var(--sails-warning-light)' },
  ];

  return (
    <div className="sails-dashboard">
      <header className="sails-page-header">
        <h1 className="sails-page-header__title">{t('common.dashboard.title')}</h1>
        <p className="sails-page-header__subtitle">{t('common.dashboard.welcome')}</p>
      </header>

      <section className="sails-dashboard__stats">
        {stats.map((stat) => (
          <div key={stat.label} className="sails-card sails-stat-card">
            <div className="sails-stat-card__content">
              <span className="sails-stat-card__label">{stat.label}</span>
              <h2 className="sails-stat-card__value">{stat.value}</h2>
            </div>
            <div 
              className="sails-stat-card__icon-wrapper" 
              style={{ color: stat.color, backgroundColor: stat.bgColor }}
            >
              {stat.icon}
            </div>
          </div>
        ))}
      </section>

      <section className="sails-dashboard__content">
        <div className="sails-card">
          <h3 className="sails-dashboard__section-title">{t('common.dashboard.recentActivity')}</h3>
          <div className="sails-dashboard__placeholder">
            <p>{t('common.dashboard.noActivity')}</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
