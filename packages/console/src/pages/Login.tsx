import React from 'react';
import './Login.css';
import { LogIn } from 'lucide-react';

const Login: React.FC = () => {
  const handleGoogleLogin = async () => {
    try {
      // Use relative paths to take advantage of the Vite proxy and avoid CORS issues
      const authPath = '/api/auth';
      
      // Fetch CSRF token for security
      const csrfRes = await fetch(`${authPath}/csrf`);
      const { csrfToken } = await csrfRes.json();

      // Create a hidden form to trigger the POST request
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = `${authPath}/signin/google`;

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
    } catch (error) {
      console.error('Failed to initiate Google login:', error);
    }
  };

  return (
    <div className="klao-login-container">
      <div className="klao-login-card">
        <div className="klao-login-header">
          <div className="klao-login-logo">
            <span className="logo-text">KLAO</span>
          </div>
          <h1>Internal Operating System</h1>
          <p>Secure access for Ignite Idea staff</p>
        </div>

        <div className="klao-login-content">
          <button className="google-login-button" onClick={handleGoogleLogin}>
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" />
            <span>Sign in with Google</span>
          </button>
          
          <div className="login-divider">
            <span>Admin Access</span>
          </div>

          <button className="admin-login-button" onClick={() => window.location.href = '/admin-login'}>
            <LogIn size={18} />
            <span>Administrator Login</span>
          </button>
        </div>

        <div className="klao-login-footer">
          <p>© 2026 Ignite Idea. Internal Use Only.</p>
        </div>
      </div>
      
      {/* Background Decor */}
      <div className="login-bg-blob blob-1"></div>
      <div className="login-bg-blob blob-2"></div>
    </div>
  );
};

export default Login;
