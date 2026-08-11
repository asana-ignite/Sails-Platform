import React from 'react';
import { useTranslation } from 'react-i18next';

const LoadingScreen: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="sails-loading-screen">
      <div className="sails-loading-screen__spinner">
        <div className="sails-loading-screen__dot"></div>
        <div className="sails-loading-screen__dot"></div>
        <div className="sails-loading-screen__dot"></div>
      </div>
      <p className="sails-loading-screen__text">{t('common.loadingWorkspace')}</p>
    </div>
  );
};

export default LoadingScreen;
