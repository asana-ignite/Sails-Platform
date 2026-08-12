/**
 * CS admin — auto-reply rules.
 */
import React from 'react';

const AutoReplyRulesAdmin: React.FC = () => {
  return (
    <div className="sails-admin-content">
      <section className="sails-page-header">
        <h1 className="sails-page-header__title">Auto-Reply Rules</h1>
        <p className="sails-page-header__subtitle">
          Create and manage automated response rules for common inquiries.
        </p>
      </section>
      <div className="sails-card">
        <div className="sails-dashboard__placeholder">
          <p>Auto-Reply Rules configuration will appear here.</p>
        </div>
      </div>
    </div>
  );
};

export default AutoReplyRulesAdmin;
