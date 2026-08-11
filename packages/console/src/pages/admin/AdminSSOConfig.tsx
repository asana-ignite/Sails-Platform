import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { UiTableCard, UiTable, UiTh } from '../../components/ui';
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

const getOrigin = () => (typeof window !== 'undefined' ? window.location.origin : 'https://app.sails.io');

const DEFAULT_PROVIDERS: Record<'google' | 'entra' | 'saml', ProviderConfig> = {
  google: {
    id: 'google',
    name: 'Google Workspace',
    type: 'OpenID Connect (OIDC)',
    iconClass: 'sails-idp-card__icon--google',
    enabled: true,
    clientId: '849201938471-ab73x.apps.googleusercontent.com',
    clientSecret: 'GOCSPX-98237492387498237',
    allowedDomains: 'ignite-idea.com, sails.io',
    callbackUrl: `${getOrigin()}/api/auth/callback/google`
  },
  entra: {
    id: 'entra',
    name: 'Microsoft Entra ID',
    type: 'Azure AD / OAuth2',
    iconClass: 'sails-idp-card__icon--entra',
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
    iconClass: 'sails-idp-card__icon--saml',
    enabled: false,
    clientId: '',
    clientSecret: '',
    metadataUrl: 'https://dev-12345.okta.com/app/exk12345/sso/saml/metadata',
    allowedDomains: '',
    callbackUrl: `${getOrigin()}/api/auth/callback/saml`
  }
};

