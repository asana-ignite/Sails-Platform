import React from 'react';
import { ShieldAlert, Home, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './Unauthorized.css';

const Unauthorized: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="inidos-unauthorized">
      <div className="inidos-unauthorized__content">
        <div className="inidos-unauthorized__icon">
          <ShieldAlert size={64} />
        </div>
        <h1 className="inidos-unauthorized__title">Unauthorized Access</h1>
        <p className="inidos-unauthorized__message">
          Oops! You don't have the necessary permissions to access this area. 
          Please contact your administrator if you believe this is a mistake.
        </p>
        <div className="inidos-unauthorized__actions">
          <button 
            className="inidos-unauthorized__btn inidos-unauthorized__btn--secondary"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={18} />
            <span>Go Back</span>
          </button>
          <button 
            className="inidos-unauthorized__btn inidos-unauthorized__btn--primary"
            onClick={() => navigate('/dashboard')}
          >
            <Home size={18} />
            <span>Dashboard</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Unauthorized;
