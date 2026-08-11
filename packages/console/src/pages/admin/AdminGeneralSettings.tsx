import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { HexColorPicker } from 'react-colorful';
import { hexToHSL, hslToHex, computeBackgroundTint, computeMatchingPalette, ColorMatchingTechnique } from '../../utils/colorUtils';
import { 
  Settings, 
  Palette, 
  Globe2, 
  ShieldAlert, 
  AlertTriangle, 
  Save, 
  CheckCircle2, 
  Image as ImageIcon,
  Clock,
  DollarSign,
  Lock,
  Megaphone,
  Upload,
  Building2,
  Layers,
  ShieldCheck
} from 'lucide-react';
import { CustomSelect } from '../../components/common/CustomSelect';
import { ALL_TIMEZONE_OPTIONS } from '../../utils/timezoneHelper';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import './AdminGeneralSettings.css';

export interface GeneralSettingsData {
  logoLightUrl: string;
  logoDarkUrl: string;
  primaryAccentColor: string;
  loginTagline: string;

  baseCurrency: string;
  fiscalYearStartMonth: string;
  timezone: string;
  dateFormat: string;
  timeFormat: string;

  allowSelfRegistration: boolean;
  allowedEmailDomains: string;
  defaultUserRole: string;
  defaultLandingPage: string;
  inactivityTimeoutMinutes: string;
  maxFileUploadMb: string;

  maintenanceMode: boolean;
  announcementBannerText: string;
  announcementType: 'info' | 'warning' | 'critical';
}

const DEFAULT_SETTINGS_DATA: GeneralSettingsData = {
  logoLightUrl: '/assets/logo-standard.jpg',
  logoDarkUrl: '/assets/logo-standard.jpg',
  primaryAccentColor: '#a855f7',
  loginTagline: 'Enterprise Operations & Dynamic Platform Console',

  baseCurrency: 'THB',
  fiscalYearStartMonth: 'January',
  timezone: 'Asia/Bangkok',
  dateFormat: 'YYYY-MM-DD',
  timeFormat: '24h',

  allowSelfRegistration: false,
  allowedEmailDomains: 'sails.io, partner.com',
  defaultUserRole: 'MEMBER',
  defaultLandingPage: '/console/dashboard',
  inactivityTimeoutMinutes: '30',
  maxFileUploadMb: '25',

  maintenanceMode: false,
  announcementBannerText: 'System maintenance scheduled for Sunday at 02:00 AM UTC.',
  announcementType: 'info'
};

const ACCENT_PRESETS = [
  { name: 'Purple', color: '#a855f7' },
  { name: 'Cyan', color: '#06b6d4' },
  { name: 'Emerald', color: '#10b981' },
  { name: 'Blue', color: '#3b82f6' },
  { name: 'Rose', color: '#f43f5e' }
];

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD ($) — US Dollar' },
  { value: 'EUR', label: 'EUR (€) — Euro' },
  { value: 'CNY', label: 'CNY (¥) — Chinese Yuan' },
  { value: 'JPY', label: 'JPY (¥) — Japanese Yen' },
  { value: 'GBP', label: 'GBP (£) — British Pound' },
  { value: 'HKD', label: 'HKD (HK$) — Hong Kong Dollar' },
  { value: 'AUD', label: 'AUD (A$) — Australian Dollar' },
  { value: 'CAD', label: 'CAD (C$) — Canadian Dollar' },
  { value: 'CHF', label: 'CHF (CHF) — Swiss Franc' },
  { value: 'INR', label: 'INR (₹) — Indian Rupee' },
  { value: 'THB', label: 'THB (฿) — Thai Baht' },
  { value: 'SGD', label: 'SGD (S$) — Singapore Dollar' },
  { value: 'MYR', label: 'MYR (RM) — Malaysian Ringgit' },
  { value: 'IDR', label: 'IDR (Rp) — Indonesian Rupiah' },
  { value: 'VND', label: 'VND (₫) — Vietnamese Dong' },
  { value: 'PHP', label: 'PHP (₱) — Philippine Peso' },
  { value: 'MMK', label: 'MMK (K) — Myanmar Kyat' },
  { value: 'KHR', label: 'KHR (៛) — Cambodian Riel' },
  { value: 'LAK', label: 'LAK (₭) — Lao Kip' },
  { value: 'BND', label: 'BND (B$) — Brunei Dollar' }
];

const MONTH_OPTIONS = [
  { value: 'January', label: 'January' },
  { value: 'February', label: 'February' },
  { value: 'March', label: 'March' },
  { value: 'April', label: 'April' },
  { value: 'May', label: 'May' },
  { value: 'June', label: 'June' },
  { value: 'July', label: 'July' },
  { value: 'August', label: 'August' },
  { value: 'September', label: 'September' },
  { value: 'October', label: 'October' },
  { value: 'November', label: 'November' },
  { value: 'December', label: 'December' }
];

const TIMEZONE_OPTIONS = [
  { value: 'Asia/Bangkok', label: 'Asia/Bangkok (UTC+07:00)' },
  { value: 'UTC', label: 'UTC — Coordinated Universal Time' },
  { value: 'America/New_York', label: 'America/New_York (UTC-05:00)' },
  { value: 'Europe/London', label: 'Europe/London (UTC+00:00)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (UTC+08:00)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (UTC+09:00)' }
];

