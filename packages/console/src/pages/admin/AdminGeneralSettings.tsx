import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  Upload
} from 'lucide-react';
import { CustomSelect } from '../../components/common/CustomSelect';
import { ALL_TIMEZONE_OPTIONS } from '../../utils/timezoneHelper';
import { useTheme } from '../../contexts/ThemeContext';
import './AdminGeneralSettings.css';

export interface GeneralSettingsData {
  // Section 1: Branding & Theme
  logoLightUrl: string;
  logoDarkUrl: string;
  primaryAccentColor: string;
  loginTagline: string;

  // Section 2: Localization & Financials
  baseCurrency: string;
  fiscalYearStartMonth: string;
  timezone: string;
  dateFormat: string;
  timeFormat: string;

  // Section 3: System Security & Governance
  allowSelfRegistration: boolean;
  allowedEmailDomains: string;
  defaultUserRole: string;
  defaultLandingPage: string;
  inactivityTimeoutMinutes: string;
  maxFileUploadMb: string;

  // Section 4: Maintenance & Announcement
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
  allowedEmailDomains: 'klao.io, partner.com',
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
}

const ColorAccentField: React.FC<ColorAccentFieldProps> = ({
  label,
  help,
  value,
  autoValue,
  onChange,
  onReset,
  showPicker = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isAuto = !value || value === autoValue;
  const displayValue = isAuto ? autoValue : value;
  const showReset = onReset && !isAuto;

  // Click outside closes popover
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
    <div className="klao-gs-group">
      <label className="klao-gs-label">{label}</label>
      <div className="klao-gs-color-picker-wrapper" ref={wrapperRef}>
        <button
          type="button"
          className="klao-gs-color-swatch-trigger"
          style={{ backgroundColor: displayValue, cursor: showPicker ? 'pointer' : 'default' }}
          onClick={() => showPicker && setIsOpen(prev => !prev)}
          aria-label={`${label} color picker`}
        />
        {showPicker && isOpen && (
          <div className="klao-gs-color-popover">
            <HexColorPicker color={displayValue} onChange={onChange} />
          </div>
        )}
        <input
          type="text"
          className="klao-input"
          style={{ fontFamily: 'monospace', fontWeight: 600, width: '100%' }}
          value={displayValue}
          onChange={e => onChange(e.target.value)}
          placeholder={autoValue}
        />
        {showReset && (
          <button
            type="button"
            className="klao-btn klao-btn--ghost"
            style={{ fontSize: '0.7rem', padding: '2px 8px', flexShrink: 0 }}
            onClick={onReset}
            title="Reset to auto-calculated"
          >
            Auto
          </button>
        )}
      </div>
      <span className="klao-gs-help">{help}</span>
    </div>
  );
};

const PALETTE_TECHNIQUE_OPTIONS = [
  { value: 'monochromatic', label: 'Monochromatic (Unified & Sleek)' },
  { value: 'complementary', label: 'Complementary (High Contrast Opposite)' },
  { value: 'analogous', label: 'Analogous (Harmonious Neighbor)' }
];

