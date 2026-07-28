import React, { useState, useEffect } from 'react';
import './Login.css';
import { 
  Lock, 
  Mail, 
  ArrowLeft, 
  ShieldCheck, 
  KeyRound, 
  Server, 
  Database, 
  Code, 
  Activity, 
  Layers, 
  Settings, 
  ShieldAlert, 
  Cpu, 
  Key, 
  Building,
  UserCheck,
  Zap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';

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

const AdminLogin: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBenefits, setSelectedBenefits] = useState<Benefit[]>([]);
  const { logoLightUrl, logoDarkUrl, themeMode } = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
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

  const handleLogin = async (e: React.FormEvent) => {
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
      {/* Left Column: Admin Sign-In Form (38% width on desktop) */}
      <div className="sails-auth-form-side">
        <div className="sails-auth-form-wrapper">
          <button className="sails-auth-back-btn" onClick={() => navigate('/login')}>
            <ArrowLeft size={16} />
            <span>Back to User Login</span>
          </button>

          <div className="sails-auth-brand">
            <img src={themeMode === 'dark' ? logoDarkUrl : logoLightUrl} alt="SAILS Logo" className="sails-auth-logo-img" />
            <span className="sails-auth-logo-text">SAILS</span>
          </div>

          <div>
            <h2 className="sails-auth-title">Admin Portal</h2>
            <p className="sails-auth-subtitle">System Administrator authentication for Sails Core.</p>
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {error && <div className="login-error">{error}</div>}
            
            <div className="input-group">
              <Mail size={18} />
              <input 
                type="email" 
                placeholder="Admin Email" 
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

            <button 
              className="google-login-button" 
              type="submit" 
              disabled={isLoading} 
              style={{ backgroundColor: 'var(--sails-primary-dark)', color: 'white', border: 'none', padding: '12px', marginTop: '4px' }}
            >
              <span>{isLoading ? 'Verifying Credentials...' : 'Sign In to Admin Portal'}</span>
            </button>
          </form>

          <div className="sails-login-footer" style={{ marginTop: '20px' }}>
            <p>© 2026 Ignite Idea. System Administration.</p>
          </div>
        </div>
      </div>

      {/* Right Column: Admin Hero Side (62% width on desktop) */}
      <div className="sails-auth-hero-side sails-auth-hero-side--admin">
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
            System Administrator Access
          </h1>
          <p className="sails-hero-subtext">
            Elevated administrative portal for managing tenants, data schemas, security policies, and platform services.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
