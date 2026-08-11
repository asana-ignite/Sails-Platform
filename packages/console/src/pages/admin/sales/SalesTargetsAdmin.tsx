import React from 'react';

const SalesTargetsAdmin: React.FC = () => {
  return (
    <div className="sails-admin-content">
      <section className="sails-page-header">
        <h1 className="sails-page-header__title">Sales Targets</h1>
        <p className="sails-page-header__subtitle">
          Set and manage sales targets for teams and individuals.
        </p>
      </section>
      <div className="sails-card">
        <div className="sails-dashboard__placeholder">
          <p>Sales Targets configuration will appear here.</p>
        </div>
      </div>
    </div>
  );
};

export default SalesTargetsAdmin;