const AdminGeneralSettings: React.FC = () => {
  const { primaryAccentColor, setPrimaryAccentColor, secondaryAccentColor, setSecondaryAccentColor, backgroundAccentColor, setBackgroundAccentColor, fontAccentColor, setFontAccentColor, enableGradient, setLogoLightUrl, setLogoDarkUrl, saveBrandingToServer, commitTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<'branding' | 'localization' | 'security' | 'maintenance'>('branding');
  const [paletteTechnique, setPaletteTechnique] = useState<ColorMatchingTechnique>('monochromatic');
  const [enableGradientAccent, setEnableGradientAccent] = useState<boolean>(enableGradient !== false);

  // Local state for custom color overrides (null means Auto mode)
  const [customSecondary, setCustomSecondary] = useState<string | null>(secondaryAccentColor || null);
  const [customBackground, setCustomBackground] = useState<string | null>(backgroundAccentColor || null);
  const [customFont, setCustomFont] = useState<string | null>(fontAccentColor || null);

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
      alert('Invalid image format. Supported formats: JPG, PNG, SVG, GIF');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('File size exceeds 2MB limit.');
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSavedSuccessMsg(null);

    const themeOverrides = {
      primaryAccentColor: formData.primaryAccentColor,
      secondaryAccentColor: customSecondary,
      backgroundAccentColor: customBackground,
      fontAccentColor: customFont,
      paletteTechnique,
      enableGradient: enableGradientAccent,
      logoLightUrl: formData.logoLightUrl,
      logoDarkUrl: formData.logoDarkUrl,
    };

    setPrimaryAccentColor(formData.primaryAccentColor);
    setLogoLightUrl(formData.logoLightUrl);
    setLogoDarkUrl(formData.logoDarkUrl);
    commitTheme(themeOverrides);
    await saveBrandingToServer(themeOverrides);

    // Simulate API call persistence for non-branding fields
    await new Promise(resolve => setTimeout(resolve, 600));
    setIsSaving(false);
    setSavedSuccessMsg('General Settings saved successfully.');

    setTimeout(() => {
      setSavedSuccessMsg(null);
    }, 4000);
  };

  return (
    <div className="klao-general-settings klao-page-container">
      {/* Tab Navigation */}
      <nav className="klao-general-settings__nav">
        <button
          type="button"
          className={`klao-general-settings__tab ${activeTab === 'branding' ? 'klao-general-settings__tab--active' : ''}`}
          onClick={() => setActiveTab('branding')}
        >
          <Palette size={16} />
          <span>Branding & Theme</span>
        </button>
        <button
          type="button"
          className={`klao-general-settings__tab ${activeTab === 'localization' ? 'klao-general-settings__tab--active' : ''}`}
          onClick={() => setActiveTab('localization')}
        >
          <Globe2 size={16} />
          <span>Localization & Currency</span>
        </button>
        <button
          type="button"
          className={`klao-general-settings__tab ${activeTab === 'security' ? 'klao-general-settings__tab--active' : ''}`}
          onClick={() => setActiveTab('security')}
        >
          <Lock size={16} />
          <span>Security & Governance</span>
        </button>
        <button
          type="button"
          className={`klao-general-settings__tab ${activeTab === 'maintenance' ? 'klao-general-settings__tab--active' : ''}`}
          onClick={() => setActiveTab('maintenance')}
        >
          <AlertTriangle size={16} />
          <span>Maintenance & Alerts</span>
        </button>
      </nav>

      {/* Form Container */}
      <form onSubmit={handleSave}>
        <div className="klao-card klao-general-settings__card">
          {/* TAB 1: Branding & Theme */}
          {activeTab === 'branding' && (
            <div>
              <div className="klao-gs-section-header">
                <div className="klao-gs-section-icon">
                  <Palette size={20} />
                </div>
                <div>
                  <h3 className="klao-gs-section-title">Branding & Theme Customization</h3>
                  <p className="klao-gs-section-subtitle">
                    Upload organization logos and configure primary theme accent colors.
                  </p>
                </div>
              </div>

              <div className="klao-gs-grid-2">
                {/* Light Mode Logo Attachment */}
                <div className="klao-gs-group">
                  <label className="klao-gs-label">Main Logo Attachment (Light Mode)</label>
                  
                  <div className="klao-gs-logo-preview-box">
                    <img 
                      src={formData.logoLightUrl || '/assets/logo-standard.jpg'} 
                      alt="Light Mode Logo Preview" 
                      className="klao-gs-logo-img"
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                        {formData.logoLightUrl && !formData.logoLightUrl.startsWith('/assets/') ? 'Custom Uploaded Logo' : 'Standard Platform Sailboat Logo (Default)'}
                      </span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <span className="klao-gs-format-badge">JPG</span>
                        <span className="klao-gs-format-badge">PNG</span>
                        <span className="klao-gs-format-badge">SVG</span>
                        <span className="klao-gs-format-badge">GIF</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <label className="klao-btn klao-btn--secondary" style={{ cursor: 'pointer', fontSize: '0.8rem', padding: '6px 12px' }}>
                        <Upload size={14} style={{ marginRight: '4px' }} />
                        <span>{formData.logoLightUrl && !formData.logoLightUrl.startsWith('/assets/') ? 'Change' : 'Upload Custom'}</span>
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
                          className="klao-btn klao-btn--ghost"
                          style={{ fontSize: '0.8rem', padding: '6px 10px', color: 'var(--klao-text-muted)' }}
                          onClick={() => handleInputChange('logoLightUrl', '/assets/logo-standard.jpg')}
                          title="Reset to standard default platform logo"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>
                  <span className="klao-gs-help">Recommended Dimensions: <strong>200 × 50 px</strong> (Max 2MB)</span>
                </div>

                {/* Dark Mode Logo Attachment */}
                <div className="klao-gs-group">
                  <label className="klao-gs-label">Dark Mode Logo Attachment</label>
                  
                  <div className="klao-gs-logo-preview-box" style={{ background: '#1e293b' }}>
                    <img 
                      src={formData.logoDarkUrl || '/assets/logo-standard.jpg'} 
                      alt="Dark Mode Logo Preview" 
                      className="klao-gs-logo-img"
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#f8fafc' }}>
                        {formData.logoDarkUrl && !formData.logoDarkUrl.startsWith('/assets/') ? 'Custom Uploaded Logo' : 'Standard Platform Sailboat Logo (Default)'}
                      </span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <span className="klao-gs-format-badge">JPG</span>
                        <span className="klao-gs-format-badge">PNG</span>
                        <span className="klao-gs-format-badge">SVG</span>
                        <span className="klao-gs-format-badge">GIF</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <label className="klao-btn klao-btn--secondary" style={{ cursor: 'pointer', fontSize: '0.8rem', padding: '6px 12px' }}>
                        <Upload size={14} style={{ marginRight: '4px' }} />
                        <span>{formData.logoDarkUrl && !formData.logoDarkUrl.startsWith('/assets/') ? 'Change' : 'Upload Custom'}</span>
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
                          className="klao-btn klao-btn--ghost"
                          style={{ fontSize: '0.8rem', padding: '6px 10px', color: '#94a3b8' }}
                          onClick={() => handleInputChange('logoDarkUrl', '/assets/logo-standard.jpg')}
                          title="Reset to standard default platform logo"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>
                  <span className="klao-gs-help">Recommended Dimensions: <strong>200 × 50 px</strong> (Max 2MB)</span>
                </div>

                {/* Gradient Theme Toggle Row */}
                <div className="klao-gs-toggle-row" style={{ gridColumn: '1 / -1', marginBottom: '8px' }}>
                  <div>
                    <div className="klao-gs-toggle-title">Enable Gradient Theme Accents</div>
                    <div className="klao-gs-toggle-desc">
                      Apply smooth dual-tone gradients across primary action buttons, page header accents, and site backgrounds.
                    </div>
                  </div>
                  <label className="klao-gs-switch">
                    <input
                      type="checkbox"
                      checked={enableGradientAccent}
                      onChange={e => setEnableGradientAccent(e.target.checked)}
                    />
                    <span className="klao-gs-slider" />
                  </label>
                </div>

                {/* Color Palette Matching Technique Dropdown */}
                <div className="klao-gs-group" style={{ gridColumn: '1 / -1', marginBottom: '4px' }}>
                  <label className="klao-gs-label">Color Palette Matching Technique</label>
                  <CustomSelect
                    size="md"
                    value={paletteTechnique}
                    options={PALETTE_TECHNIQUE_OPTIONS}
                    onChange={val => setPaletteTechnique(val as ColorMatchingTechnique)}
                  />
                  <span className="klao-gs-help">
                    Color theory algorithm used to calculate auto-suggested secondary, background, and font contrast.
                  </span>
                </div>

                {/* Primary — Secondary — Background — Font Accent Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '20px', gridColumn: '1 / -1' }}>
                  <ColorAccentField
                    label="Primary Accent"
                    help="Main brand color"
                    value={formData.primaryAccentColor}
                    autoValue={computedPalette.secondary}
                    onChange={color => handleInputChange('primaryAccentColor', color)}
                  />
                  <ColorAccentField
                    label="Secondary Accent"
                    help={`${paletteTechnique.charAt(0).toUpperCase() + paletteTechnique.slice(1)} derived`}
                    value={customSecondary || ''}
                    autoValue={computedPalette.secondary}
                    onChange={val => {
                      setCustomSecondary(val);
                      setSecondaryAccentColor(val);
                    }}
                    onReset={() => resetToAuto('secondary')}
                    showPicker={true}
                  />
                  <ColorAccentField
                    label="Background Accent"
                    help="Warm / cool greyed-white tint"
                    value={customBackground || ''}
                    autoValue={computedPalette.background}
                    onChange={val => {
                      setCustomBackground(val);
                      setBackgroundAccentColor(val);
                    }}
                    onReset={() => resetToAuto('background')}
                    showPicker={true}
                  />
                  <ColorAccentField
                    label="Font Accent"
                    help="Auto contrast text color"
                    value={customFont || ''}
                    autoValue={computedPalette.font}
                    onChange={val => {
                      setCustomFont(val);
                      setFontAccentColor(val);
                    }}
                    onReset={() => resetToAuto('font')}
                    showPicker={true}
                  />
                </div>

                {/* Custom Login Tagline */}
                <div className="klao-gs-group" style={{ gridColumn: 'span 2' }}>
                  <label className="klao-gs-label">Custom Login Tagline</label>
                  <input
                    type="text"
                    className="klao-input"
                    value={formData.loginTagline}
                    onChange={e => handleInputChange('loginTagline', e.target.value)}
                    placeholder="Enter custom slogan displayed on user sign-in page"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Localization & Financials */}
          {activeTab === 'localization' && (
            <div>
              <div className="klao-gs-section-header">
                <div className="klao-gs-section-icon">
                  <Globe2 size={20} />
                </div>
                <div>
                  <h3 className="klao-gs-section-title">Localization & Financial Preferences</h3>
                  <p className="klao-gs-section-subtitle">
                    Set base operational currency, fiscal calendar starting month, timezone, and date formats.
                  </p>
                </div>
              </div>

              <div className="klao-cp-grid-2">
                <div className="klao-gs-group">
                  <label className="klao-gs-label">Primary Base Currency *</label>
                  <CustomSelect
                    size="md"
                    value={formData.baseCurrency}
                    options={CURRENCY_OPTIONS}
                    onChange={val => handleInputChange('baseCurrency', val)}
                  />
                  <span className="klao-gs-help">Default currency used across financial calculations and reporting</span>
                </div>

                <div className="klao-gs-group">
                  <label className="klao-gs-label">Fiscal Year Start Month</label>
                  <CustomSelect
                    size="md"
                    value={formData.fiscalYearStartMonth}
                    options={MONTH_OPTIONS}
                    onChange={val => handleInputChange('fiscalYearStartMonth', val)}
                  />
                  <span className="klao-gs-help">Beginning month of fiscal annual reporting</span>
                </div>

                <div className="klao-gs-group">
                  <label className="klao-gs-label">System Timezone (All Standard World Timezones)</label>
                  <CustomSelect
                    size="md"
                    value={formData.timezone}
                    options={ALL_TIMEZONE_OPTIONS}
                    onChange={val => handleInputChange('timezone', val)}
                  />
                  <span className="klao-gs-help">Standard IANA timezone list covering all global regions (400+ world timezones)</span>
                </div>

                <div className="klao-gs-group">
                  <label className="klao-gs-label">Date Display Format</label>
                  <CustomSelect
                    size="md"
                    value={formData.dateFormat}
                    options={DATE_FORMAT_OPTIONS}
                    onChange={val => handleInputChange('dateFormat', val)}
                  />
                </div>

                <div className="klao-gs-group">
                  <label className="klao-gs-label">Time Display Format</label>
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

          {/* TAB 3: System Security & Governance */}
          {activeTab === 'security' && (
            <div>
              <div className="klao-gs-section-header">
                <div className="klao-gs-section-icon">
                  <Lock size={20} />
                </div>
                <div>
                  <h3 className="klao-gs-section-title">Security & User Access Governance</h3>
                  <p className="klao-gs-section-subtitle">
                    Self-registration rules, allowed domain whitelists, default roles, and timeout limits.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="klao-gs-toggle-row">
                  <div>
                    <div className="klao-gs-toggle-title">Allow User Self-Registration</div>
                    <div className="klao-gs-toggle-desc">Allow users to sign up without an explicit admin invitation</div>
                  </div>
                  <label className="klao-gs-switch">
                    <input
                      type="checkbox"
                      checked={formData.allowSelfRegistration}
                      onChange={e => handleInputChange('allowSelfRegistration', e.target.checked)}
                    />
                    <span className="klao-gs-slider" />
                  </label>
                </div>

                <div className="klao-gs-grid-2">
                  <div className="klao-gs-group">
                    <label className="klao-gs-label">Allowed Self-Signup Email Domains</label>
                    <input
                      type="text"
                      className="klao-input"
                      value={formData.allowedEmailDomains}
                      onChange={e => handleInputChange('allowedEmailDomains', e.target.value)}
                      placeholder="e.g. company.com, partner.org"
                    />
                    <span className="klao-gs-help">Comma-separated list of allowed email domains</span>
                  </div>

                  <div className="klao-gs-group">
                    <label className="klao-gs-label">Default Role for New Users</label>
                    <CustomSelect
                      size="md"
                      value={formData.defaultUserRole}
                      options={ROLE_OPTIONS}
                      onChange={val => handleInputChange('defaultUserRole', val)}
                    />
                  </div>

                  <div className="klao-gs-group">
                    <label className="klao-gs-label">Default Post-Login Landing Page</label>
                    <CustomSelect
                      size="md"
                      value={formData.defaultLandingPage}
                      options={LANDING_PAGE_OPTIONS}
                      onChange={val => handleInputChange('defaultLandingPage', val)}
                    />
                  </div>

                  <div className="klao-gs-group">
                    <label className="klao-gs-label">Inactivity Session Timeout</label>
                    <CustomSelect
                      size="md"
                      value={formData.inactivityTimeoutMinutes}
                      options={TIMEOUT_OPTIONS}
                      onChange={val => handleInputChange('inactivityTimeoutMinutes', val)}
                    />
                  </div>

                  <div className="klao-gs-group">
                    <label className="klao-gs-label">Max Attachment File Upload Limit</label>
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

          {/* TAB 4: Maintenance & Alerts */}
          {activeTab === 'maintenance' && (
            <div>
              <div className="klao-gs-section-header">
                <div className="klao-gs-section-icon">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="klao-gs-section-title">System Maintenance & Announcement Banners</h3>
                  <p className="klao-gs-section-subtitle">
                    Emergency system lockouts and global announcement banner broadcasts.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div className="klao-gs-toggle-row" style={{ borderColor: formData.maintenanceMode ? 'rgba(239, 68, 68, 0.4)' : undefined, background: formData.maintenanceMode ? 'rgba(239, 68, 68, 0.08)' : undefined }}>
                  <div>
                    <div className="klao-gs-toggle-title" style={{ color: formData.maintenanceMode ? '#fca5a5' : undefined }}>
                      {formData.maintenanceMode ? '🔴 System Maintenance Mode Active' : 'System Maintenance Mode'}
                    </div>
                    <div className="klao-gs-toggle-desc">
                      When enabled, non-admin users will be blocked from accessing the console and shown a maintenance page.
                    </div>
                  </div>
                  <label className="klao-gs-switch">
                    <input
                      type="checkbox"
                      checked={formData.maintenanceMode}
                      onChange={e => handleInputChange('maintenanceMode', e.target.checked)}
                    />
                    <span className="klao-gs-slider" style={{ backgroundColor: formData.maintenanceMode ? '#ef4444' : undefined }} />
                  </label>
                </div>

                <div className="klao-gs-grid-2">
                  <div className="klao-gs-group" style={{ gridColumn: 'span 2' }}>
                    <label className="klao-gs-label">Broadcast Announcement Banner Text</label>
                    <input
                      type="text"
                      className="klao-input"
                      value={formData.announcementBannerText}
                      onChange={e => handleInputChange('announcementBannerText', e.target.value)}
                      placeholder="e.g. System upgrade scheduled tonight..."
                    />
                    <span className="klao-gs-help">Displayed at top of all user screens when text is non-empty</span>
                  </div>

                  <div className="klao-gs-group">
                    <label className="klao-gs-label">Announcement Banner Type</label>
                    <CustomSelect
                      size="md"
                      value={formData.announcementType}
                      options={ANNOUNCEMENT_TYPE_OPTIONS}
                      onChange={val => handleInputChange('announcementType', val)}
                    />
                  </div>

                  {formData.announcementBannerText && (
                    <div className="klao-gs-group" style={{ gridColumn: 'span 2' }}>
                      <label className="klao-gs-label">Announcement Banner Live Preview</label>
                      <div className={`klao-gs-banner-preview klao-gs-banner-preview--${formData.announcementType}`}>
                        <Megaphone size={18} />
                        <span>{formData.announcementBannerText}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Footer Save Actions */}
          <div className="klao-gs-footer">
            <div>
              {savedSuccessMsg && (
                <div className="klao-gs-toast">
                  <CheckCircle2 size={16} />
                  <span>{savedSuccessMsg}</span>
                </div>
              )}
            </div>
            <button
              type="submit"
              className="klao-btn klao-btn--primary"
              disabled={isSaving}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Save size={16} />
              <span>{isSaving ? 'Saving Settings...' : 'Save General Settings'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default AdminGeneralSettings;
