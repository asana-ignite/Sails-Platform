import React, { useState } from 'react';
import './Login.css';
import { Lock, User, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AdminLogin: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

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
    <div className="klao-login-container">
      <div className="klao-login-card">
        <button className="back-button" onClick={() => navigate('/login')}>
          <ArrowLeft size={18} />
          <span>Back</span>
        </button>

        <div className="klao-login-header">
          <div className="klao-login-logo">
            <span className="logo-text">KLAO</span>
          </div>
          <h1>System Administrator</h1>
          <p>Login with your internal credentials</p>
        </div>

        <form className="klao-login-content" onSubmit={handleLogin}>
          {error && <div className="login-error">{error}</div>}
          
          <div className="input-group">
            <User size={18} />
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

          <button className="google-login-button" type="submit" disabled={isLoading} style={{ backgroundColor: 'var(--klao-primary-dark)', color: 'white' }}>
            <span>{isLoading ? 'Verifying...' : 'Sign In'}</span>
          </button>
        </form>

        <div className="klao-login-footer">
          <p>© 2026 Ignite Idea. Admin Portal.</p>
        </div>
      </div>
      
      <div className="login-bg-blob blob-1" style={{ background: 'var(--klao-danger)' }}></div>
      <div className="login-bg-blob blob-2" style={{ background: 'var(--klao-primary-dark)' }}></div>
    </div>
  );
};

export default AdminLogin;
