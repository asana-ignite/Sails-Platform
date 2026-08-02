import React from 'react';

const LoadingScreen: React.FC = () => {
  return (
    <div className="sails-loading-screen">
      <div className="sails-loading-screen__spinner">
        <div className="sails-loading-screen__dot"></div>
        <div className="sails-loading-screen__dot"></div>
        <div className="sails-loading-screen__dot"></div>
      </div>
      <p className="sails-loading-screen__text">Loading Workspace...</p>
    </div>
  );
};

export default LoadingScreen;
