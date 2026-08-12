/* CS admin — agent routing configuration. */
import React from 'react';

const AgentRoutingAdmin: React.FC = () => {
  return (
    <div className="sails-admin-content">
      <section className="sails-page-header">
        <h1 className="sails-page-header__title">Agent Routing</h1>
        <p className="sails-page-header__subtitle">
          Configure ticket assignment rules and agent workload distribution.
        </p>
      </section>
      <div className="sails-card">
        <div className="sails-dashboard__placeholder">
          <p>Agent Routing configuration will appear here.</p>
        </div>
      </div>
    </div>
  );
};

export default AgentRoutingAdmin;
