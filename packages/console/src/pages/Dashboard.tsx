import React from 'react';
import { Users, TrendingUp, DollarSign, Clock } from 'lucide-react';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const stats = [
    { label: 'Total Leads', value: '2,845', icon: <Users size={24} />, color: 'var(--inidos-primary)', bgColor: 'var(--inidos-primary-light)' },
    { label: 'Conversion Rate', value: '12.5%', icon: <TrendingUp size={24} />, color: 'var(--inidos-success)', bgColor: 'var(--inidos-success-light)' },
    { label: 'Revenue', value: '$45,210', icon: <DollarSign size={24} />, color: 'var(--inidos-info)', bgColor: 'var(--inidos-info-light)' },
    { label: 'Avg. Response', value: '4m 32s', icon: <Clock size={24} />, color: 'var(--inidos-warning)', bgColor: 'var(--inidos-warning-light)' },
  ];

  return (
    <div className="inidos-dashboard">
      <header className="inidos-page-header">
        <h1 className="inidos-page-header__title">Dashboard</h1>
        <p className="inidos-page-header__subtitle">Welcome back, here's what's happening with your leads today.</p>
      </header>

      <section className="inidos-dashboard__stats">
        {stats.map((stat, index) => (
          <div key={index} className="inidos-card inidos-stat-card">
            <div className="inidos-stat-card__content">
              <span className="inidos-stat-card__label">{stat.label}</span>
              <h2 className="inidos-stat-card__value">{stat.value}</h2>
            </div>
            <div 
              className="inidos-stat-card__icon-wrapper" 
              style={{ color: stat.color, backgroundColor: stat.bgColor }}
            >
              {stat.icon}
            </div>
          </div>
        ))}
      </section>

      <section className="inidos-dashboard__content">
        <div className="inidos-card">
          <h3 className="inidos-dashboard__section-title">Recent Activity</h3>
          <div className="inidos-dashboard__placeholder">
            {/* Placeholder for future activity list */}
            <p>Your recent activity will appear here once the system starts collecting data.</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
