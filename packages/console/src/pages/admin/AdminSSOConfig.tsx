import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  ShieldCheck, 
  Globe, 
  CheckCircle2, 
  XCircle, 
  Settings, 
  Copy, 
  Check, 
  Eye, 
  EyeOff, 
  Save, 
  RefreshCw, 
  AlertCircle, 
  X, 
  Lock,
  Sparkles,
  ShieldAlert,
  Building,
  Clock,
  Trash2,
  Plus
} from 'lucide-react';
import { CustomSelect, SelectOption } from '../../components/common/CustomSelect';
import './AdminSSOConfig.css';

interface ProviderConfig {
  id: 'google' | 'entra' | 'saml';
  name: string;
  type: string;
  iconClass: string;
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  tenantId?: string;
  metadataUrl?: string;
  allowedDomains: string;
  callbackUrl: string;
}

interface VerifiedDomain {
  id: string;
  domain: string;
  status: 'Verified' | 'Pending';
  txtRecord: string;
  addedOn: string;
}

const getOrigin = () => (typeof window !== 'undefined' ? window.location.origin : 'https://app.klao.io');

const DEFAULT_PROVIDERS: Record<'google' | 'entra' | 'saml', ProviderConfig> = {
  google: {
    id: 'google',
    name: 'Google Workspace',
    type: 'OpenID Connect (OIDC)',
    iconClass: 'klao-idp-card__icon--google',
    enabled: true,
    clientId: '849201938471-ab73x.apps.googleusercontent.com',
    clientSecret: 'GOCSPX-98237492387498237',
    allowedDomains: 'ignite-idea.com, klao.io',
    callbackUrl: `${getOrigin()}/api/auth/callback/google`
  },
  entra: {
    id: 'entra',
    name: 'Microsoft Entra ID',
    type: 'Azure AD / OAuth2',
    iconClass: 'klao-idp-card__icon--entra',
    enabled: true,
    clientId: '7c9e0123-4567-89ab-cdef-0123456789ab',
    clientSecret: 'm3S8Q~928374982374928374',
    tenantId: '3f2b1098-7654-3210-fedc-ba9876543210',
    allowedDomains: 'ignite-idea.com',
    callbackUrl: `${getOrigin()}/api/auth/callback/azure-ad`
  },
  saml: {
    id: 'saml',
    name: 'Enterprise SAML 2.0 / OIDC',
    type: 'Generic Okta / Ping / OneLogin',
    iconClass: 'klao-idp-card__icon--saml',
    enabled: false,
    clientId: '',
    clientSecret: '',
    metadataUrl: 'https://dev-12345.okta.com/app/exk12345/sso/saml/metadata',
    allowedDomains: '',
    callbackUrl: `${getOrigin()}/api/auth/callback/saml`
  }
};

const DEFAULT_DOMAINS: VerifiedDomain[] = [
  { id: '1', domain: 'ignite-idea.com', status: 'Verified', txtRecord: 'klao-verification=v1-98742918', addedOn: '2026-01-15' },
  { id: '2', domain: 'klao.io', status: 'Verified', txtRecord: 'klao-verification=v1-33821092', addedOn: '2026-03-10' },
];

const JIT_ROLE_OPTIONS: SelectOption[] = [
  { value: 'Member', label: 'Member (Standard Workspace Access)' },
  { value: 'Viewer', label: 'Viewer (Read-Only Access)' },
  { value: 'Admin', label: 'Admin (Full Administrative Privileges)' }
];

const SESSION_TIMEOUT_OPTIONS: SelectOption[] = [
  { value: '8', label: '8 Hours (Standard Business Day)' },
  { value: '12', label: '12 Hours' },
  { value: '24', label: '24 Hours (1 Day)' },
  { value: '168', label: '7 Days' }
];

type TabKey = 'policy' | 'providers' | 'domains' | 'safeguards';

