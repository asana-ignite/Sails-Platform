import React from 'react';

const PipelineStagesAdmin: React.FC = () => {
  return (
    <div className="sails-admin-content">
      <section className="sails-page-header">
        <h1 className="sails-page-header__title">Pipeline Stages</h1>
        <p className="sails-page-header__subtitle">
          Define and reorder deal pipeline stages.
        </p>
      </section>
      <div className="sails-card">
        <div className="sails-dashboard__placeholder">
          <p>Pipeline Stages configuration will appear here.</p>
        </div>
      </div>
    </div>
  );
};

export default PipelineStagesAdmin;