const DATE_FORMAT_OPTIONS = [
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (ISO 8601)' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (European/Asian)' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (US Format)' }
];

const TIME_FORMAT_OPTIONS = [
  { value: '24h', label: '24-hour (14:30)' },
  { value: '12h', label: '12-hour (02:30 PM)' }
];

const ROLE_OPTIONS = [
  { value: 'MEMBER', label: 'Member (Standard Access)' },
  { value: 'VIEWER', label: 'Viewer (Read Only)' },
  { value: 'GUEST', label: 'Guest User' }
];

const LANDING_PAGE_OPTIONS = [
  { value: '/console/dashboard', label: 'Console Overview Dashboard' },
  { value: '/console/custom/orders', label: 'Custom App: Purchase Orders' },
  { value: '/admin/users', label: 'Admin User Management' }
];

const TIMEOUT_OPTIONS = [
  { value: '15', label: '15 Minutes' },
  { value: '30', label: '30 Minutes' },
  { value: '60', label: '1 Hour' },
  { value: '0', label: 'Disabled (Never Timeout)' }
];

const FILE_SIZE_OPTIONS = [
  { value: '10', label: '10 MB Ceiling' },
  { value: '25', label: '25 MB Ceiling' },
  { value: '50', label: '50 MB Ceiling' },
  { value: '100', label: '100 MB Ceiling' }
];

const ANNOUNCEMENT_TYPE_OPTIONS = [
  { value: 'info', label: 'Informational (Blue)' },
  { value: 'warning', label: 'Warning Notice (Amber)' },
  { value: 'critical', label: 'Critical Alert (Red)' }
];

interface ColorAccentFieldProps {
  label: string;
  help: string;
  value: string;
  autoValue: string;
  onChange: (color: string) => void;
  onReset?: () => void;
  showPicker?: boolean;
  autoLabel: string;
  resetTooltip: string;
}

