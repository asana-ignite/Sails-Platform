import React from 'react';
import './LoadingScreen.css';

const LoadingScreen: React.FC = () => {
  return (
    <div className="klao-loading-screen">
      <div className="klao-loading-screen__spinner">
        <div className="klao-loading-screen__dot"></div>
        <div className="klao-loading-screen__dot"></div>
        <div className="klao-loading-screen__dot"></div>
      </div>
      <p className="klao-loading-screen__text">Loading Workspace...</p>
    </div>
  );
};

export default LoadingScreen;
