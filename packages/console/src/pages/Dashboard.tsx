import React from 'react';
import { Users, TrendingUp, DollarSign, Clock } from 'lucide-react';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const stats = [
    { label: 'Total Leads', value: '2,845', icon: <Users size={24} />, color: 'var(--sails-primary)', bgColor: 'var(--sails-primary-light)' },
    { label: 'Conversion Rate', value: '12.5%', icon: <TrendingUp size={24} />, color: 'var(--sails-success)', bgColor: 'var(--sails-success-light)' },
    { label: 'Revenue', value: '$45,210', icon: <DollarSign size={24} />, color: 'var(--sails-info)', bgColor: 'var(--sails-info-light)' },
    { label: 'Avg. Response', value: '4m 32s', icon: <Clock size={24} />, color: 'var(--sails-warning)', bgColor: 'var(--sails-warning-light)' },
  ];

  return (
    <div className="sails-dashboard">
      <header className="sails-page-header">
        <h1 className="sails-page-header__title">Dashboard</h1>
        <p className="sails-page-header__subtitle">Welcome back, here's what's happening with your leads today.</p>
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
          <h3 className="sails-dashboard__section-title">Recent Activity</h3>
          <div className="sails-dashboard__placeholder">
            {/* Placeholder for future activity list */}
            <p>Your recent activity will appear here once the system starts collecting data.</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
