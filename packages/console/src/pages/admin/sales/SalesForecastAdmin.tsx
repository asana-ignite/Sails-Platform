/**
 * Sales admin — sales forecast.
 */
import React from 'react';

const SalesForecastAdmin: React.FC = () => {
  return (
    <div className="sails-admin-content">
      <section className="sails-page-header">
        <h1 className="sails-page-header__title">Sales Forecast</h1>
        <p className="sails-page-header__subtitle">
          Configure forecast categories and projection models.
        </p>
      </section>
      <div className="sails-card">
        <div className="sails-dashboard__placeholder">
          <p>Sales Forecast configuration will appear here.</p>
        </div>
      </div>
    </div>
  );
};

export default SalesForecastAdmin;