const AdminSSOConfig: React.FC = () => {
  // Active Tab State
  const [activeTab, setActiveTab] = useState<TabKey>('policy');

  // 1. Tab 1 State & Saved Baseline
  const [allowPasswordLogin, setAllowPasswordLogin] = useState(true);
  const [ssoEnforcement, setSsoEnforcement] = useState<'optional' | 'mandatory'>('optional');
  const [jitProvisioning, setJitProvisioning] = useState(true);
  const [defaultRole, setDefaultRole] = useState('Member');

  const [savedPolicy, setSavedPolicy] = useState({
    allowPasswordLogin: true,
    ssoEnforcement: 'optional' as 'optional' | 'mandatory',
    jitProvisioning: true,
    defaultRole: 'Member'
  });

  // Check if Tab 1 is dirty
  const isPolicyDirty = 
    allowPasswordLogin !== savedPolicy.allowPasswordLogin ||
    ssoEnforcement !== savedPolicy.ssoEnforcement ||
    jitProvisioning !== savedPolicy.jitProvisioning ||
    defaultRole !== savedPolicy.defaultRole;

  // 2. Tab 2 State (Providers)
  const [providers, setProviders] = useState(DEFAULT_PROVIDERS);
  const [activeDrawerProvider, setActiveDrawerProvider] = useState<'google' | 'entra' | 'saml' | null>(null);

  // 3. Tab 3 State (Domains)
  const [domains, setDomains] = useState<VerifiedDomain[]>(DEFAULT_DOMAINS);
  const [newDomainInput, setNewDomainInput] = useState('');

  // 4. Tab 4 State (Safeguards) & Saved Baseline
  const [breakGlassAdmins, setBreakGlassAdmins] = useState('bancha@int.ignite-idea.com, super.admin@klao.io');
  const [sessionTimeoutHours, setSessionTimeoutHours] = useState('24');

  const [savedSafeguards, setSavedSafeguards] = useState({
    breakGlassAdmins: 'bancha@int.ignite-idea.com, super.admin@klao.io',
    sessionTimeoutHours: '24'
  });

  // Check if Tab 4 is dirty
  const isSafeguardsDirty = 
    breakGlassAdmins !== savedSafeguards.breakGlassAdmins ||
    sessionTimeoutHours !== savedSafeguards.sessionTimeoutHours;

  // Helper to check if current active tab is dirty
  const isCurrentTabDirty = () => {
    if (activeTab === 'policy') return isPolicyDirty;
    if (activeTab === 'safeguards') return isSafeguardsDirty;
    return false;
  };

  // Unsaved Changes Interception Modal State
  const [pendingTabSwitch, setPendingTabSwitch] = useState<TabKey | null>(null);

  // Drawer Form State
  const [drawerForm, setDrawerForm] = useState<ProviderConfig | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [copiedCallback, setCopiedCallback] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Per-Tab Loading State
  const [isSavingTab, setIsSavingTab] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Tab Switch Handler with Unsaved Changes Guard
  const handleTabClick = (targetTab: TabKey) => {
    if (targetTab === activeTab) return;
    if (isCurrentTabDirty()) {
      setPendingTabSwitch(targetTab);
    } else {
      setActiveTab(targetTab);
    }
  };

  const handleDiscardAndSwitch = () => {
    // Reset dirty tab to saved baseline
    if (activeTab === 'policy') {
      setAllowPasswordLogin(savedPolicy.allowPasswordLogin);
      setSsoEnforcement(savedPolicy.ssoEnforcement);
      setJitProvisioning(savedPolicy.jitProvisioning);
      setDefaultRole(savedPolicy.defaultRole);
    } else if (activeTab === 'safeguards') {
      setBreakGlassAdmins(savedSafeguards.breakGlassAdmins);
      setSessionTimeoutHours(savedSafeguards.sessionTimeoutHours);
    }

    if (pendingTabSwitch) {
      setActiveTab(pendingTabSwitch);
      setPendingTabSwitch(null);
    }
  };

  const handleSaveAndSwitch = async () => {
    if (activeTab === 'policy') {
      savePolicySettings();
    } else if (activeTab === 'safeguards') {
      saveSafeguardsSettings();
    }

    if (pendingTabSwitch) {
      setActiveTab(pendingTabSwitch);
      setPendingTabSwitch(null);
    }
  };

  // Save Handlers Per Tab
  const savePolicySettings = () => {
    setIsSavingTab(true);
    setTimeout(() => {
      setSavedPolicy({
        allowPasswordLogin,
        ssoEnforcement,
        jitProvisioning,
        defaultRole
      });
      setIsSavingTab(false);
      triggerToast('Authentication Policy settings saved!');
    }, 500);
  };

  const saveSafeguardsSettings = () => {
    setIsSavingTab(true);
    setTimeout(() => {
      setSavedSafeguards({
        breakGlassAdmins,
        sessionTimeoutHours
      });
      setIsSavingTab(false);
      triggerToast('Emergency Safeguard settings saved!');
    }, 500);
  };

  // Provider Drawer Handlers
  const handleOpenDrawer = (providerKey: 'google' | 'entra' | 'saml') => {
    setDrawerForm({ ...providers[providerKey] });
    setShowSecret(false);
    setTestResult(null);
    setActiveDrawerProvider(providerKey);
  };

  const handleCloseDrawer = () => {
    setActiveDrawerProvider(null);
    setDrawerForm(null);
    setTestResult(null);
  };

  const handleSaveDrawerProvider = () => {
    if (!drawerForm) return;
    setProviders(prev => ({
      ...prev,
      [drawerForm.id]: { ...drawerForm }
    }));
    triggerToast(`Saved configuration for ${drawerForm.name}`);
    handleCloseDrawer();
  };

  const handleTestConnection = () => {
    if (!drawerForm) return;
    setTestingConnection(true);
    setTestResult(null);

    setTimeout(() => {
      setTestingConnection(false);
      if (drawerForm.clientId || drawerForm.metadataUrl) {
        setTestResult({
          success: true,
          message: `Connection successful! Handshake verified with ${drawerForm.name}.`
        });
      } else {
        setTestResult({
          success: false,
          message: `Connection failed: Please enter a valid Client ID or Metadata URL.`
        });
      }
    }, 1000);
  };

  const handleCopyCallback = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedCallback(true);
    setTimeout(() => setCopiedCallback(false), 2000);
  };

  const handleAddDomain = () => {
    if (!newDomainInput.trim()) return;
    const cleanDomain = newDomainInput.trim().toLowerCase();
    const newEntry: VerifiedDomain = {
      id: Date.now().toString(),
      domain: cleanDomain,
      status: 'Pending',
      txtRecord: `klao-verification=v1-${Math.floor(Math.random() * 90000000 + 10000000)}`,
      addedOn: new Date().toISOString().split('T')[0]
    };
    setDomains([...domains, newEntry]);
    setNewDomainInput('');
    triggerToast(`Domain ${cleanDomain} added.`);
  };

  const handleDeleteDomain = (id: string, domainName: string) => {
    setDomains(domains.filter(d => d.id !== id));
    triggerToast(`Removed domain ${domainName}`);
  };

  return (
    <div className="klao-sso-config">
      {/* Header (Clean title, no Save All button) */}
      <div className="klao-sso-header">
        <div>
          <h1 className="klao-sso-header__title">
            <ShieldCheck size={26} style={{ color: 'var(--klao-primary-dark)' }} />
            <span>Login & Single Sign-On (SSO)</span>
          </h1>
          <p className="klao-sso-header__subtitle">
            Configure authentication rules, connect enterprise Identity Providers (Google / Entra ID / SAML), manage verified corporate domains, and set emergency access policies.
          </p>
        </div>
      </div>

      {/* Top Tab Navigation Bar with Unsaved Dirty Indicators */}
      <div className="klao-sso-tabs">
        <button 
          className={`klao-sso-tab-btn ${activeTab === 'policy' ? 'klao-sso-tab-btn--active' : ''}`}
          onClick={() => handleTabClick('policy')}
        >
          <Lock size={18} />
          <span>General & Login Policy</span>
          {isPolicyDirty && <span className="klao-sso-dirty-dot" title="Unsaved changes" />}
        </button>

        <button 
          className={`klao-sso-tab-btn ${activeTab === 'providers' ? 'klao-sso-tab-btn--active' : ''}`}
          onClick={() => handleTabClick('providers')}
        >
          <Globe size={18} />
          <span>Identity Providers (SSO)</span>
        </button>

        <button 
          className={`klao-sso-tab-btn ${activeTab === 'domains' ? 'klao-sso-tab-btn--active' : ''}`}
          onClick={() => handleTabClick('domains')}
        >
          <Building size={18} />
          <span>Domain Discovery</span>
        </button>

        <button 
          className={`klao-sso-tab-btn ${activeTab === 'safeguards' ? 'klao-sso-tab-btn--active' : ''}`}
          onClick={() => handleTabClick('safeguards')}
        >
          <ShieldAlert size={18} />
          <span>Emergency Safeguards</span>
          {isSafeguardsDirty && <span className="klao-sso-dirty-dot" title="Unsaved changes" />}
        </button>
      </div>

      {/* TAB 1: GENERAL & LOGIN POLICY */}
      {activeTab === 'policy' && (
        <div className="klao-sso-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 className="klao-sso-section__title" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                <Lock size={20} style={{ color: 'var(--klao-primary)' }} />
                <span>Authentication Policies & Enforcement</span>
              </h2>
              <p className="klao-sso-section__subtitle" style={{ marginTop: '4px', marginBottom: 0 }}>
                Control internal password access, mandatory SSO routing, and automated user provisioning settings.
              </p>
            </div>

            {/* Per-Screen Save Button */}
            <button 
              className="klao-btn klao-btn--primary"
              onClick={savePolicySettings}
              disabled={!isPolicyDirty || isSavingTab}
              style={{ gap: '6px', padding: '8px 18px', opacity: isPolicyDirty ? 1 : 0.6 }}
            >
              {isSavingTab ? <RefreshCw size={16} className="klao-spin" /> : <Save size={16} />}
              <span>{isSavingTab ? 'Saving...' : 'Save Policy Settings'}</span>
            </button>
          </div>

          <div className="klao-sso-policy-grid" style={{ marginTop: '16px' }}>
            {/* Allow Email & Password Toggle */}
            <div className="klao-sso-setting-row">
              <div className="klao-sso-setting-info">
                <span className="klao-sso-setting-label">Allow Internal Password Login</span>
                <span className="klao-sso-setting-desc">
                  When enabled, internal team members can sign in using their email address and password.
                </span>
              </div>
              <label className="klao-sso-toggle">
                <input 
                  type="checkbox" 
                  checked={allowPasswordLogin} 
                  onChange={(e) => setAllowPasswordLogin(e.target.checked)} 
                />
                <span className="klao-sso-slider" />
              </label>
            </div>

            {/* Just-In-Time (JIT) Provisioning */}
            <div className="klao-sso-setting-row">
              <div className="klao-sso-setting-info">
                <span className="klao-sso-setting-label">Just-In-Time (JIT) Provisioning</span>
                <span className="klao-sso-setting-desc">
                  Automatically create a user account when an authorized employee logs in via SSO for the first time.
                </span>
              </div>
              <label className="klao-sso-toggle">
                <input 
                  type="checkbox" 
                  checked={jitProvisioning} 
                  onChange={(e) => setJitProvisioning(e.target.checked)} 
                />
                <span className="klao-sso-slider" />
              </label>
            </div>
          </div>

          {/* SSO Enforcement Options */}
          <div style={{ marginTop: '10px' }}>
            <label className="klao-form-label" style={{ marginBottom: '10px' }}>
              SSO Enforcement Strategy
            </label>
            <div className="klao-sso-radio-group">
              <div 
                className={`klao-sso-radio-card ${ssoEnforcement === 'optional' ? 'klao-sso-radio-card--selected' : ''}`}
                onClick={() => setSsoEnforcement('optional')}
              >
                <input 
                  type="radio" 
                  name="enforcement" 
                  className="klao-sso-radio-input"
                  checked={ssoEnforcement === 'optional'}
                  onChange={() => setSsoEnforcement('optional')}
                />
                <div>
                  <strong style={{ color: 'var(--klao-text-main)', fontSize: '0.92rem' }}>Optional SSO (Flexible Login)</strong>
                  <p style={{ fontSize: '0.82rem', color: 'var(--klao-text-muted)', margin: '2px 0 0 0' }}>
                    Users can freely choose to log in via either standard password or any enabled Identity Provider.
                  </p>
                </div>
              </div>

              <div 
                className={`klao-sso-radio-card ${ssoEnforcement === 'mandatory' ? 'klao-sso-radio-card--selected' : ''}`}
                onClick={() => setSsoEnforcement('mandatory')}
              >
                <input 
                  type="radio" 
                  name="enforcement" 
                  className="klao-sso-radio-input"
                  checked={ssoEnforcement === 'mandatory'}
                  onChange={() => setSsoEnforcement('mandatory')}
                />
                <div>
                  <strong style={{ color: 'var(--klao-text-main)', fontSize: '0.92rem' }}>Mandatory SSO (Strict Domain Enforcement)</strong>
                  <p style={{ fontSize: '0.82rem', color: 'var(--klao-text-muted)', margin: '2px 0 0 0' }}>
                    Password login is disabled for users with corporate email domains matching verified SSO domains.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Default Role Selection */}
          <div style={{ marginTop: '10px', maxWidth: '400px' }}>
            <div className="klao-form-group">
              <label className="klao-form-label">
                <span>Default JIT Provisioning Role</span>
                <span className="klao-form-help">Assigned on first login</span>
              </label>
              <CustomSelect
                value={defaultRole}
                options={JIT_ROLE_OPTIONS}
                onChange={(val) => setDefaultRole(String(val))}
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: IDENTITY PROVIDERS (SSO CONNECTORS) */}
      {activeTab === 'providers' && (
        <div className="klao-sso-section">
          <h2 className="klao-sso-section__title">
            <Globe size={20} style={{ color: 'var(--klao-primary)' }} />
            <span>Configured Identity Providers</span>
          </h2>
          <p className="klao-sso-section__subtitle">
            Configure OAuth2 / OIDC credentials and SAML metadata for your corporate Identity Providers.
          </p>

          <div className="klao-idp-grid">
            {/* 1. Google Workspace */}
            <div className="klao-idp-card">
              <div>
                <div className="klao-idp-card__top">
                  <div className="klao-idp-card__identity">
                    <div className={`klao-idp-card__icon ${providers.google.iconClass}`}>G</div>
                    <div>
                      <div className="klao-idp-card__name">{providers.google.name}</div>
                      <div className="klao-idp-card__type">{providers.google.type}</div>
                    </div>
                  </div>
                  <span className={`klao-idp-card__badge ${providers.google.enabled ? 'klao-idp-card__badge--enabled' : 'klao-idp-card__badge--disabled'}`}>
                    {providers.google.enabled ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                    <span>{providers.google.enabled ? 'Enabled' : 'Disabled'}</span>
                  </span>
                </div>

                <p className="klao-idp-card__desc" style={{ marginTop: '14px' }}>
                  Allow internal employees to sign in seamlessly using their Google Workspace or G Suite accounts.
                </p>
              </div>

              <div className="klao-idp-card__details">
                <div className="klao-idp-card__detail-item">
                  <span>Client ID:</span>
                  <span className="klao-idp-card__detail-value">{providers.google.clientId || 'Not configured'}</span>
                </div>
                <div className="klao-idp-card__detail-item">
                  <span>Allowed Domains:</span>
                  <span className="klao-idp-card__detail-value">{providers.google.allowedDomains || 'All'}</span>
                </div>
              </div>

              <button 
                className="klao-btn klao-btn--ghost" 
                onClick={() => handleOpenDrawer('google')}
                style={{ width: '100%', justifyContent: 'center', gap: '8px' }}
              >
                <Settings size={16} />
                <span>Configure Google SSO</span>
              </button>
            </div>

            {/* 2. Microsoft Entra ID */}
            <div className="klao-idp-card">
              <div>
                <div className="klao-idp-card__top">
                  <div className="klao-idp-card__identity">
                    <div className={`klao-idp-card__icon ${providers.entra.iconClass}`}>M</div>
                    <div>
                      <div className="klao-idp-card__name">{providers.entra.name}</div>
                      <div className="klao-idp-card__type">{providers.entra.type}</div>
                    </div>
                  </div>
                  <span className={`klao-idp-card__badge ${providers.entra.enabled ? 'klao-idp-card__badge--enabled' : 'klao-idp-card__badge--disabled'}`}>
                    {providers.entra.enabled ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                    <span>{providers.entra.enabled ? 'Enabled' : 'Disabled'}</span>
                  </span>
                </div>

                <p className="klao-idp-card__desc" style={{ marginTop: '14px' }}>
                  Authenticate staff via Microsoft 365, Azure Active Directory, or corporate Entra ID app registrations.
                </p>
              </div>

              <div className="klao-idp-card__details">
                <div className="klao-idp-card__detail-item">
                  <span>Tenant ID:</span>
                  <span className="klao-idp-card__detail-value">{providers.entra.tenantId || 'Not configured'}</span>
                </div>
                <div className="klao-idp-card__detail-item">
                  <span>App Client ID:</span>
                  <span className="klao-idp-card__detail-value">{providers.entra.clientId || 'Not configured'}</span>
                </div>
              </div>

              <button 
                className="klao-btn klao-btn--ghost" 
                onClick={() => handleOpenDrawer('entra')}
                style={{ width: '100%', justifyContent: 'center', gap: '8px' }}
              >
                <Settings size={16} />
                <span>Configure Entra ID SSO</span>
              </button>
            </div>

            {/* 3. Custom SAML 2.0 / OIDC */}
            <div className="klao-idp-card">
              <div>
                <div className="klao-idp-card__top">
                  <div className="klao-idp-card__identity">
                    <div className={`klao-idp-card__icon ${providers.saml.iconClass}`}>🔒</div>
                    <div>
                      <div className="klao-idp-card__name">{providers.saml.name}</div>
                      <div className="klao-idp-card__type">{providers.saml.type}</div>
                    </div>
                  </div>
                  <span className={`klao-idp-card__badge ${providers.saml.enabled ? 'klao-idp-card__badge--enabled' : 'klao-idp-card__badge--disabled'}`}>
                    {providers.saml.enabled ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                    <span>{providers.saml.enabled ? 'Enabled' : 'Disabled'}</span>
                  </span>
                </div>

                <p className="klao-idp-card__desc" style={{ marginTop: '14px' }}>
                  Connect custom enterprise identity providers including Okta, PingIdentity, OneLogin, or custom SAML.
                </p>
              </div>

              <div className="klao-idp-card__details">
                <div className="klao-idp-card__detail-item">
                  <span>Metadata URL:</span>
                  <span className="klao-idp-card__detail-value">{providers.saml.metadataUrl || 'Not configured'}</span>
                </div>
                <div className="klao-idp-card__detail-item">
                  <span>Status:</span>
                  <span className="klao-idp-card__detail-value">{providers.saml.enabled ? 'Active' : 'Inactive'}</span>
                </div>
              </div>

              <button 
                className="klao-btn klao-btn--ghost" 
                onClick={() => handleOpenDrawer('saml')}
                style={{ width: '100%', justifyContent: 'center', gap: '8px' }}
              >
                <Settings size={16} />
                <span>Configure SAML / OIDC</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DOMAIN DISCOVERY & VERIFICATION */}
      {activeTab === 'domains' && (
        <div className="klao-sso-section">
          <h2 className="klao-sso-section__title">
            <Building size={20} style={{ color: 'var(--klao-primary)' }} />
            <span>Corporate Domain Routing & Verification</span>
          </h2>
          <p className="klao-sso-section__subtitle">
            Verified email domains automatically redirect users entering their email during login to your configured SSO provider.
          </p>

          {/* Add Domain Input Bar */}
          <div style={{ display: 'flex', gap: '12px', maxWidth: '540px' }}>
            <input 
              type="text" 
              className="klao-input-text" 
              placeholder="e.g. acme-corp.com"
              value={newDomainInput}
              onChange={(e) => setNewDomainInput(e.target.value)}
            />
            <button 
              className="klao-btn klao-btn--primary"
              onClick={handleAddDomain}
              style={{ gap: '6px', whiteSpace: 'nowrap' }}
            >
              <Plus size={16} />
              <span>Add Domain</span>
            </button>
          </div>

          {/* Verified Domains Table */}
          <div style={{ marginTop: '10px' }}>
            <table className="klao-user-manager__table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th className="klao-user-manager__th">Corporate Domain</th>
                  <th className="klao-user-manager__th">Verification Status</th>
                  <th className="klao-user-manager__th">Required DNS TXT Record</th>
                  <th className="klao-user-manager__th">Added On</th>
                  <th className="klao-user-manager__th klao-user-manager__th--actions"></th>
                </tr>
              </thead>
              <tbody>
                {domains.map((item) => (
                  <tr key={item.id} className="klao-user-manager__tr">
                    <td className="klao-user-manager__td" style={{ fontWeight: 600, color: 'var(--klao-text-main)' }}>
                      {item.domain}
                    </td>
                    <td className="klao-user-manager__td">
                      <span className={`klao-idp-card__badge ${item.status === 'Verified' ? 'klao-idp-card__badge--enabled' : 'klao-idp-card__badge--disabled'}`}>
                        {item.status === 'Verified' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                        <span>{item.status}</span>
                      </span>
                    </td>
                    <td className="klao-user-manager__td" style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--klao-text-muted)' }}>
                      {item.txtRecord}
                    </td>
                    <td className="klao-user-manager__td" style={{ fontSize: '0.85rem', color: 'var(--klao-text-muted)' }}>
                      {item.addedOn}
                    </td>
                    <td className="klao-user-manager__td klao-user-manager__td--actions">
                      <button 
                        className="klao-user-manager__action-btn"
                        onClick={() => handleDeleteDomain(item.id, item.domain)}
                        title="Remove domain"
                      >
                        <Trash2 size={16} style={{ color: 'var(--klao-danger)' }} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: EMERGENCY SAFEGUARDS */}
      {activeTab === 'safeguards' && (
        <div className="klao-sso-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 className="klao-sso-section__title" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                <ShieldAlert size={20} style={{ color: 'var(--klao-danger)' }} />
                <span>Emergency Access & Security Safeguards</span>
              </h2>
              <p className="klao-sso-section__subtitle" style={{ marginTop: '4px', marginBottom: 0 }}>
                Configure break-glass admin accounts to prevent tenant lockout if your Identity Provider suffers an outage.
              </p>
            </div>

            {/* Per-Screen Save Button */}
            <button 
              className="klao-btn klao-btn--primary"
              onClick={saveSafeguardsSettings}
              disabled={!isSafeguardsDirty || isSavingTab}
              style={{ gap: '6px', padding: '8px 18px', opacity: isSafeguardsDirty ? 1 : 0.6 }}
            >
              {isSavingTab ? <RefreshCw size={16} className="klao-spin" /> : <Save size={16} />}
              <span>{isSavingTab ? 'Saving...' : 'Save Safeguards'}</span>
            </button>
          </div>

          <div className="klao-sso-policy-grid" style={{ marginTop: '16px' }}>
            {/* Break-Glass Admins */}
            <div className="klao-form-group" style={{ gridColumn: 'span 2' }}>
              <label className="klao-form-label">
                <span>Break-Glass Emergency Super Admins</span>
                <span className="klao-form-help">Comma-separated emails</span>
              </label>
              <input 
                type="text" 
                className="klao-input-text"
                value={breakGlassAdmins}
                onChange={(e) => setBreakGlassAdmins(e.target.value)}
                placeholder="super.admin@company.com"
              />
              <p style={{ fontSize: '0.8rem', color: 'var(--klao-text-muted)', marginTop: '4px' }}>
                Designated emergency admin accounts retain password authentication access even when <strong>Mandatory SSO</strong> is enforced.
              </p>
            </div>

            {/* Session Timeout */}
            <div className="klao-form-group">
              <label className="klao-form-label">
                <span>SSO Session Duration</span>
                <span className="klao-form-help">Maximum active session time</span>
              </label>
              <CustomSelect
                value={sessionTimeoutHours}
                options={SESSION_TIMEOUT_OPTIONS}
                onChange={(val) => setSessionTimeoutHours(String(val))}
              />
            </div>
          </div>

          {/* Revoke Sessions Action */}
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--klao-border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong style={{ color: 'var(--klao-text-main)', fontSize: '0.92rem' }}>Revoke All Active SSO Sessions</strong>
              <p style={{ fontSize: '0.82rem', color: 'var(--klao-text-muted)', margin: '2px 0 0 0' }}>
                Immediately terminate all active SSO user sessions across the entire platform. Users will be prompted to re-authenticate.
              </p>
            </div>
            <button 
              className="klao-btn" 
              onClick={() => triggerToast('All active SSO sessions have been revoked.')}
              style={{ background: 'var(--klao-danger-light)', color: 'var(--klao-danger)', border: '1px solid rgba(253, 97, 97, 0.3)', gap: '6px' }}
            >
              <ShieldAlert size={16} />
              <span>Revoke Sessions</span>
            </button>
          </div>
        </div>
      )}

      {/* Unsaved Changes Confirmation Modal (Portaled) */}
      {pendingTabSwitch && createPortal(
        <div className="klao-modal-overlay">
          <div className="klao-confirm-modal">
            <div className="klao-confirm-modal__header">
              <AlertCircle size={22} style={{ color: 'var(--klao-warning)' }} />
              <span>Unsaved Changes</span>
            </div>
            <div className="klao-confirm-modal__body">
              You have unsaved changes in this tab. If you switch tabs without saving, your modifications will be discarded.
            </div>
            <div className="klao-confirm-modal__footer">
              <button 
                type="button" 
                className="klao-btn klao-btn--ghost"
                onClick={() => setPendingTabSwitch(null)}
              >
                Stay on Tab
              </button>
              <button 
                type="button" 
                className="klao-btn"
                onClick={handleDiscardAndSwitch}
                style={{ background: 'var(--klao-danger-light)', color: 'var(--klao-danger)', border: '1px solid rgba(253, 97, 97, 0.3)' }}
              >
                Discard Changes
              </button>
              <button 
                type="button" 
                className="klao-btn klao-btn--primary"
                onClick={handleSaveAndSwitch}
              >
                Save & Switch
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Portaled Slide-Over Drawer for Provider Settings */}
      {activeDrawerProvider && drawerForm && createPortal(
        <div className="klao-sso-drawer-overlay" onClick={handleCloseDrawer}>
          <div className="klao-sso-drawer" onClick={(e) => e.stopPropagation()}>
            {/* Drawer Header */}
            <div className="klao-sso-drawer__header">
              <div className="klao-sso-drawer__title">
                <Settings size={20} style={{ color: 'var(--klao-primary-dark)' }} />
                <span>Configure {drawerForm.name}</span>
              </div>
              <button className="klao-sso-drawer__close" onClick={handleCloseDrawer}>
                <X size={20} />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="klao-sso-drawer__body">
              {/* Enable Switch */}
              <div className="klao-sso-setting-row" style={{ background: 'rgba(157, 206, 224, 0.08)', borderColor: 'rgba(157, 206, 224, 0.4)' }}>
                <div className="klao-sso-setting-info">
                  <span className="klao-sso-setting-label">Enable {drawerForm.name} Authentication</span>
                  <span className="klao-sso-setting-desc">Activate or suspend SSO logins for this provider</span>
                </div>
                <label className="klao-sso-toggle">
                  <input 
                    type="checkbox" 
                    checked={drawerForm.enabled}
                    onChange={(e) => setDrawerForm({ ...drawerForm, enabled: e.target.checked })}
                  />
                  <span className="klao-sso-slider" />
                </label>
              </div>

              {/* Redirect / Callback URI Helper */}
              <div className="klao-form-group">
                <label className="klao-form-label">
                  <span>Redirect / Callback URI (Read-only)</span>
                  <span className="klao-form-help">Copy to your IdP portal</span>
                </label>
                <div className="klao-input-copy-wrapper">
                  <input 
                    type="text" 
                    readOnly 
                    className="klao-input-text" 
                    value={drawerForm.callbackUrl}
                    style={{ background: 'rgba(0,0,0,0.03)', color: 'var(--klao-text-muted)', fontFamily: 'monospace', fontSize: '0.82rem', paddingRight: '90px' }}
                  />
                  <button 
                    className="klao-input-copy-btn"
                    onClick={() => handleCopyCallback(drawerForm.callbackUrl)}
                  >
                    {copiedCallback ? <Check size={14} style={{ color: 'var(--klao-success)' }} /> : <Copy size={14} />}
                    <span>{copiedCallback ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Provider Specific Inputs */}
              {drawerForm.id === 'entra' && (
                <div className="klao-form-group">
                  <label className="klao-form-label">
                    <span>Directory (Tenant) ID</span>
                    <span className="klao-form-help">Azure AD Directory ID</span>
                  </label>
                  <input 
                    type="text" 
                    className="klao-input-text"
                    value={drawerForm.tenantId || ''}
                    onChange={(e) => setDrawerForm({ ...drawerForm, tenantId: e.target.value })}
                    placeholder="e.g. 3f2b1098-7654-3210-fedc-ba9876543210"
                  />
                </div>
              )}

              {drawerForm.id !== 'saml' ? (
                <>
                  <div className="klao-form-group">
                    <label className="klao-form-label">
                      <span>Application (Client) ID</span>
                    </label>
                    <input 
                      type="text" 
                      className="klao-input-text"
                      value={drawerForm.clientId}
                      onChange={(e) => setDrawerForm({ ...drawerForm, clientId: e.target.value })}
                      placeholder="Enter Client ID from Identity Provider"
                    />
                  </div>

                  <div className="klao-form-group">
                    <label className="klao-form-label">
                      <span>Client Secret</span>
                    </label>
                    <div className="klao-input-password-wrapper">
                      <input 
                        type={showSecret ? 'text' : 'password'} 
                        className="klao-input-text"
                        value={drawerForm.clientSecret}
                        onChange={(e) => setDrawerForm({ ...drawerForm, clientSecret: e.target.value })}
                        placeholder="Enter Client Secret"
                        style={{ paddingRight: '40px' }}
                      />
                      <button 
                        type="button"
                        className="klao-input-password-toggle"
                        onClick={() => setShowSecret(!showSecret)}
                      >
                        {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="klao-form-group">
                  <label className="klao-form-label">
                    <span>SAML Metadata URL or Endpoint</span>
                  </label>
                  <input 
                    type="text" 
                    className="klao-input-text"
                    value={drawerForm.metadataUrl || ''}
                    onChange={(e) => setDrawerForm({ ...drawerForm, metadataUrl: e.target.value })}
                    placeholder="https://idp.example.com/app/sso/saml/metadata"
                  />
                </div>
              )}

              <div className="klao-form-group">
                <label className="klao-form-label">
                  <span>Allowed Hosted Domains</span>
                  <span className="klao-form-help">Comma-separated</span>
                </label>
                <input 
                  type="text" 
                  className="klao-input-text"
                  value={drawerForm.allowedDomains}
                  onChange={(e) => setDrawerForm({ ...drawerForm, allowedDomains: e.target.value })}
                  placeholder="e.g. ignite-idea.com, klao.io"
                />
              </div>

              {/* Test Handshake Result */}
              {testResult && (
                <div 
                  style={{
                    padding: '12px 16px',
                    borderRadius: 'var(--klao-radius-md)',
                    background: testResult.success ? 'var(--klao-success-light)' : 'var(--klao-danger-light)',
                    border: `1px solid ${testResult.success ? 'rgba(78, 197, 173, 0.4)' : 'rgba(253, 97, 97, 0.4)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '0.85rem',
                    color: testResult.success ? '#2b957e' : '#c0392b'
                  }}
                >
                  {testResult.success ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                  <span>{testResult.message}</span>
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="klao-sso-drawer__footer">
              <button 
                type="button"
                className="klao-btn klao-btn--ghost" 
                onClick={handleTestConnection}
                disabled={testingConnection}
                style={{ gap: '6px' }}
              >
                {testingConnection ? <RefreshCw size={16} className="klao-spin" /> : <Sparkles size={16} />}
                <span>{testingConnection ? 'Testing...' : 'Test Connection'}</span>
              </button>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  type="button"
                  className="klao-btn klao-btn--ghost" 
                  onClick={handleCloseDrawer}
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  className="klao-btn klao-btn--primary" 
                  onClick={handleSaveDrawerProvider}
                  style={{ gap: '6px' }}
                >
                  <Save size={16} />
                  <span>Save Provider</span>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Floating Toast Feedback */}
      {toastMessage && (
        <div className="klao-sso-toast">
          <CheckCircle2 size={18} style={{ color: 'var(--klao-primary)' }} />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

export default AdminSSOConfig;