const ColorAccentField: React.FC<ColorAccentFieldProps> = ({
  label,
  help,
  value,
  autoValue,
  onChange,
  onReset,
  showPicker = true,
  autoLabel,
  resetTooltip,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isAuto = !value || value === autoValue;
  const displayValue = isAuto ? autoValue : value;
  const showReset = onReset && !isAuto;

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  return (
    <div className="sails-gs-group">
      <label className="sails-gs-label">{label}</label>
      <div className="sails-gs-color-picker-wrapper" ref={wrapperRef}>
        <button
          type="button"
          className="sails-gs-color-swatch-trigger"
          style={{ backgroundColor: displayValue, cursor: showPicker ? 'pointer' : 'default' }}
          onClick={() => showPicker && setIsOpen(prev => !prev)}
          aria-label={`${label} color picker`}
        />
        {showPicker && isOpen && (
          <div className="sails-gs-color-popover">
            <HexColorPicker color={displayValue} onChange={onChange} />
          </div>
        )}
        <input
          type="text"
          className="sails-input"
          style={{ fontFamily: 'monospace', fontWeight: 600, width: '100%' }}
          value={displayValue}
          onChange={e => onChange(e.target.value)}
          placeholder={autoValue}
        />
        {showReset && (
          <button
            type="button"
            className="sails-btn sails-btn--ghost"
            style={{ fontSize: '0.7rem', padding: '2px 8px', flexShrink: 0 }}
            onClick={onReset}
            title={resetTooltip}
          >
            {autoLabel}
          </button>
        )}
      </div>
      <span className="sails-gs-help">{help}</span>
    </div>
  );
};

const PALETTE_TECHNIQUE_OPTIONS = [
  { value: 'monochromatic', label: 'Monochromatic (Unified & Sleek)' },
  { value: 'complementary', label: 'Complementary (High Contrast Opposite)' },
  { value: 'analogous', label: 'Analogous (Harmonious Neighbor)' }
];

const AdminGeneralSettings: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { primaryAccentColor, setPrimaryAccentColor, secondaryAccentColor, setSecondaryAccentColor, backgroundAccentColor, setBackgroundAccentColor, fontAccentColor, setFontAccentColor, enableGradient, setEnableGradient, displayDensity, setDisplayDensity, setLogoLightUrl, setLogoDarkUrl, saveBrandingToServer, commitTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<'branding' | 'localization' | 'security' | 'maintenance' | 'tenant'>('branding');
  const [paletteTechnique, setPaletteTechnique] = useState<ColorMatchingTechnique>('monochromatic');
  const [density, setDensity] = useState<'default' | 'compact' | 'comfortable'>(displayDensity || 'default');
  const [customSecondary, setCustomSecondary] = useState<string | null>(null);
  const [customBackground, setCustomBackground] = useState<string | null>(null);
  const [customFont, setCustomFont] = useState<string | null>(null);

  const gradientOn = enableGradient !== false;

  useEffect(() => {
    setCustomSecondary(secondaryAccentColor);
    setCustomBackground(backgroundAccentColor);
    setCustomFont(fontAccentColor);
    if (displayDensity) setDensity(displayDensity);
  }, [secondaryAccentColor, backgroundAccentColor, fontAccentColor, displayDensity]);

  const [formData, setFormData] = useState<GeneralSettingsData>({
    ...DEFAULT_SETTINGS_DATA,
    primaryAccentColor,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null);

  const computedPalette = useMemo(() => {
    return computeMatchingPalette(formData.primaryAccentColor, paletteTechnique, false);
  }, [formData.primaryAccentColor, paletteTechnique]);

  const resetToAuto = (field: 'secondary' | 'background' | 'font') => {
    if (field === 'secondary') {
      setSecondaryAccentColor(null);
      setCustomSecondary(null);
    }
    if (field === 'background') {
      setBackgroundAccentColor(null);
      setCustomBackground(null);
    }
    if (field === 'font') {
      setFontAccentColor(null);
      setCustomFont(null);
    }
  };

  const handleInputChange = (field: keyof GeneralSettingsData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLogoUpload = (field: 'logoLightUrl' | 'logoDarkUrl', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      alert(t('admin_general_settings.validation.invalidImageFormat'));
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert(t('admin_general_settings.validation.fileSizeLimit'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        handleInputChange(field, event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    let cancelled = false;
    const fetchGeneralSettings = async () => {
      try {
        const res = await fetch('/api/console/company-profile');
        if (!res.ok) throw new Error('Server returned error status');
        const json = await res.json();
        if (json.success && json.data && !cancelled) {
          const profile = json.data;
          const rawConfig = profile.themeConfig || profile.branding;
          const themeConf = typeof rawConfig === 'string' ? JSON.parse(rawConfig) : (rawConfig || {});

          setFormData(prev => ({
            ...prev,
            baseCurrency: profile.baseCurrency || themeConf.baseCurrency || prev.baseCurrency || 'THB',
            fiscalYearStartMonth: profile.fiscalYearStartMonth || themeConf.fiscalYearStartMonth || prev.fiscalYearStartMonth || 'January',
            timezone: profile.timezone || themeConf.timezone || prev.timezone || 'Asia/Bangkok',
            dateFormat: profile.dateFormat || themeConf.dateFormat || prev.dateFormat || 'YYYY-MM-DD',
            timeFormat: profile.timeFormat || themeConf.timeFormat || prev.timeFormat || '24h',
            loginTagline: profile.loginTagline || themeConf.loginTagline || prev.loginTagline,
            allowSelfRegistration: typeof profile.allowSelfRegistration === 'boolean' ? profile.allowSelfRegistration : (typeof themeConf.allowSelfRegistration === 'boolean' ? themeConf.allowSelfRegistration : prev.allowSelfRegistration),
            allowedEmailDomains: profile.allowedEmailDomains || themeConf.allowedEmailDomains || prev.allowedEmailDomains,
            defaultUserRole: profile.defaultUserRole || themeConf.defaultUserRole || prev.defaultUserRole,
            defaultLandingPage: profile.defaultLandingPage || themeConf.defaultLandingPage || prev.defaultLandingPage,
            inactivityTimeoutMinutes: profile.inactivityTimeoutMinutes !== undefined && profile.inactivityTimeoutMinutes !== null ? String(profile.inactivityTimeoutMinutes) : (themeConf.inactivityTimeoutMinutes || prev.inactivityTimeoutMinutes),
            maxFileUploadMb: profile.maxFileUploadMb !== undefined && profile.maxFileUploadMb !== null ? String(profile.maxFileUploadMb) : (themeConf.maxFileUploadMb || prev.maxFileUploadMb),
            maintenanceMode: typeof profile.maintenanceMode === 'boolean' ? profile.maintenanceMode : (typeof themeConf.maintenanceMode === 'boolean' ? themeConf.maintenanceMode : prev.maintenanceMode),
            announcementBannerText: profile.announcementBannerText || themeConf.announcementBannerText || prev.announcementBannerText,
            announcementType: profile.announcementType || themeConf.announcementType || prev.announcementType,
            primaryAccentColor: themeConf.primaryAccentColor || prev.primaryAccentColor,
            logoLightUrl: themeConf.logoLightUrl || prev.logoLightUrl,
            logoDarkUrl: themeConf.logoDarkUrl || prev.logoDarkUrl,
          }));
        }
      } catch {
        const cached = localStorage.getItem('sails-general-settings');
        if (cached && !cancelled) {
          try {
            setFormData(prev => ({ ...prev, ...JSON.parse(cached) }));
          } catch {}
        }
      }
    };
    fetchGeneralSettings();
    return () => { cancelled = true; };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSavedSuccessMsg(null);

    const themeOverrides = {
      primaryAccentColor: formData.primaryAccentColor,
      secondaryAccentColor: customSecondary || computedPalette.secondary,
      backgroundAccentColor: customBackground || computedPalette.background,
      fontAccentColor: customFont || computedPalette.font,
      paletteTechnique,
      enableGradient: gradientOn,
      displayDensity: density,
      logoLightUrl: formData.logoLightUrl,
      logoDarkUrl: formData.logoDarkUrl,
    };

    setPrimaryAccentColor(formData.primaryAccentColor);
    setLogoLightUrl(formData.logoLightUrl);
    setLogoDarkUrl(formData.logoDarkUrl);
    commitTheme(themeOverrides);

    try {
      localStorage.setItem('sails-general-settings', JSON.stringify(formData));
      const res = await fetch('/api/console/company-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseCurrency: formData.baseCurrency,
          fiscalYearStartMonth: formData.fiscalYearStartMonth,
          timezone: formData.timezone,
          dateFormat: formData.dateFormat,
          timeFormat: formData.timeFormat,
          loginTagline: formData.loginTagline,
          allowSelfRegistration: formData.allowSelfRegistration,
          allowedEmailDomains: formData.allowedEmailDomains,
          defaultUserRole: formData.defaultUserRole,
          defaultLandingPage: formData.defaultLandingPage,
          inactivityTimeoutMinutes: parseInt(String(formData.inactivityTimeoutMinutes), 10) || 30,
          maxFileUploadMb: parseInt(String(formData.maxFileUploadMb), 10) || 25,
          maintenanceMode: formData.maintenanceMode,
          announcementBannerText: formData.announcementBannerText,
          announcementType: formData.announcementType,
          themeConfig: themeOverrides,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to save settings to server.');
      }

      setSavedSuccessMsg(t('admin_general_settings.footer.saveSuccess'));
    } catch (err: any) {
      console.error('Error saving General Settings:', err);
      setSavedSuccessMsg(err.message || t('admin_general_settings.footer.saveError'));
    } finally {
      setIsSaving(false);
      setTimeout(() => setSavedSuccessMsg(null), 4000);
    }
  };

  return (
    <div className="sails-general-settings sails-page-container">
      <nav className="sails-general-settings__nav">
        <button
          type="button"
          className={`sails-general-settings__tab ${activeTab === 'branding' ? 'sails-general-settings__tab--active' : ''}`}
          onClick={() => setActiveTab('branding')}
        >
          <Palette size={16} />
          <span>{t('admin_general_settings.tabs.branding')}</span>
        </button>
        <button
          type="button"
          className={`sails-general-settings__tab ${activeTab === 'localization' ? 'sails-general-settings__tab--active' : ''}`}
          onClick={() => setActiveTab('localization')}
        >
          <Globe2 size={16} />
          <span>{t('admin_general_settings.tabs.localization')}</span>
        </button>
        <button
          type="button"
          className={`sails-general-settings__tab ${activeTab === 'security' ? 'sails-general-settings__tab--active' : ''}`}
          onClick={() => setActiveTab('security')}
        >
          <Lock size={16} />
          <span>{t('admin_general_settings.tabs.security')}</span>
        </button>
        <button
          type="button"
          className={`sails-general-settings__tab ${activeTab === 'maintenance' ? 'sails-general-settings__tab--active' : ''}`}
          onClick={() => setActiveTab('maintenance')}
        >
          <AlertTriangle size={16} />
          <span>{t('admin_general_settings.tabs.maintenance')}</span>
        </button>
        <button
          type="button"
          className={`sails-general-settings__tab ${activeTab === 'tenant' ? 'sails-general-settings__tab--active' : ''}`}
          onClick={() => setActiveTab('tenant')}
        >
          <Building2 size={16} />
          <span>{t('admin_general_settings.tabs.tenant')}</span>
        </button>
      </nav>

      <form onSubmit={handleSave}>
        <div className="sails-card sails-general-settings__card">
          {activeTab === 'branding' && (
            <div>
              <div className="sails-gs-section-header">
                <div className="sails-gs-section-icon">
                  <Palette size={20} />
                </div>
                <div>
                  <h3 className="sails-gs-section-title">{t('admin_general_settings.branding.title')}</h3>
                  <p className="sails-gs-section-subtitle">
                    {t('admin_general_settings.branding.subtitle')}
                  </p>
                </div>
              </div>

              <div className="sails-gs-grid-2">
                <div className="sails-gs-group">
                  <label className="sails-gs-label">{t('admin_general_settings.branding.logoLight')}</label>
                  
                  <div className="sails-gs-logo-preview-box">
                    <img 
                      src={formData.logoLightUrl || '/assets/logo-standard.jpg'} 
                      alt="Light Mode Logo Preview" 
                      className="sails-gs-logo-img"
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                        {formData.logoLightUrl && !formData.logoLightUrl.startsWith('/assets/') ? t('admin_general_settings.branding.logoCustomUploaded') : t('admin_general_settings.branding.logoDefault')}
                      </span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <span className="sails-gs-format-badge">JPG</span>
                        <span className="sails-gs-format-badge">PNG</span>
                        <span className="sails-gs-format-badge">SVG</span>
                        <span className="sails-gs-format-badge">GIF</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <label className="sails-btn sails-btn--secondary" style={{ cursor: 'pointer', fontSize: '0.8rem', padding: '6px 12px' }}>
                        <Upload size={14} style={{ marginRight: '4px' }} />
                        <span>{formData.logoLightUrl && !formData.logoLightUrl.startsWith('/assets/') ? t('admin_general_settings.branding.change') : t('admin_general_settings.branding.uploadCustom')}</span>
                        <input
                          type="file"
                          accept=".jpg,.jpeg,.png,.svg,.gif"
                          style={{ display: 'none' }}
                          onChange={e => handleLogoUpload('logoLightUrl', e)}
                        />
                      </label>
                      {formData.logoLightUrl && !formData.logoLightUrl.startsWith('/assets/') && (
                        <button
                          type="button"
                          className="sails-btn sails-btn--ghost"
                          style={{ fontSize: '0.8rem', padding: '6px 10px', color: 'var(--sails-text-muted)' }}
                          onClick={() => handleInputChange('logoLightUrl', '/assets/logo-standard.jpg')}
                          title={t('admin_general_settings.branding.resetToDefault')}
                        >
                          {t('admin_general_settings.branding.reset')}
                        </button>
                      )}
                    </div>
                  </div>
                  <span className="sails-gs-help">
                    <Trans i18nKey="admin_general_settings.branding.recommendedDimensions" components={{ 1: <strong /> }} />
                  </span>
                </div>

                <div className="sails-gs-group">
                  <label className="sails-gs-label">{t('admin_general_settings.branding.logoDark')}</label>
                  
                  <div className="sails-gs-logo-preview-box" style={{ background: '#1e293b' }}>
                    <img 
                      src={formData.logoDarkUrl || '/assets/logo-standard.jpg'} 
                      alt="Dark Mode Logo Preview" 
                      className="sails-gs-logo-img"
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#f8fafc' }}>
                        {formData.logoDarkUrl && !formData.logoDarkUrl.startsWith('/assets/') ? t('admin_general_settings.branding.logoCustomUploaded') : t('admin_general_settings.branding.logoDefault')}
                      </span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <span className="sails-gs-format-badge">JPG</span>
                        <span className="sails-gs-format-badge">PNG</span>
                        <span className="sails-gs-format-badge">SVG</span>
                        <span className="sails-gs-format-badge">GIF</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <label className="sails-btn sails-btn--secondary" style={{ cursor: 'pointer', fontSize: '0.8rem', padding: '6px 12px' }}>
                        <Upload size={14} style={{ marginRight: '4px' }} />
                        <span>{formData.logoDarkUrl && !formData.logoDarkUrl.startsWith('/assets/') ? t('admin_general_settings.branding.change') : t('admin_general_settings.branding.uploadCustom')}</span>
                        <input
                          type="file"
                          accept=".jpg,.jpeg,.png,.svg,.gif"
                          style={{ display: 'none' }}
                          onChange={e => handleLogoUpload('logoDarkUrl', e)}
                        />
                      </label>
                      {formData.logoDarkUrl && !formData.logoDarkUrl.startsWith('/assets/') && (
                        <button
                          type="button"
                          className="sails-btn sails-btn--ghost"
                          style={{ fontSize: '0.8rem', padding: '6px 10px', color: '#94a3b8' }}
                          onClick={() => handleInputChange('logoDarkUrl', '/assets/logo-standard.jpg')}
                          title={t('admin_general_settings.branding.resetToDefault')}
                        >
                          {t('admin_general_settings.branding.reset')}
                        </button>
                      )}
                    </div>
                  </div>
                  <span className="sails-gs-help">
                    <Trans i18nKey="admin_general_settings.branding.recommendedDimensions" components={{ 1: <strong /> }} />
                  </span>
                </div>

                <div className="sails-gs-toggle-row" style={{ gridColumn: '1 / -1', marginBottom: '8px' }}>
                  <div>
                    <div className="sails-gs-toggle-title">{t('admin_general_settings.branding.enableGradientTitle')}</div>
                    <div className="sails-gs-toggle-desc">
                      {t('admin_general_settings.branding.enableGradientDesc')}
                    </div>
                  </div>
                  <label className="sails-gs-switch">
                    <input
                      type="checkbox"
                      checked={gradientOn}
                      onChange={e => setEnableGradient(e.target.checked)}
                    />
                    <span className="sails-gs-slider" />
                  </label>
                </div>

                <div className="sails-gs-group" style={{ gridColumn: '1 / -1', marginBottom: '4px' }}>
                  <label className="sails-gs-label">{t('admin_general_settings.branding.paletteTechnique')}</label>
                  <CustomSelect
                    size="md"
                    value={paletteTechnique}
                    options={PALETTE_TECHNIQUE_OPTIONS}
                    onChange={val => setPaletteTechnique(val as ColorMatchingTechnique)}
                  />
                  <span className="sails-gs-help">
                    {t('admin_general_settings.branding.paletteTechniqueHelp')}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '20px', gridColumn: '1 / -1' }}>
                  <ColorAccentField
                    label={t('admin_general_settings.branding.primaryAccent')}
                    help={t('admin_general_settings.branding.primaryAccentHelp')}
                    value={formData.primaryAccentColor}
                    autoValue={computedPalette.secondary}
                    onChange={color => handleInputChange('primaryAccentColor', color)}
                    autoLabel={t('admin_general_settings.branding.auto')}
                    resetTooltip={t('admin_general_settings.branding.resetToAuto')}
                  />
                  <ColorAccentField
                    label={t('admin_general_settings.branding.secondaryAccent')}
                    help={t('admin_general_settings.branding.secondaryAccentHelp', { technique: paletteTechnique.charAt(0).toUpperCase() + paletteTechnique.slice(1) })}
                    value={customSecondary || ''}
                    autoValue={computedPalette.secondary}
                    onChange={val => {
                      setCustomSecondary(val);
                      setSecondaryAccentColor(val);
                    }}
                    onReset={() => resetToAuto('secondary')}
                    showPicker={true}
                    autoLabel={t('admin_general_settings.branding.auto')}
                    resetTooltip={t('admin_general_settings.branding.resetToAuto')}
                  />
                  <ColorAccentField
                    label={t('admin_general_settings.branding.backgroundAccent')}
                    help={t('admin_general_settings.branding.backgroundAccentHelp')}
                    value={customBackground || ''}
                    autoValue={computedPalette.background}
                    onChange={val => {
                      setCustomBackground(val);
                      setBackgroundAccentColor(val);
                    }}
                    onReset={() => resetToAuto('background')}
                    showPicker={true}
                    autoLabel={t('admin_general_settings.branding.auto')}
                    resetTooltip={t('admin_general_settings.branding.resetToAuto')}
                  />
                  <ColorAccentField
                    label={t('admin_general_settings.branding.fontAccent')}
                    help={t('admin_general_settings.branding.fontAccentHelp')}
                    value={customFont || ''}
                    autoValue={computedPalette.font}
                    onChange={val => {
                      setCustomFont(val);
                      setFontAccentColor(val);
                    }}
                    onReset={() => resetToAuto('font')}
                    showPicker={true}
                    autoLabel={t('admin_general_settings.branding.auto')}
                    resetTooltip={t('admin_general_settings.branding.resetToAuto')}
                  />
                </div>

                <div className="sails-gs-group" style={{ gridColumn: 'span 2' }}>
                  <label className="sails-gs-label">{t('admin_general_settings.branding.loginTagline')}</label>
                  <input
                    type="text"
                    className="sails-input"
                    value={formData.loginTagline}
                    onChange={e => handleInputChange('loginTagline', e.target.value)}
                    placeholder={t('admin_general_settings.branding.loginTaglinePlaceholder')}
                  />
                </div>

                <div className="sails-gs-group" style={{ gridColumn: 'span 2' }}>
                  <label className="sails-gs-label">{t('admin_general_settings.branding.displayDensity')}</label>
                  <div style={{ display: 'flex', gap: '16px', paddingTop: '4px' }}>
                    {([
                      { value: 'comfortable' as const, label: t('admin_general_settings.branding.displayDensityOptions.comfortable') },
                      { value: 'default' as const, label: t('admin_general_settings.branding.displayDensityOptions.default') },
                      { value: 'compact' as const, label: t('admin_general_settings.branding.displayDensityOptions.compact') },
                    ]).map(({ value, label }) => (
                      <label key={value} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--sails-text-main)' }}>
                        <input
                          type="radio"
                          name="displayDensity"
                          value={value}
                          checked={density === value}
                          onChange={() => setDensity(value)}
                          style={{ accentColor: 'var(--sails-primary)' }}
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'localization' && (
            <div>
              <div className="sails-gs-section-header">
                <div className="sails-gs-section-icon">
                  <Globe2 size={20} />
                </div>
                <div>
                  <h3 className="sails-gs-section-title">{t('admin_general_settings.localization.title')}</h3>
                  <p className="sails-gs-section-subtitle">
                    {t('admin_general_settings.localization.subtitle')}
                  </p>
                </div>
              </div>

              <div className="sails-gs-grid-2">
                <div className="sails-gs-group">
                  <label className="sails-gs-label">{t('admin_general_settings.localization.baseCurrency')}</label>
                  <CustomSelect
                    size="md"
                    value={formData.baseCurrency}
                    options={CURRENCY_OPTIONS}
                    searchable={true}
                    onChange={val => handleInputChange('baseCurrency', val)}
                  />
                  <span className="sails-gs-help">{t('admin_general_settings.localization.baseCurrencyHelp')}</span>
                </div>

                <div className="sails-gs-group">
                  <label className="sails-gs-label">{t('admin_general_settings.localization.fiscalYearStart')}</label>
                  <CustomSelect
                    size="md"
                    value={formData.fiscalYearStartMonth}
                    options={MONTH_OPTIONS}
                    onChange={val => handleInputChange('fiscalYearStartMonth', val)}
                  />
                  <span className="sails-gs-help">{t('admin_general_settings.localization.fiscalYearStartHelp')}</span>
                </div>

                <div className="sails-gs-group" style={{ gridColumn: 'span 2' }}>
                  <label className="sails-gs-label">{t('admin_general_settings.localization.timezone')}</label>
                  <CustomSelect
                    size="md"
                    value={formData.timezone}
                    options={ALL_TIMEZONE_OPTIONS}
                    searchable={true}
                    onChange={val => handleInputChange('timezone', val)}
                  />
                  <span className="sails-gs-help">{t('admin_general_settings.localization.timezoneHelp')}</span>
                </div>

                <div className="sails-gs-group">
                  <label className="sails-gs-label">{t('admin_general_settings.localization.dateFormat')}</label>
                  <CustomSelect
                    size="md"
                    value={formData.dateFormat}
                    options={DATE_FORMAT_OPTIONS}
                    onChange={val => handleInputChange('dateFormat', val)}
                  />
                </div>

                <div className="sails-gs-group">
                  <label className="sails-gs-label">{t('admin_general_settings.localization.timeFormat')}</label>
                  <CustomSelect
                    size="md"
                    value={formData.timeFormat}
                    options={TIME_FORMAT_OPTIONS}
                    onChange={val => handleInputChange('timeFormat', val)}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div>
              <div className="sails-gs-section-header">
                <div className="sails-gs-section-icon">
                  <Lock size={20} />
                </div>
                <div>
                  <h3 className="sails-gs-section-title">{t('admin_general_settings.security.title')}</h3>
                  <p className="sails-gs-section-subtitle">
                    {t('admin_general_settings.security.subtitle')}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="sails-gs-toggle-row">
                  <div>
                    <div className="sails-gs-toggle-title">{t('admin_general_settings.security.allowSelfRegistration')}</div>
                    <div className="sails-gs-toggle-desc">{t('admin_general_settings.security.allowSelfRegistrationDesc')}</div>
                  </div>
                  <label className="sails-gs-switch">
                    <input
                      type="checkbox"
                      checked={formData.allowSelfRegistration}
                      onChange={e => handleInputChange('allowSelfRegistration', e.target.checked)}
                    />
                    <span className="sails-gs-slider" />
                  </label>
                </div>

                <div className="sails-gs-grid-2">
                  <div className="sails-gs-group">
                    <label className="sails-gs-label">{t('admin_general_settings.security.allowedDomains')}</label>
                    <input
                      type="text"
                      className="sails-input"
                      value={formData.allowedEmailDomains}
                      onChange={e => handleInputChange('allowedEmailDomains', e.target.value)}
                      placeholder={t('admin_general_settings.security.allowedDomainsPlaceholder')}
                    />
                    <span className="sails-gs-help">{t('admin_general_settings.security.allowedDomainsHelp')}</span>
                  </div>

                  <div className="sails-gs-group">
                    <label className="sails-gs-label">{t('admin_general_settings.security.defaultRole')}</label>
                    <CustomSelect
                      size="md"
                      value={formData.defaultUserRole}
                      options={ROLE_OPTIONS}
                      onChange={val => handleInputChange('defaultUserRole', val)}
                    />
                  </div>

                  <div className="sails-gs-group">
                    <label className="sails-gs-label">{t('admin_general_settings.security.defaultLandingPage')}</label>
                    <CustomSelect
                      size="md"
                      value={formData.defaultLandingPage}
                      options={LANDING_PAGE_OPTIONS}
                      onChange={val => handleInputChange('defaultLandingPage', val)}
                    />
                  </div>

                  <div className="sails-gs-group">
                    <label className="sails-gs-label">{t('admin_general_settings.security.inactivityTimeout')}</label>
                    <CustomSelect
                      size="md"
                      value={formData.inactivityTimeoutMinutes}
                      options={TIMEOUT_OPTIONS}
                      onChange={val => handleInputChange('inactivityTimeoutMinutes', val)}
                    />
                  </div>

                  <div className="sails-gs-group">
                    <label className="sails-gs-label">{t('admin_general_settings.security.maxFileUpload')}</label>
                    <CustomSelect
                      size="md"
                      value={formData.maxFileUploadMb}
                      options={FILE_SIZE_OPTIONS}
                      onChange={val => handleInputChange('maxFileUploadMb', val)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'maintenance' && (
            <div>
              <div className="sails-gs-section-header">
                <div className="sails-gs-section-icon">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="sails-gs-section-title">{t('admin_general_settings.maintenance.title')}</h3>
                  <p className="sails-gs-section-subtitle">
                    {t('admin_general_settings.maintenance.subtitle')}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div className="sails-gs-toggle-row" style={{ borderColor: formData.maintenanceMode ? 'rgba(239, 68, 68, 0.4)' : undefined, background: formData.maintenanceMode ? 'rgba(239, 68, 68, 0.08)' : undefined }}>
                  <div>
                    <div className="sails-gs-toggle-title" style={{ color: formData.maintenanceMode ? '#fca5a5' : undefined }}>
                      {formData.maintenanceMode ? `🔴 ${t('admin_general_settings.maintenance.maintenanceModeActive')}` : t('admin_general_settings.maintenance.maintenanceMode')}
                    </div>
                    <div className="sails-gs-toggle-desc">
                      {t('admin_general_settings.maintenance.maintenanceModeDesc')}
                    </div>
                  </div>
                  <label className="sails-gs-switch">
                    <input
                      type="checkbox"
                      checked={formData.maintenanceMode}
                      onChange={e => handleInputChange('maintenanceMode', e.target.checked)}
                    />
                    <span className="sails-gs-slider" style={{ backgroundColor: formData.maintenanceMode ? '#ef4444' : undefined }} />
                  </label>
                </div>

                <div className="sails-gs-grid-2">
                  <div className="sails-gs-group" style={{ gridColumn: 'span 2' }}>
                    <label className="sails-gs-label">{t('admin_general_settings.maintenance.announcementText')}</label>
                    <input
                      type="text"
                      className="sails-input"
                      value={formData.announcementBannerText}
                      onChange={e => handleInputChange('announcementBannerText', e.target.value)}
                      placeholder={t('admin_general_settings.maintenance.announcementTextPlaceholder')}
                    />
                    <span className="sails-gs-help">{t('admin_general_settings.maintenance.announcementTextHelp')}</span>
                  </div>

                  <div className="sails-gs-group">
                    <label className="sails-gs-label">{t('admin_general_settings.maintenance.announcementType')}</label>
                    <CustomSelect
                      size="md"
                      value={formData.announcementType}
                      options={ANNOUNCEMENT_TYPE_OPTIONS}
                      onChange={val => handleInputChange('announcementType', val)}
                    />
                  </div>

                  {formData.announcementBannerText && (
                    <div className="sails-gs-group" style={{ gridColumn: 'span 2' }}>
                      <label className="sails-gs-label">{t('admin_general_settings.maintenance.announcementPreview')}</label>
                      <div className={`sails-gs-banner-preview sails-gs-banner-preview--${formData.announcementType}`}>
                        <Megaphone size={18} />
                        <span>{formData.announcementBannerText}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'tenant' && (
            <div>
              <div className="sails-gs-section-header">
                <div className="sails-gs-section-icon">
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 className="sails-gs-section-title">{t('admin_general_settings.tenant.title')}</h3>
                  <p className="sails-gs-section-subtitle">
                    {t('admin_general_settings.tenant.subtitle')}
                  </p>
                </div>
              </div>

              <div className="sails-gs-grid-2">
                <div className="sails-gs-group">
                  <label className="sails-gs-label">{t('admin_general_settings.tenant.tenantId')}</label>
                  <input
                    type="text"
                    className="sails-input"
                    value={user?.tenantId || localStorage.getItem('sails-tenant-id') || 'clx_tenant_zone01_master'}
                    readOnly
                    style={{ fontFamily: 'monospace', opacity: 0.9 }}
                  />
                  <span className="sails-gs-help">{t('admin_general_settings.tenant.tenantIdHelp')}</span>
                </div>

                <div className="sails-gs-group">
                  <label className="sails-gs-label">{t('admin_general_settings.tenant.tenantName')}</label>
                  <input
                    type="text"
                    className="sails-input"
                    value="Primary Organization"
                    readOnly
                  />
                  <span className="sails-gs-help">{t('admin_general_settings.tenant.tenantNameHelp')}</span>
                </div>

                <div className="sails-gs-group">
                  <label className="sails-gs-label">{t('admin_general_settings.tenant.tenantZone')}</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'rgba(168, 85, 247, 0.1)', borderRadius: '8px', border: '1px solid rgba(168, 85, 247, 0.2)', color: '#a855f7', fontWeight: 600 }}>
                    <Layers size={16} />
                    <span>{t('admin_general_settings.tenant.tenantZoneValue')}</span>
                  </div>
                  <span className="sails-gs-help">{t('admin_general_settings.tenant.tenantZoneHelp')}</span>
                </div>

                <div className="sails-gs-group">
                  <label className="sails-gs-label">{t('admin_general_settings.tenant.isolationType')}</label>
                  <input
                    type="text"
                    className="sails-input"
                    value={t('admin_general_settings.tenant.isolationTypeValue')}
                    readOnly
                  />
                  <span className="sails-gs-help">{t('admin_general_settings.tenant.isolationTypeHelp')}</span>
                </div>

                <div className="sails-gs-group">
                  <label className="sails-gs-label">{t('admin_general_settings.tenant.environmentMode')}</label>
                  <input
                    type="text"
                    className="sails-input"
                    value={t('admin_general_settings.tenant.environmentModeValue')}
                    readOnly
                  />
                  <span className="sails-gs-help">{t('admin_general_settings.tenant.environmentModeHelp')}</span>
                </div>

                <div className="sails-gs-group">
                  <label className="sails-gs-label">{t('admin_general_settings.tenant.systemHealth')}</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)', color: '#10b981', fontWeight: 600 }}>
                    <ShieldCheck size={16} />
                    <span>{t('admin_general_settings.tenant.systemHealthValue')}</span>
                  </div>
                  <span className="sails-gs-help">{t('admin_general_settings.tenant.systemHealthHelp')}</span>
                </div>
              </div>
            </div>
          )}

          {activeTab !== 'tenant' && (
            <div className="sails-gs-footer">
              <div>
                {savedSuccessMsg && (
                  <div className="sails-gs-toast">
                    <CheckCircle2 size={16} />
                    <span>{savedSuccessMsg}</span>
                  </div>
                )}
              </div>
              <button
                type="submit"
                className="sails-btn sails-btn--primary"
                disabled={isSaving}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Save size={16} />
                <span>{isSaving ? t('admin_general_settings.footer.saving') : t('admin_general_settings.footer.saveButton')}</span>
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
};

export default AdminGeneralSettings;
