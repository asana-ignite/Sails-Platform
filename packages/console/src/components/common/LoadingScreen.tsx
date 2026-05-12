import React from 'react';
import './LoadingScreen.css';

const LoadingScreen: React.FC = () => {
  return (
    <div className="inidos-loading-screen">
      <div className="inidos-loading-screen__spinner">
        <div className="inidos-loading-screen__dot"></div>
        <div className="inidos-loading-screen__dot"></div>
        <div className="inidos-loading-screen__dot"></div>
      </div>
      <p className="inidos-loading-screen__text">Loading Workspace...</p>
    </div>
  );
};

export default LoadingScreen;
