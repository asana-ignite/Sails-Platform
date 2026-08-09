import React, { useEffect, useState } from 'react';
import './Login.css';
import './Signout.css';
import { ShieldCheck, RotateCcw } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const REDIRECT_SECONDS = 5;

const Signout: React.FC = () => {
  const { logoLightUrl, logoDarkUrl, themeMode } = useTheme();
  const [countdown, setCountdown] = useState(REDIRECT_SECONDS);
  const [signedOut, setSignedOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const performSignout = async () => {
      try {
        const csrfRes = await fetch('/api/auth/csrf');
        const { csrfToken } = await csrfRes.json();
        await fetch('/api/auth/signout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csrfToken, json: true }),
        });
      } catch (err) {
        console.error('Signout failed:', err);
      } finally {
        if (!cancelled) setSignedOut(true);
      }
    };
    performSignout();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!signedOut || countdown <= 0) {
      if (countdown <= 0) window.location.href = '/login';
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, signedOut]);

  return (
    <div className="sails-auth-layout">
      {/* Left Column: Sign Out Status */}
      <div className="sails-auth-form-side">
        <div className="sails-auth-form-wrapper">
          <div className="sails-auth-brand">
            <img src={themeMode === 'dark' ? logoDarkUrl : logoLightUrl} alt="SAILS Logo" className="sails-auth-logo-img" />
            <span className="sails-auth-logo-text">Sails</span>
          </div>

          <div className="sails-signout-status">
            <div className="sails-signout-icon">
              <ShieldCheck size={28} />
            </div>
            <div>
              <h2 className="sails-auth-title">Signed Out</h2>
              <p className="sails-auth-subtitle">
                Your session has been ended securely. All local authentication tokens have been cleared.
              </p>
            </div>
          </div>

          <a href="/login" className="sails-signout-button">
            <RotateCcw size={16} />
            <span>Sign In Again</span>
          </a>

          {signedOut && (
            <p className="sails-signout-hint">
              Redirecting to the sign-in page in {countdown}s...
            </p>
          )}

          <div className="sails-login-footer">
            <p>© 2026 Ignite Idea. Sails Internal Platform.</p>
          </div>
        </div>
      </div>

      {/* Right Column: Hero Side */}
      <div className="sails-auth-hero-side">
        <div className="sails-hero-gradient-overlay" />

        <div className="sails-auth-hero-content">
          <h1 className="sails-hero-greeting">See you next time!</h1>
          <p className="sails-hero-subtext">
            Thank you for using the Sails Platform. Your data stays secure while you're away — sign back in whenever you're ready.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signout;