const DEFAULT_DOMAINS: VerifiedDomain[] = [
  { id: '1', domain: 'ignite-idea.com', status: 'Verified', txtRecord: 'sails-verification=v1-98742918', addedOn: '2026-01-15' },
  { id: '2', domain: 'sails.io', status: 'Verified', txtRecord: 'sails-verification=v1-33821092', addedOn: '2026-03-10' },
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
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabKey>('policy');

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

  const isPolicyDirty = 
    allowPasswordLogin !== savedPolicy.allowPasswordLogin ||
    ssoEnforcement !== savedPolicy.ssoEnforcement ||
    jitProvisioning !== savedPolicy.jitProvisioning ||
    defaultRole !== savedPolicy.defaultRole;

  const [providers, setProviders] = useState(DEFAULT_PROVIDERS);
  const [activeDrawerProvider, setActiveDrawerProvider] = useState<'google' | 'entra' | 'saml' | null>(null);

  const [domains, setDomains] = useState<VerifiedDomain[]>(DEFAULT_DOMAINS);
  const [newDomainInput, setNewDomainInput] = useState('');

  const [breakGlassAdmins, setBreakGlassAdmins] = useState('bancha@int.ignite-idea.com, super.admin@sails.io');
  const [sessionTimeoutHours, setSessionTimeoutHours] = useState('24');

  const [savedSafeguards, setSavedSafeguards] = useState({
    breakGlassAdmins: 'bancha@int.ignite-idea.com, super.admin@sails.io',
    sessionTimeoutHours: '24'
  });

  const isSafeguardsDirty = 
    breakGlassAdmins !== savedSafeguards.breakGlassAdmins ||
    sessionTimeoutHours !== savedSafeguards.sessionTimeoutHours;

  const isCurrentTabDirty = () => {
    if (activeTab === 'policy') return isPolicyDirty;
    if (activeTab === 'safeguards') return isSafeguardsDirty;
    return false;
  };

  const [pendingTabSwitch, setPendingTabSwitch] = useState<TabKey | null>(null);

  const [drawerForm, setDrawerForm] = useState<ProviderConfig | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [copiedCallback, setCopiedCallback] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [isSavingTab, setIsSavingTab] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleTabClick = (targetTab: TabKey) => {
    if (targetTab === activeTab) return;
    if (isCurrentTabDirty()) {
      setPendingTabSwitch(targetTab);
    } else {
      setActiveTab(targetTab);
    }
  };

  const handleDiscardAndSwitch = () => {
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
      triggerToast(t('admin_sso_config.toast.policySaved'));
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
      triggerToast(t('admin_sso_config.toast.safeguardsSaved'));
    }, 500);
  };

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
    triggerToast(t('admin_sso_config.toast.providerSaved', { name: drawerForm.name }));
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
          message: t('admin_sso_config.drawer.connectSuccess', { provider: drawerForm.name }),
        });
      } else {
        setTestResult({
          success: false,
          message: t('admin_sso_config.drawer.connectFailed'),
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
      txtRecord: `sails-verification=v1-${Math.floor(Math.random() * 90000000 + 10000000)}`,
      addedOn: new Date().toISOString().split('T')[0]
    };
    setDomains([...domains, newEntry]);
    setNewDomainInput('');
    triggerToast(t('admin_sso_config.domains.domainAdded', { domain: cleanDomain }));
  };

  const handleDeleteDomain = (id: string, domainName: string) => {
    setDomains(domains.filter(d => d.id !== id));
    triggerToast(t('admin_sso_config.domains.domainRemoved', { domain: domainName }));
  };

  return (
    <div className="sails-sso-config">
      <div className="sails-sso-header">
        <div>
          <h1 className="sails-sso-header__title">
            <ShieldCheck size={26} style={{ color: 'var(--sails-primary-dark)' }} />
            <span>{t('admin_sso_config.title')}</span>
          </h1>
          <p className="sails-sso-header__subtitle">
            {t('admin_sso_config.subtitle')}
          </p>
        </div>
      </div>

      <div className="sails-sso-tabs">
        <button 
          className={`sails-sso-tab-btn ${activeTab === 'policy' ? 'sails-sso-tab-btn--active' : ''}`}
          onClick={() => handleTabClick('policy')}
        >
          <Lock size={18} />
          <span>{t('admin_sso_config.tabs.policy')}</span>
          {isPolicyDirty && <span className="sails-sso-dirty-dot" title={t('admin_sso_config.modal.unsavedDot')} />}
        </button>

        <button 
          className={`sails-sso-tab-btn ${activeTab === 'providers' ? 'sails-sso-tab-btn--active' : ''}`}
          onClick={() => handleTabClick('providers')}
        >
          <Globe size={18} />
          <span>{t('admin_sso_config.tabs.providers')}</span>
        </button>

        <button 
          className={`sails-sso-tab-btn ${activeTab === 'domains' ? 'sails-sso-tab-btn--active' : ''}`}
          onClick={() => handleTabClick('domains')}
        >
          <Building size={18} />
          <span>{t('admin_sso_config.tabs.domains')}</span>
        </button>

        <button 
          className={`sails-sso-tab-btn ${activeTab === 'safeguards' ? 'sails-sso-tab-btn--active' : ''}`}
          onClick={() => handleTabClick('safeguards')}
        >
          <ShieldAlert size={18} />
          <span>{t('admin_sso_config.tabs.safeguards')}</span>
          {isSafeguardsDirty && <span className="sails-sso-dirty-dot" title={t('admin_sso_config.modal.unsavedDot')} />}
        </button>
      </div>

      {activeTab === 'policy' && (
        <div className="sails-sso-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 className="sails-sso-section__title" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                <Lock size={20} style={{ color: 'var(--sails-primary)' }} />
                <span>{t('admin_sso_config.policy.title')}</span>
              </h2>
              <p className="sails-sso-section__subtitle" style={{ marginTop: '4px', marginBottom: 0 }}>
                {t('admin_sso_config.policy.subtitle')}
              </p>
            </div>

            <button 
              className="sails-btn sails-btn--primary"
              onClick={savePolicySettings}
              disabled={!isPolicyDirty || isSavingTab}
              style={{ gap: '6px', padding: '8px 18px', opacity: isPolicyDirty ? 1 : 0.6 }}
            >
              {isSavingTab ? <RefreshCw size={16} className="sails-spin" /> : <Save size={16} />}
              <span>{isSavingTab ? t('admin_sso_config.policy.saving') : t('admin_sso_config.policy.saveButton')}</span>
            </button>
          </div>

          <div className="sails-sso-policy-grid" style={{ marginTop: '16px' }}>
            <div className="sails-sso-setting-row">
              <div className="sails-sso-setting-info">
                <span className="sails-sso-setting-label">{t('admin_sso_config.policy.allowPasswordLogin')}</span>
                <span className="sails-sso-setting-desc">
                  {t('admin_sso_config.policy.allowPasswordLoginDesc')}
                </span>
              </div>
              <label className="sails-sso-toggle">
                <input 
                  type="checkbox" 
                  checked={allowPasswordLogin} 
                  onChange={(e) => setAllowPasswordLogin(e.target.checked)} 
                />
                <span className="sails-sso-slider" />
              </label>
            </div>

            <div className="sails-sso-setting-row">
              <div className="sails-sso-setting-info">
                <span className="sails-sso-setting-label">{t('admin_sso_config.policy.jitProvisioning')}</span>
                <span className="sails-sso-setting-desc">
                  {t('admin_sso_config.policy.jitProvisioningDesc')}
                </span>
              </div>
              <label className="sails-sso-toggle">
                <input 
                  type="checkbox" 
                  checked={jitProvisioning} 
                  onChange={(e) => setJitProvisioning(e.target.checked)} 
                />
                <span className="sails-sso-slider" />
              </label>
            </div>
          </div>

          <div style={{ marginTop: '10px' }}>
            <label className="sails-form-label" style={{ marginBottom: '10px' }}>
              {t('admin_sso_config.policy.ssoEnforcement')}
            </label>
            <div className="sails-sso-radio-group">
              <div 
                className={`sails-sso-radio-card ${ssoEnforcement === 'optional' ? 'sails-sso-radio-card--selected' : ''}`}
                onClick={() => setSsoEnforcement('optional')}
              >
                <input 
                  type="radio" 
                  name="enforcement" 
                  className="sails-sso-radio-input"
                  checked={ssoEnforcement === 'optional'}
                  onChange={() => setSsoEnforcement('optional')}
                />
                <div>
                  <strong style={{ color: 'var(--sails-text-main)', fontSize: '0.92rem' }}>{t('admin_sso_config.policy.optionalSso')}</strong>
                  <p style={{ fontSize: '0.82rem', color: 'var(--sails-text-muted)', margin: '2px 0 0 0' }}>
                    {t('admin_sso_config.policy.optionalSsoDesc')}
                  </p>
                </div>
              </div>

              <div 
                className={`sails-sso-radio-card ${ssoEnforcement === 'mandatory' ? 'sails-sso-radio-card--selected' : ''}`}
                onClick={() => setSsoEnforcement('mandatory')}
              >
                <input 
                  type="radio" 
                  name="enforcement" 
                  className="sails-sso-radio-input"
                  checked={ssoEnforcement === 'mandatory'}
                  onChange={() => setSsoEnforcement('mandatory')}
                />
                <div>
                  <strong style={{ color: 'var(--sails-text-main)', fontSize: '0.92rem' }}>{t('admin_sso_config.policy.mandatorySso')}</strong>
                  <p style={{ fontSize: '0.82rem', color: 'var(--sails-text-muted)', margin: '2px 0 0 0' }}>
                    {t('admin_sso_config.policy.mandatorySsoDesc')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '10px', maxWidth: '400px' }}>
            <div className="sails-form-group">
              <label className="sails-form-label">
                <span>{t('admin_sso_config.policy.defaultRole')}</span>
                <span className="sails-form-help">{t('admin_sso_config.policy.defaultRoleHelp')}</span>
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

      {activeTab === 'providers' && (
        <div className="sails-sso-section">
          <h2 className="sails-sso-section__title">
            <Globe size={20} style={{ color: 'var(--sails-primary)' }} />
            <span>{t('admin_sso_config.providers.title')}</span>
          </h2>
          <p className="sails-sso-section__subtitle">
            {t('admin_sso_config.providers.subtitle')}
          </p>

          <div className="sails-idp-grid">
            <div className="sails-idp-card">
              <div>
                <div className="sails-idp-card__top">
                  <div className="sails-idp-card__identity">
                    <div className={`sails-idp-card__icon ${providers.google.iconClass}`}>G</div>
                    <div>
                      <div className="sails-idp-card__name">{t('admin_sso_config.providers.google.name')}</div>
                      <div className="sails-idp-card__type">{t('admin_sso_config.providers.google.type')}</div>
                    </div>
                  </div>
                  <span className={`sails-idp-card__badge ${providers.google.enabled ? 'sails-idp-card__badge--enabled' : 'sails-idp-card__badge--disabled'}`}>
                    {providers.google.enabled ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                    <span>{providers.google.enabled ? t('admin_sso_config.providers.enabled') : t('admin_sso_config.providers.disabled')}</span>
                  </span>
                </div>

                <p className="sails-idp-card__desc" style={{ marginTop: '14px' }}>
                  {t('admin_sso_config.providers.google.desc')}
                </p>
              </div>

              <div className="sails-idp-card__details">
                <div className="sails-idp-card__detail-item">
                  <span>{t('admin_sso_config.providers.google.clientIdLabel')}</span>
                  <span className="sails-idp-card__detail-value">{providers.google.clientId || t('admin_sso_config.providers.google.notConfigured')}</span>
                </div>
                <div className="sails-idp-card__detail-item">
                  <span>{t('admin_sso_config.providers.google.allowedDomainsLabel')}</span>
                  <span className="sails-idp-card__detail-value">{providers.google.allowedDomains || t('admin_sso_config.providers.google.all')}</span>
                </div>
              </div>

              <button 
                className="sails-btn sails-btn--ghost" 
                onClick={() => handleOpenDrawer('google')}
                style={{ width: '100%', justifyContent: 'center', gap: '8px' }}
              >
                <Settings size={16} />
                <span>{t('admin_sso_config.providers.google.configureButton')}</span>
              </button>
            </div>

            <div className="sails-idp-card">
              <div>
                <div className="sails-idp-card__top">
                  <div className="sails-idp-card__identity">
                    <div className={`sails-idp-card__icon ${providers.entra.iconClass}`}>M</div>
                    <div>
                      <div className="sails-idp-card__name">{t('admin_sso_config.providers.entra.name')}</div>
                      <div className="sails-idp-card__type">{t('admin_sso_config.providers.entra.type')}</div>
                    </div>
                  </div>
                  <span className={`sails-idp-card__badge ${providers.entra.enabled ? 'sails-idp-card__badge--enabled' : 'sails-idp-card__badge--disabled'}`}>
                    {providers.entra.enabled ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                    <span>{providers.entra.enabled ? t('admin_sso_config.providers.enabled') : t('admin_sso_config.providers.disabled')}</span>
                  </span>
                </div>

                <p className="sails-idp-card__desc" style={{ marginTop: '14px' }}>
                  {t('admin_sso_config.providers.entra.desc')}
                </p>
              </div>

              <div className="sails-idp-card__details">
                <div className="sails-idp-card__detail-item">
                  <span>{t('admin_sso_config.providers.entra.tenantIdLabel')}</span>
                  <span className="sails-idp-card__detail-value">{providers.entra.tenantId || t('admin_sso_config.providers.google.notConfigured')}</span>
                </div>
                <div className="sails-idp-card__detail-item">
                  <span>{t('admin_sso_config.providers.entra.appClientIdLabel')}</span>
                  <span className="sails-idp-card__detail-value">{providers.entra.clientId || t('admin_sso_config.providers.google.notConfigured')}</span>
                </div>
              </div>

              <button 
                className="sails-btn sails-btn--ghost" 
                onClick={() => handleOpenDrawer('entra')}
                style={{ width: '100%', justifyContent: 'center', gap: '8px' }}
              >
                <Settings size={16} />
                <span>{t('admin_sso_config.providers.entra.configureButton')}</span>
              </button>
            </div>

            <div className="sails-idp-card">
              <div>
                <div className="sails-idp-card__top">
                  <div className="sails-idp-card__identity">
                    <div className={`sails-idp-card__icon ${providers.saml.iconClass}`}>&#x1F512;</div>
                    <div>
                      <div className="sails-idp-card__name">{t('admin_sso_config.providers.saml.name')}</div>
                      <div className="sails-idp-card__type">{t('admin_sso_config.providers.saml.type')}</div>
                    </div>
                  </div>
                  <span className={`sails-idp-card__badge ${providers.saml.enabled ? 'sails-idp-card__badge--enabled' : 'sails-idp-card__badge--disabled'}`}>
                    {providers.saml.enabled ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                    <span>{providers.saml.enabled ? t('admin_sso_config.providers.enabled') : t('admin_sso_config.providers.disabled')}</span>
                  </span>
                </div>

                <p className="sails-idp-card__desc" style={{ marginTop: '14px' }}>
                  {t('admin_sso_config.providers.saml.desc')}
                </p>
              </div>

              <div className="sails-idp-card__details">
                <div className="sails-idp-card__detail-item">
                  <span>{t('admin_sso_config.providers.saml.metadataUrlLabel')}</span>
                  <span className="sails-idp-card__detail-value">{providers.saml.metadataUrl || t('admin_sso_config.providers.google.notConfigured')}</span>
                </div>
                <div className="sails-idp-card__detail-item">
                  <span>{t('admin_sso_config.providers.saml.statusLabel')}</span>
                  <span className="sails-idp-card__detail-value">{providers.saml.enabled ? t('admin_sso_config.providers.saml.active') : t('admin_sso_config.providers.saml.inactive')}</span>
                </div>
              </div>

              <button 
                className="sails-btn sails-btn--ghost" 
                onClick={() => handleOpenDrawer('saml')}
                style={{ width: '100%', justifyContent: 'center', gap: '8px' }}
              >
                <Settings size={16} />
                <span>{t('admin_sso_config.providers.saml.configureButton')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'domains' && (
        <div className="sails-sso-section">
          <h2 className="sails-sso-section__title">
            <Building size={20} style={{ color: 'var(--sails-primary)' }} />
            <span>{t('admin_sso_config.domains.title')}</span>
          </h2>
          <p className="sails-sso-section__subtitle">
            {t('admin_sso_config.domains.subtitle')}
          </p>

          <div style={{ display: 'flex', gap: '12px', maxWidth: '540px' }}>
            <input 
              type="text" 
              className="sails-input-text" 
              placeholder={t('admin_sso_config.domains.addDomainPlaceholder')}
              value={newDomainInput}
              onChange={(e) => setNewDomainInput(e.target.value)}
            />
            <button 
              className="sails-btn sails-btn--primary"
              onClick={handleAddDomain}
              style={{ gap: '6px', whiteSpace: 'nowrap' }}
            >
              <Plus size={16} />
              <span>{t('admin_sso_config.domains.addButton')}</span>
            </button>
          </div>

          <div style={{ marginTop: '10px' }}>
            <UiTableCard>
            <table className="ui-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <UiTh>{t('admin_sso_config.domains.columns.domain')}</UiTh>
                  <UiTh>{t('admin_sso_config.domains.columns.status')}</UiTh>
                  <UiTh>{t('admin_sso_config.domains.columns.txtRecord')}</UiTh>
                  <UiTh>{t('admin_sso_config.domains.columns.addedOn')}</UiTh>
                  <th style={{ textAlign: 'right', width: 48 }}></th>
                </tr>
              </thead>
              <tbody>
                {domains.map((item) => (
                  <tr key={item.id} className="sails-user-manager__tr">
                    <td className="sails-user-manager__td" style={{ fontWeight: 600, color: 'var(--sails-text-main)' }}>
                      {item.domain}
                    </td>
                    <td className="sails-user-manager__td">
                      <span className={`sails-idp-card__badge ${item.status === 'Verified' ? 'sails-idp-card__badge--enabled' : 'sails-idp-card__badge--disabled'}`}>
                        {item.status === 'Verified' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                        <span>{item.status}</span>
                      </span>
                    </td>
                    <td className="sails-user-manager__td" style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--sails-text-muted)' }}>
                      {item.txtRecord}
                    </td>
                    <td className="sails-user-manager__td" style={{ fontSize: '0.85rem', color: 'var(--sails-text-muted)' }}>
                      {item.addedOn}
                    </td>
                    <td className="sails-user-manager__td sails-user-manager__td--actions">
                      <button 
                        className="sails-user-manager__action-btn"
                        onClick={() => handleDeleteDomain(item.id, item.domain)}
                        title="Remove domain"
                      >
                        <Trash2 size={16} style={{ color: 'var(--sails-danger)' }} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </UiTableCard>
          </div>
        </div>
      )}

      {activeTab === 'safeguards' && (
        <div className="sails-sso-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 className="sails-sso-section__title" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                <ShieldAlert size={20} style={{ color: 'var(--sails-danger)' }} />
                <span>{t('admin_sso_config.safeguards.title')}</span>
              </h2>
              <p className="sails-sso-section__subtitle" style={{ marginTop: '4px', marginBottom: 0 }}>
                {t('admin_sso_config.safeguards.subtitle')}
              </p>
            </div>

            <button 
              className="sails-btn sails-btn--primary"
              onClick={saveSafeguardsSettings}
              disabled={!isSafeguardsDirty || isSavingTab}
              style={{ gap: '6px', padding: '8px 18px', opacity: isSafeguardsDirty ? 1 : 0.6 }}
            >
              {isSavingTab ? <RefreshCw size={16} className="sails-spin" /> : <Save size={16} />}
              <span>{isSavingTab ? t('admin_sso_config.policy.saving') : t('admin_sso_config.safeguards.saveButton')}</span>
            </button>
          </div>

          <div className="sails-sso-policy-grid" style={{ marginTop: '16px' }}>
            <div className="sails-form-group" style={{ gridColumn: 'span 2' }}>
              <label className="sails-form-label">
                <span>{t('admin_sso_config.safeguards.breakGlassAdmins')}</span>
                <span className="sails-form-help">{t('admin_sso_config.safeguards.breakGlassHelp')}</span>
              </label>
              <input 
                type="text" 
                className="sails-input-text"
                value={breakGlassAdmins}
                onChange={(e) => setBreakGlassAdmins(e.target.value)}
                placeholder={t('admin_sso_config.safeguards.breakGlassPlaceholder')}
              />
              <p style={{ fontSize: '0.8rem', color: 'var(--sails-text-muted)', marginTop: '4px' }}>
                {t('admin_sso_config.safeguards.breakGlassDesc')}
              </p>
            </div>

            <div className="sails-form-group">
              <label className="sails-form-label">
                <span>{t('admin_sso_config.safeguards.sessionDuration')}</span>
                <span className="sails-form-help">{t('admin_sso_config.safeguards.sessionDurationHelp')}</span>
              </label>
              <CustomSelect
                value={sessionTimeoutHours}
                options={SESSION_TIMEOUT_OPTIONS}
                onChange={(val) => setSessionTimeoutHours(String(val))}
              />
            </div>
          </div>

          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--sails-border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong style={{ color: 'var(--sails-text-main)', fontSize: '0.92rem' }}>{t('admin_sso_config.safeguards.revokeSessions')}</strong>
              <p style={{ fontSize: '0.82rem', color: 'var(--sails-text-muted)', margin: '2px 0 0 0' }}>
                {t('admin_sso_config.safeguards.revokeSessionsDesc')}
              </p>
            </div>
            <button 
              className="sails-btn" 
              onClick={() => triggerToast(t('admin_sso_config.safeguards.revokeSuccess'))}
              style={{ background: 'var(--sails-danger-light)', color: 'var(--sails-danger)', border: '1px solid rgba(253, 97, 97, 0.3)', gap: '6px' }}
            >
              <ShieldAlert size={16} />
              <span>{t('admin_sso_config.safeguards.revokeButton')}</span>
            </button>
          </div>
        </div>
      )}

      {pendingTabSwitch && createPortal(
        <div className="sails-modal-overlay">
          <div className="sails-confirm-modal">
            <div className="sails-confirm-modal__header">
              <AlertCircle size={22} style={{ color: 'var(--sails-warning)' }} />
              <span>{t('admin_sso_config.modal.unsavedChanges')}</span>
            </div>
            <div className="sails-confirm-modal__body">
              {t('admin_sso_config.modal.unsavedBody')}
            </div>
            <div className="sails-confirm-modal__footer">
              <button 
                type="button" 
                className="sails-btn sails-btn--ghost"
                onClick={() => setPendingTabSwitch(null)}
              >
                {t('admin_sso_config.modal.stayOnTab')}
              </button>
              <button 
                type="button" 
                className="sails-btn"
                onClick={handleDiscardAndSwitch}
                style={{ background: 'var(--sails-danger-light)', color: 'var(--sails-danger)', border: '1px solid rgba(253, 97, 97, 0.3)' }}
              >
                {t('admin_sso_config.modal.discardChanges')}
              </button>
              <button 
                type="button" 
                className="sails-btn sails-btn--primary"
                onClick={handleSaveAndSwitch}
              >
                {t('admin_sso_config.modal.saveAndSwitch')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {activeDrawerProvider && drawerForm && createPortal(
        <div className="sails-sso-drawer-overlay" onClick={handleCloseDrawer}>
          <div className="sails-sso-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="sails-sso-drawer__header">
              <div className="sails-sso-drawer__title">
                <Settings size={20} style={{ color: 'var(--sails-primary-dark)' }} />
                <span>{t('admin_sso_config.drawer.title', { provider: drawerForm.name })}</span>
              </div>
              <button className="sails-sso-drawer__close" onClick={handleCloseDrawer}>
                <X size={20} />
              </button>
            </div>

            <div className="sails-sso-drawer__body">
              <div className="sails-sso-setting-row" style={{ background: 'rgba(157, 206, 224, 0.08)', borderColor: 'rgba(157, 206, 224, 0.4)' }}>
                <div className="sails-sso-setting-info">
                  <span className="sails-sso-setting-label">{t('admin_sso_config.drawer.enableAuth', { provider: drawerForm.name })}</span>
                  <span className="sails-sso-setting-desc">{t('admin_sso_config.drawer.enableAuthDesc')}</span>
                </div>
                <label className="sails-sso-toggle">
                  <input 
                    type="checkbox" 
                    checked={drawerForm.enabled}
                    onChange={(e) => setDrawerForm({ ...drawerForm, enabled: e.target.checked })}
                  />
                  <span className="sails-sso-slider" />
                </label>
              </div>

              <div className="sails-form-group">
                <label className="sails-form-label">
                  <span>{t('admin_sso_config.drawer.callbackUrl')}</span>
                  <span className="sails-form-help">{t('admin_sso_config.drawer.callbackUrlHelp')}</span>
                </label>
                <div className="sails-input-copy-wrapper">
                  <input 
                    type="text" 
                    readOnly 
                    className="sails-input-text" 
                    value={drawerForm.callbackUrl}
                    style={{ background: 'rgba(0,0,0,0.03)', color: 'var(--sails-text-muted)', fontFamily: 'monospace', fontSize: '0.82rem', paddingRight: '90px' }}
                  />
                  <button 
                    className="sails-input-copy-btn"
                    onClick={() => handleCopyCallback(drawerForm.callbackUrl)}
                  >
                    {copiedCallback ? <Check size={14} style={{ color: 'var(--sails-success)' }} /> : <Copy size={14} />}
                    <span>{copiedCallback ? 'Copied!' : t('common.copy')}</span>
                  </button>
                </div>
              </div>

              {drawerForm.id === 'entra' && (
                <div className="sails-form-group">
                  <label className="sails-form-label">
                    <span>{t('admin_sso_config.drawer.directoryTenantId')}</span>
                    <span className="sails-form-help">{t('admin_sso_config.drawer.directoryTenantIdHelp')}</span>
                  </label>
                  <input 
                    type="text" 
                    className="sails-input-text"
                    value={drawerForm.tenantId || ''}
                    onChange={(e) => setDrawerForm({ ...drawerForm, tenantId: e.target.value })}
                    placeholder={t('admin_sso_config.drawer.directoryTenantIdPlaceholder')}
                  />
                </div>
              )}

              {drawerForm.id !== 'saml' ? (
                <>
                  <div className="sails-form-group">
                    <label className="sails-form-label">
                      <span>{t('admin_sso_config.drawer.clientId')}</span>
                    </label>
                    <input 
                      type="text" 
                      className="sails-input-text"
                      value={drawerForm.clientId}
                      onChange={(e) => setDrawerForm({ ...drawerForm, clientId: e.target.value })}
                      placeholder={t('admin_sso_config.drawer.clientIdPlaceholder')}
                    />
                  </div>

                  <div className="sails-form-group">
                    <label className="sails-form-label">
                      <span>{t('admin_sso_config.drawer.clientSecret')}</span>
                    </label>
                    <div className="sails-input-password-wrapper">
                      <input 
                        type={showSecret ? 'text' : 'password'} 
                        className="sails-input-text"
                        value={drawerForm.clientSecret}
                        onChange={(e) => setDrawerForm({ ...drawerForm, clientSecret: e.target.value })}
                        placeholder={t('admin_sso_config.drawer.clientSecretPlaceholder')}
                        style={{ paddingRight: '40px' }}
                      />
                      <button 
                        type="button"
                        className="sails-input-password-toggle"
                        onClick={() => setShowSecret(!showSecret)}
                      >
                        {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="sails-form-group">
                  <label className="sails-form-label">
                    <span>{t('admin_sso_config.drawer.metadataUrl')}</span>
                  </label>
                  <input 
                    type="text" 
                    className="sails-input-text"
                    value={drawerForm.metadataUrl || ''}
                    onChange={(e) => setDrawerForm({ ...drawerForm, metadataUrl: e.target.value })}
                    placeholder={t('admin_sso_config.drawer.metadataUrlPlaceholder')}
                  />
                </div>
              )}

              <div className="sails-form-group">
                <label className="sails-form-label">
                  <span>{t('admin_sso_config.drawer.allowedDomains')}</span>
                  <span className="sails-form-help">{t('admin_sso_config.drawer.allowedDomainsHelp')}</span>
                </label>
                <input 
                  type="text" 
                  className="sails-input-text"
                  value={drawerForm.allowedDomains}
                  onChange={(e) => setDrawerForm({ ...drawerForm, allowedDomains: e.target.value })}
                  placeholder={t('admin_sso_config.drawer.allowedDomainsPlaceholder')}
                />
              </div>

              {testResult && (
                <div 
                  style={{
                    padding: '12px 16px',
                    borderRadius: 'var(--sails-radius-md)',
                    background: testResult.success ? 'var(--sails-success-light)' : 'var(--sails-danger-light)',
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

            <div className="sails-sso-drawer__footer">
              <button 
                type="button"
                className="sails-btn sails-btn--ghost" 
                onClick={handleTestConnection}
                disabled={testingConnection}
                style={{ gap: '6px' }}
              >
                {testingConnection ? <RefreshCw size={16} className="sails-spin" /> : <Sparkles size={16} />}
                <span>{testingConnection ? t('admin_sso_config.drawer.testing') : t('admin_sso_config.drawer.testConnection')}</span>
              </button>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  type="button"
                  className="sails-btn sails-btn--ghost" 
                  onClick={handleCloseDrawer}
                >
                  {t('common.cancel')}
                </button>
                <button 
                  type="button"
                  className="sails-btn sails-btn--primary" 
                  onClick={handleSaveDrawerProvider}
                  style={{ gap: '6px' }}
                >
                  <Save size={16} />
                  <span>{t('admin_sso_config.drawer.saveProvider')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {toastMessage && (
        <div className="sails-sso-toast">
          <CheckCircle2 size={18} style={{ color: 'var(--sails-primary)' }} />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

export default AdminSSOConfig;
