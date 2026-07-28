import React, { useState, useEffect } from 'react';
import './Login.css';
import { 
  LogIn, 
  Lock, 
  Mail, 
  Key, 
  ShieldCheck, 
  Zap, 
  UserCheck, 
  Database, 
  Code, 
  Activity, 
  Layers, 
  Settings, 
  ShieldAlert, 
  Cpu, 
  Building 
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface SSOConfigState {
  googleEnabled: boolean;
  entraEnabled: boolean;
  samlEnabled: boolean;
  allowPasswordLogin: boolean;
}

const DEFAULT_SSO_CONFIG: SSOConfigState = {
  googleEnabled: true,
  entraEnabled: true,
  samlEnabled: false,
  allowPasswordLogin: true
};

interface Benefit {
  id: number;
  title: string;
  desc: string;
  icon: string;
}

const PLATFORM_BENEFITS: Benefit[] = [
  { id: 1, title: 'Zero Lock-In Extensibility', desc: 'Inject custom JS logic directly via BYOC', icon: 'code' },
  { id: 2, title: 'Enterprise SSO Protection', desc: 'Secure logins via Google and Entra ID', icon: 'shield' },
  { id: 3, title: '10x Faster Provisioning', desc: 'Auto-create profiles & roles with JIT flow', icon: 'user' },
  { id: 4, title: 'Sub-Millisecond Speed', desc: 'Sustained 10,000 OPS operations engine', icon: 'zap' },
  { id: 5, title: 'Codeless Data Modeling', desc: 'Design tables & schemas directly in UI', icon: 'database' },
  { id: 7, title: 'Immutable Auditing', desc: 'Fully asynchronous real-time logging', icon: 'activity' },
  { id: 8, title: 'Sub-Tenant Multi-Tenancy', desc: 'Isolate branches & business units', icon: 'layers' },
  { id: 9, title: 'Reduced Operational Overhead', desc: 'IT-free custom navigation menu builder', icon: 'settings' },
  { id: 10, title: 'Zero-Trust Access Control', desc: 'Granular Role-Based Access Control policies', icon: 'lock' },
  { id: 11, title: 'Disaster-Proof Security', desc: 'Emergency Break-Glass bypass configuration', icon: 'shield-alert' },
  { id: 12, title: 'Future-Proof Indexing', desc: 'Optimized PostgreSQL B-Tree string keys', icon: 'cpu' },
  { id: 13, title: 'Flexible Hybrid Auth', desc: 'SSO for staff, local password for vendors', icon: 'key' },
  { id: 14, title: 'Centralized Governance', desc: 'Consolidated admin workspace management', icon: 'building' }
];

const getRandomBenefits = (): Benefit[] => {
  const shuffled = [...PLATFORM_BENEFITS].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 3);
};

