/**
 * Unauthorized — 403-style screen for missing permissions.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldAlert, Home, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './Unauthorized.css';

const Unauthorized: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="sails-unauthorized">
      <div className="sails-unauthorized__content">
        <div className="sails-unauthorized__icon">
          <ShieldAlert size={64} />
        </div>
        <h1 className="sails-unauthorized__title">{t('common.unauthorized.title')}</h1>
        <p className="sails-unauthorized__message">
          {t('common.unauthorized.message')}
        </p>
        <div className="sails-unauthorized__actions">
          <button 
            className="sails-unauthorized__btn sails-unauthorized__btn--secondary"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={18} />
            <span>{t('common.unauthorized.goBack')}</span>
          </button>
          <button 
            className="sails-unauthorized__btn sails-unauthorized__btn--primary"
            onClick={() => navigate('/dashboard')}
          >
            <Home size={18} />
            <span>{t('common.unauthorized.dashboard')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Unauthorized;
