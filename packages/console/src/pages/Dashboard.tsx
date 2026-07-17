import React from 'react';
import { Users, TrendingUp, DollarSign, Clock } from 'lucide-react';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const stats = [
    { label: 'Total Leads', value: '2,845', icon: <Users size={24} />, color: 'var(--klao-primary)', bgColor: 'var(--klao-primary-light)' },
    { label: 'Conversion Rate', value: '12.5%', icon: <TrendingUp size={24} />, color: 'var(--klao-success)', bgColor: 'var(--klao-success-light)' },
    { label: 'Revenue', value: '$45,210', icon: <DollarSign size={24} />, color: 'var(--klao-info)', bgColor: 'var(--klao-info-light)' },
    { label: 'Avg. Response', value: '4m 32s', icon: <Clock size={24} />, color: 'var(--klao-warning)', bgColor: 'var(--klao-warning-light)' },
  ];

  return (
    <div className="klao-dashboard">
      <header className="klao-page-header">
        <h1 className="klao-page-header__title">Dashboard</h1>
        <p className="klao-page-header__subtitle">Welcome back, here's what's happening with your leads today.</p>
      </header>

      <section className="klao-dashboard__stats">
        {stats.map((stat, index) => (
          <div key={index} className="klao-card klao-stat-card">
            <div className="klao-stat-card__content">
              <span className="klao-stat-card__label">{stat.label}</span>
              <h2 className="klao-stat-card__value">{stat.value}</h2>
            </div>
            <div 
              className="klao-stat-card__icon-wrapper" 
              style={{ color: stat.color, backgroundColor: stat.bgColor }}
            >
              {stat.icon}
            </div>
          </div>
        ))}
      </section>

      <section className="klao-dashboard__content">
        <div className="klao-card">
          <h3 className="klao-dashboard__section-title">Recent Activity</h3>
          <div className="klao-dashboard__placeholder">
            {/* Placeholder for future activity list */}
            <p>Your recent activity will appear here once the system starts collecting data.</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