const getRememberedName = (): string | null => {
  if (typeof window === 'undefined') return null;
  const localName = localStorage.getItem('sails_user_name') || localStorage.getItem('remembered_user_name');
  if (localName) return localName;
  const match = document.cookie.match(/(?:^|; )sails_user_name=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
};

const Login: React.FC = () => {
  const [ssoConfig, setSsoConfig] = useState<SSOConfigState>(DEFAULT_SSO_CONFIG);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rememberedName, setRememberedName] = useState<string | null>(null);
  const [selectedBenefits, setSelectedBenefits] = useState<Benefit[]>([]);
  const { logoLightUrl, logoDarkUrl, themeMode } = useTheme();

  useEffect(() => {
    const name = getRememberedName();
    if (name) {
      setRememberedName(name);
    }
    setSelectedBenefits(getRandomBenefits());
  }, []);

  const renderBenefitIcon = (iconName: string) => {
    switch (iconName) {
      case 'shield': return <ShieldCheck size={20} style={{ color: 'var(--sails-primary)' }} />;
      case 'zap': return <Zap size={20} style={{ color: '#4ec5ad' }} />;
      case 'database': return <Database size={20} style={{ color: 'var(--sails-info)' }} />;
      case 'code': return <Code size={20} style={{ color: 'var(--sails-warning)' }} />;
      case 'user': return <UserCheck size={20} style={{ color: '#4ec5ad' }} />;
      case 'activity': return <Activity size={20} style={{ color: 'var(--sails-danger)' }} />;
      case 'layers': return <Layers size={20} style={{ color: 'var(--sails-primary)' }} />;
      case 'settings': return <Settings size={20} style={{ color: 'var(--sails-primary-dark)' }} />;
      case 'lock': return <Lock size={20} style={{ color: 'var(--sails-primary)' }} />;
      case 'shield-alert': return <ShieldAlert size={20} style={{ color: 'var(--sails-danger)' }} />;
      case 'cpu': return <Cpu size={20} style={{ color: 'var(--sails-primary-dark)' }} />;
      case 'key': return <Key size={20} style={{ color: 'var(--sails-warning)' }} />;
      case 'building': return <Building size={20} style={{ color: 'var(--sails-primary)' }} />;
      default: return <ShieldCheck size={20} />;
    }
  };

  const handleSSOLogin = async (provider: 'google' | 'azure-ad' | 'saml') => {
    try {
      const authPath = '/api/auth';
      const csrfRes = await fetch(`${authPath}/csrf`);
      const { csrfToken } = await csrfRes.json();

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = `${authPath}/signin/${provider}`;

      const csrfInput = document.createElement('input');
      csrfInput.type = 'hidden';
      csrfInput.name = 'csrfToken';
      csrfInput.value = csrfToken;
      form.appendChild(csrfInput);

      const callbackInput = document.createElement('input');
      callbackInput.type = 'hidden';
      callbackInput.name = 'callbackUrl';
      callbackInput.value = window.location.origin + '/dashboard';
      form.appendChild(callbackInput);

      document.body.appendChild(form);
      form.submit();
    } catch (err) {
      console.error(`Failed to initiate ${provider} login:`, err);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const authPath = '/api/auth';
      const response = await fetch(`${authPath}/callback/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          csrfToken: await (await fetch(`${authPath}/csrf`)).json().then(res => res.csrfToken),
          json: true
        })
      });

      if (response.ok) {
        if (rememberMe && email) {
          const userName = email.split('@')[0];
          const formattedName = userName.charAt(0).toUpperCase() + userName.slice(1);
          localStorage.setItem('sails_user_name', formattedName);
          document.cookie = `sails_user_name=${encodeURIComponent(formattedName)}; path=/; max-age=2592000;`;
        }
        window.location.href = '/dashboard';
      } else {
        const data = await response.json();
        setError(data.error || 'Invalid credentials');
      }
    } catch (err) {
      setError('An error occurred during login');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="sails-auth-layout">
      {/* Left Column: Sign In Form (38% width on desktop) */}
      <div className="sails-auth-form-side">
        <div className="sails-auth-form-wrapper">
          <div className="sails-auth-brand">
            <img src={themeMode === 'dark' ? logoDarkUrl : logoLightUrl} alt="SAILS Logo" className="sails-auth-logo-img" />
            <span className="sails-auth-logo-text">SAILS</span>
          </div>

          <div>
            <h2 className="sails-auth-title">Sign In</h2>
            <p className="sails-auth-subtitle">Access your admin dashboard & operating system.</p>
          </div>

          {error && <div className="login-error">{error}</div>}

          <div className="sails-auth-sso-grid">
            {ssoConfig.googleEnabled && (
              <button className="google-login-button" onClick={() => handleSSOLogin('google')}>
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" />
                <span>Sign in with Google</span>
              </button>
            )}

            {ssoConfig.entraEnabled && (
              <button className="microsoft-login-button" onClick={() => handleSSOLogin('azure-ad')}>
                <svg width="20" height="20" viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="1" y="1" width="10" height="10" fill="#F25022"/>
                  <rect x="12" y="1" width="10" height="10" fill="#7FBA00"/>
                  <rect x="1" y="12" width="10" height="10" fill="#00A4EF"/>
                  <rect x="12" y="12" width="10" height="10" fill="#FFB900"/>
                </svg>
                <span>Sign in with Microsoft</span>
              </button>
            )}

            {ssoConfig.samlEnabled && (
              <button className="saml-login-button" onClick={() => handleSSOLogin('saml')}>
                <Key size={18} style={{ color: 'var(--sails-info)' }} />
                <span>Sign in with Enterprise SAML</span>
              </button>
            )}
          </div>

          {ssoConfig.allowPasswordLogin && (
            <>
              {(ssoConfig.googleEnabled || ssoConfig.entraEnabled || ssoConfig.samlEnabled) && (
                <div className="login-divider">
                  <span>or sign in with email</span>
                </div>
              )}

              <form onSubmit={handlePasswordLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="input-group">
                  <Mail size={18} />
                  <input 
                    type="email" 
                    placeholder="name@example.com" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="input-group">
                  <Lock size={18} />
                  <input 
                    type="password" 
                    placeholder="Password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="sails-auth-options">
                  <label className="sails-auth-remember">
                    <input 
                      type="checkbox" 
                      checked={rememberMe} 
                      onChange={(e) => setRememberMe(e.target.checked)} 
                    />
                    <span>Remember me</span>
                  </label>
                  <a href="#forgot" onClick={(e) => { e.preventDefault(); alert('Please contact your administrator to reset your password.'); }} className="sails-auth-forgot">
                    Forgot password?
                  </a>
                </div>

                <button 
                  className="google-login-button" 
                  type="submit" 
                  disabled={isLoading} 
                  style={{ backgroundColor: 'var(--sails-primary-dark)', color: 'white', border: 'none', padding: '13px' }}
                >
                  <span>{isLoading ? 'Verifying...' : 'Sign In'}</span>
                </button>
              </form>
            </>
          )}


          <div className="sails-login-footer" style={{ marginTop: '10px' }}>
            <p>© 2026 Ignite Idea. SAILS Internal Platform.</p>
          </div>
        </div>
      </div>

      {/* Right Column: Hero Graphic Side (62% width on desktop) */}
      <div className="sails-auth-hero-side">
        <div className="sails-hero-gradient-overlay" />

        {/* 3 Random Floating Benefit Cards with Independent Animations */}
        {selectedBenefits.map((benefit, index) => (
          <div 
            key={benefit.id} 
            className={`sails-hero-floating-card sails-hero-floating-card--${index + 1}`}
          >
            {renderBenefitIcon(benefit.icon)}
            <div>
              <h6 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>{benefit.title}</h6>
              <small style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem' }}>{benefit.desc}</small>
            </div>
          </div>
        ))}

        <div className="sails-auth-hero-content">
          <h1 className="sails-hero-greeting" style={{ fontSize: '2.5rem' }}>
            {rememberedName ? `Welcome back, ${rememberedName}!` : 'Welcome to SAILS Platform'}
          </h1>
          <p className="sails-hero-subtext">
            Manage operations, monitor platform security, and automate business workflows with the intelligent internal operating system.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
