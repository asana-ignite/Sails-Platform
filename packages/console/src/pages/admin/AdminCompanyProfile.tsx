/**
 * AdminCompanyProfile — tenant branding/legal profile editor.
 */
import React, { useState } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { COUNTRY_OPTIONS } from '@sails/shared';
import { 
  Building2, 
  MapPin, 
  ShieldCheck, 
  Globe, 
  Save, 
  CheckCircle2, 
  AlertCircle,
  Phone, 
  Mail, 
  FileText,
  Briefcase
} from 'lucide-react';
import { CustomSelect } from '../../components/common/CustomSelect';
import './AdminCompanyProfile.css';

export interface CompanyProfileData {
  legalName: string;
  tradingName: string;
  taxId: string;
  industry: string;
  companySize: string;
  websiteUrl: string;

  businessContactName: string;
  corporateEmail: string;
  businessContactPhone: string;

  supportContactName: string;
  supportEmail: string;
  supportPhone: string;
  phone: string;
  fax: string;

  streetAddress: string;
  subDistrict: string;
  city: string;
  postalCode: string;
  country: string;

  dpoName: string;
  dpoEmail: string;
  termsUrl: string;
  privacyUrl: string;
}

const DEFAULT_PROFILE_DATA: CompanyProfileData = {
  legalName: '',
  tradingName: '',
  taxId: '',
  industry: 'Software & Technology',
  companySize: '51-200',
  websiteUrl: '',

  businessContactName: '',
  corporateEmail: '',
  businessContactPhone: '',

  supportContactName: '',
  supportEmail: '',
  supportPhone: '',
  phone: '',
  fax: '',

  streetAddress: '',
  subDistrict: '',
  city: '',
  postalCode: '',
  country: '',

  dpoName: '',
  dpoEmail: '',
  termsUrl: '',
  privacyUrl: ''
};

const INDUSTRY_OPTIONS = [
  { value: 'Software & Technology', label: 'Software & Technology' },
  { value: 'Financial Services & Banking', label: 'Financial Services & Banking' },
  { value: 'Retail & E-Commerce', label: 'Retail & E-Commerce' },
  { value: 'Healthcare & Life Sciences', label: 'Healthcare & Life Sciences' },
  { value: 'Manufacturing & Logistics', label: 'Manufacturing & Logistics' },
  { value: 'Telecommunications', label: 'Telecommunications' },
  { value: 'Education & Research', label: 'Education & Research' },
  { value: 'Other', label: 'Other Industry' }
];

const SIZE_OPTIONS = [
  { value: '1-10', label: '1 - 10 Employees' },
  { value: '11-50', label: '11 - 50 Employees' },
  { value: '51-200', label: '51 - 200 Employees' },
  { value: '201-1000', label: '201 - 1,000 Employees' },
  { value: '1000+', label: '1,000+ Enterprise Employees' }
];


const STATE_PROVINCE_MAP: Record<string, { label: string; options: { value: string; label: string }[] }> = {
  Thailand: {
    label: 'Province',
    options: [
      { value: 'Bangkok', label: 'Bangkok' },
      { value: 'Chiang Mai', label: 'Chiang Mai' },
      { value: 'Chonburi (Pattaya)', label: 'Chonburi (Pattaya)' },
      { value: 'Phuket', label: 'Phuket' },
      { value: 'Nonthaburi', label: 'Nonthaburi' },
      { value: 'Samut Prakan', label: 'Samut Prakan' },
      { value: 'Pathum Thani', label: 'Pathum Thani' },
      { value: 'Rayong', label: 'Rayong' },
      { value: 'Khon Kaen', label: 'Khon Kaen' },
      { value: 'Nakhon Ratchasima', label: 'Nakhon Ratchasima' },
      { value: 'Songkhla', label: 'Songkhla' },
      { value: 'Surat Thani (Koh Samui)', label: 'Surat Thani (Koh Samui)' }
    ]
  },
  'United States': {
    label: 'State',
    options: [
      { value: 'California', label: 'California (CA)' },
      { value: 'New York', label: 'New York (NY)' },
      { value: 'Texas', label: 'Texas (TX)' },
      { value: 'Florida', label: 'Florida (FL)' },
      { value: 'Illinois', label: 'Illinois (IL)' },
      { value: 'Washington', label: 'Washington (WA)' },
      { value: 'Massachusetts', label: 'Massachusetts (MA)' },
      { value: 'Delaware', label: 'Delaware (DE)' },
      { value: 'Nevada', label: 'Nevada (NV)' },
      { value: 'Colorado', label: 'Colorado (CO)' }
    ]
  },
  Canada: {
    label: 'Province / Territory',
    options: [
      { value: 'Ontario', label: 'Ontario (ON)' },
      { value: 'Quebec', label: 'Quebec (QC)' },
      { value: 'British Columbia', label: 'British Columbia (BC)' },
      { value: 'Alberta', label: 'Alberta (AB)' },
      { value: 'Manitoba', label: 'Manitoba (MB)' },
      { value: 'Nova Scotia', label: 'Nova Scotia (NS)' }
    ]
  },
  Australia: {
    label: 'State / Territory',
    options: [
      { value: 'New South Wales', label: 'New South Wales (NSW)' },
      { value: 'Victoria', label: 'Victoria (VIC)' },
      { value: 'Queensland', label: 'Queensland (QLD)' },
      { value: 'Western Australia', label: 'Western Australia (WA)' },
      { value: 'South Australia', label: 'South Australia (SA)' },
      { value: 'Tasmania', label: 'Tasmania (TAS)' }
    ]
  },
  Japan: {
    label: 'Prefecture',
    options: [
      { value: 'Tokyo', label: 'Tokyo' },
      { value: 'Osaka', label: 'Osaka' },
      { value: 'Kanagawa', label: 'Kanagawa' },
      { value: 'Aichi', label: 'Aichi' },
      { value: 'Hokkaido', label: 'Hokkaido' },
      { value: 'Fukuoka', label: 'Fukuoka' },
      { value: 'Kyoto', label: 'Kyoto' }
    ]
  },
  Singapore: {
    label: 'Region',
    options: [
      { value: 'Central Region', label: 'Central Region' },
      { value: 'East Region', label: 'East Region' },
      { value: 'North Region', label: 'North Region' },
      { value: 'North-East Region', label: 'North-East Region' },
      { value: 'West Region', label: 'West Region' }
    ]
  },
  'United Kingdom': {
    label: 'Country / Region',
    options: [
      { value: 'England', label: 'England' },
      { value: 'Scotland', label: 'Scotland' },
      { value: 'Wales', label: 'Wales' },
      { value: 'Northern Ireland', label: 'Northern Ireland' },
      { value: 'Greater London', label: 'Greater London' }
    ]
  },
  Germany: {
    label: 'Federal State (Bundesland)',
    options: [
      { value: 'Bavaria', label: 'Bavaria (Bayern)' },
      { value: 'Berlin', label: 'Berlin' },
      { value: 'North Rhine-Westphalia', label: 'North Rhine-Westphalia' },
      { value: 'Baden-Württemberg', label: 'Baden-Württemberg' },
      { value: 'Hesse', label: 'Hesse (Hessen)' },
      { value: 'Hamburg', label: 'Hamburg' }
    ]
  }
};

const AdminCompanyProfile: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'organization' | 'address'>('organization');
  const [formData, setFormData] = useState<CompanyProfileData>(DEFAULT_PROFILE_DATA);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  React.useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const res = await fetch('/api/console/company-profile');
      const result = await res.json();
      if (result.success && result.data) {
        setFormData(result.data);
      }
    } catch (err: any) {
      console.error('Failed to load company profile:', err);
      setErrorMsg(t('admin_company_profile.messages.loadError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof CompanyProfileData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (emailErrors[field as keyof typeof emailErrors]) {
      setEmailErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const [emailErrors, setEmailErrors] = useState<{ corporateEmail?: string; supportEmail?: string; dpoEmail?: string }>({});

  const validateEmail = (email: string) => {
    if (!email) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleEmailBlur = (field: 'corporateEmail' | 'supportEmail' | 'dpoEmail') => {
    const val = formData[field];
    if (val && !validateEmail(val)) {
      setEmailErrors(prev => ({ ...prev, [field]: t('admin_company_profile.validation.invalidEmail') }));
    } else {
      setEmailErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSavedSuccessMsg(null);
    setErrorMsg(null);

    const isCorpValid = validateEmail(formData.corporateEmail);
    const isSuppValid = validateEmail(formData.supportEmail);
    const isDpoValid = validateEmail(formData.dpoEmail);

    if (!isCorpValid || !isSuppValid || !isDpoValid) {
      setEmailErrors({
        corporateEmail: isCorpValid ? undefined : t('admin_company_profile.validation.invalidEmailShort'),
        supportEmail: isSuppValid ? undefined : t('admin_company_profile.validation.invalidEmailShort'),
        dpoEmail: isDpoValid ? undefined : t('admin_company_profile.validation.invalidEmailShort')
      });
      setErrorMsg(t('admin_company_profile.validation.fixEmailFormats'));
      setIsSaving(false);
      return;
    }

    try {
      const res = await fetch('/api/console/company-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const result = await res.json();
      if (result.success) {
        setSavedSuccessMsg(t('admin_company_profile.messages.saveSuccess'));
        setTimeout(() => {
          setSavedSuccessMsg(null);
        }, 4000);
      } else {
        setErrorMsg(result.error || t('admin_company_profile.messages.saveError'));
      }
    } catch (err: any) {
      console.error('Failed to save company profile:', err);
      setErrorMsg(t('admin_company_profile.messages.saveServerError'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="sails-company-profile sails-page-container">
      <nav className="sails-company-profile__nav">
        <button
          type="button"
          className={`sails-company-profile__tab ${activeTab === 'organization' ? 'sails-company-profile__tab--active' : ''}`}
          onClick={() => setActiveTab('organization')}
        >
          <Briefcase size={16} />
          <span>{t('admin_company_profile.tabs.organization')}</span>
        </button>
        <button
          type="button"
          className={`sails-company-profile__tab ${activeTab === 'address' ? 'sails-company-profile__tab--active' : ''}`}
          onClick={() => setActiveTab('address')}
        >
          <MapPin size={16} />
          <span>{t('admin_company_profile.tabs.contact')}</span>
        </button>
      </nav>

      <form onSubmit={handleSave}>
        <div className="sails-card sails-company-profile__card">
          {activeTab === 'organization' && (
            <div>
              <div className="sails-company-profile__section-header">
                <div className="sails-company-profile__section-icon">
                  <Briefcase size={20} />
                </div>
                <div>
                  <h3 className="sails-company-profile__section-title">{t('admin_company_profile.sections.organization.title')}</h3>
                  <p className="sails-company-profile__section-subtitle">
                    {t('admin_company_profile.sections.organization.subtitle')}
                  </p>
                </div>
              </div>

              <div className="sails-cp-grid-2">
                <div className="sails-cp-group">
                  <label className="sails-cp-label">{t('admin_company_profile.fields.legalNameRequired')}</label>
                  <input
                    type="text"
                    className="sails-input"
                    value={formData.legalName}
                    onChange={e => handleInputChange('legalName', e.target.value)}
                    placeholder={t('admin_company_profile.fields.legalNamePlaceholder')}
                    required
                  />
                  <span className="sails-cp-help">{t('admin_company_profile.fields.legalNameHelp')}</span>
                </div>

                <div className="sails-cp-group">
                  <label className="sails-cp-label">{t('admin_company_profile.fields.tradingNameRequired')}</label>
                  <input
                    type="text"
                    className="sails-input"
                    value={formData.tradingName}
                    onChange={e => handleInputChange('tradingName', e.target.value)}
                    placeholder={t('admin_company_profile.fields.tradingNamePlaceholder')}
                    required
                  />
                  <span className="sails-cp-help">{t('admin_company_profile.fields.tradingNameHelp')}</span>
                </div>

                <div className="sails-cp-group">
                  <label className="sails-cp-label">{t('admin_company_profile.fields.taxId')}</label>
                  <input
                    type="text"
                    className="sails-input"
                    value={formData.taxId}
                    onChange={e => handleInputChange('taxId', e.target.value)}
                    placeholder={t('admin_company_profile.fields.taxIdPlaceholder')}
                  />
                  <span className="sails-cp-help">{t('admin_company_profile.fields.taxIdHelp')}</span>
                </div>

                <div className="sails-cp-group">
                  <label className="sails-cp-label">{t('admin_company_profile.fields.websiteUrl')}</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="url"
                      className="sails-input"
                      value={formData.websiteUrl}
                      onChange={e => handleInputChange('websiteUrl', e.target.value)}
                      placeholder={t('admin_company_profile.fields.websiteUrlPlaceholder')}
                    />
                  </div>
                </div>

                <div className="sails-cp-group">
                  <label className="sails-cp-label">{t('admin_company_profile.fields.industry')}</label>
                  <CustomSelect
                    size="md"
                    value={formData.industry}
                    options={INDUSTRY_OPTIONS}
                    onChange={val => handleInputChange('industry', val)}
                  />
                </div>

                <div className="sails-cp-group">
                  <label className="sails-cp-label">{t('admin_company_profile.fields.companySize')}</label>
                  <CustomSelect
                    size="md"
                    value={formData.companySize}
                    options={SIZE_OPTIONS}
                    onChange={val => handleInputChange('companySize', val)}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'address' && (
            <div>
              <div className="sails-company-profile__section-header">
                <div className="sails-company-profile__section-icon">
                  <MapPin size={20} />
                </div>
                <div>
                  <h3 className="sails-company-profile__section-title">{t('admin_company_profile.sections.contact.title')}</h3>
                  <p className="sails-company-profile__section-subtitle">
                    {t('admin_company_profile.sections.contact.subtitle')}
                  </p>
                </div>
              </div>

              <div className="sails-cp-grid-2">
              <div className="sails-cp-grid-2 sails-cp-full" style={{ marginBottom: '24px' }}>
                <div style={{ background: 'var(--sails-bg-body, #f4f7f9)', padding: '16px', borderRadius: 'var(--sails-radius-md, 8px)', border: '1px solid var(--sails-border-color, #e1e9ef)' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--sails-text-main, #344759)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {t('admin_company_profile.fields.businessContactPerson')}
                  </h4>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="sails-cp-group">
                      <label className="sails-cp-label">{t('admin_company_profile.fields.businessContactName')}</label>
                      <input
                        type="text"
                        className="sails-input"
                        value={formData.businessContactName}
                        onChange={e => handleInputChange('businessContactName', e.target.value)}
                        placeholder={t('admin_company_profile.fields.businessContactNamePlaceholder')}
                      />
                    </div>

                    <div className="sails-cp-group">
                      <label className="sails-cp-label">{t('admin_company_profile.fields.email')}</label>
                      <input
                        type="email"
                        className={`sails-input ${emailErrors.corporateEmail ? 'is-invalid' : ''}`}
                        value={formData.corporateEmail}
                        onChange={e => handleInputChange('corporateEmail', e.target.value)}
                        onBlur={() => handleEmailBlur('corporateEmail')}
                        placeholder={t('admin_company_profile.fields.corporateEmailPlaceholder')}
                        style={emailErrors.corporateEmail ? { borderColor: 'var(--sails-danger, #fd6161)' } : undefined}
                      />
                      {emailErrors.corporateEmail && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--sails-danger, #fd6161)', marginTop: '2px' }}>
                          {emailErrors.corporateEmail}
                        </span>
                      )}
                    </div>

                    <div className="sails-cp-group">
                      <label className="sails-cp-label">{t('admin_company_profile.fields.phoneNumber')}</label>
                      <input
                        type="text"
                        className="sails-input"
                        value={formData.businessContactPhone || formData.phone}
                        onChange={e => {
                          handleInputChange('businessContactPhone', e.target.value);
                          handleInputChange('phone', e.target.value);
                        }}
                        placeholder={t('admin_company_profile.fields.phonePlaceholder')}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ background: 'var(--sails-bg-body, #f4f7f9)', padding: '16px', borderRadius: 'var(--sails-radius-md, 8px)', border: '1px solid var(--sails-border-color, #e1e9ef)' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--sails-text-main, #344759)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {t('admin_company_profile.fields.supportContactPerson')}
                  </h4>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="sails-cp-group">
                      <label className="sails-cp-label">{t('admin_company_profile.fields.supportContactName')}</label>
                      <input
                        type="text"
                        className="sails-input"
                        value={formData.supportContactName}
                        onChange={e => handleInputChange('supportContactName', e.target.value)}
                        placeholder={t('admin_company_profile.fields.supportContactNamePlaceholder')}
                      />
                    </div>

                    <div className="sails-cp-group">
                      <label className="sails-cp-label">{t('admin_company_profile.fields.email')}</label>
                      <input
                        type="email"
                        className={`sails-input ${emailErrors.supportEmail ? 'is-invalid' : ''}`}
                        value={formData.supportEmail}
                        onChange={e => handleInputChange('supportEmail', e.target.value)}
                        onBlur={() => handleEmailBlur('supportEmail')}
                        placeholder={t('admin_company_profile.fields.supportEmailPlaceholder')}
                        style={emailErrors.supportEmail ? { borderColor: 'var(--sails-danger, #fd6161)' } : undefined}
                      />
                      {emailErrors.supportEmail && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--sails-danger, #fd6161)', marginTop: '2px' }}>
                          {emailErrors.supportEmail}
                        </span>
                      )}
                    </div>

                    <div className="sails-cp-group">
                      <label className="sails-cp-label">{t('admin_company_profile.fields.supportPhoneNumber')}</label>
                      <input
                        type="text"
                        className="sails-input"
                        value={formData.supportPhone || formData.fax}
                        onChange={e => {
                          handleInputChange('supportPhone', e.target.value);
                          handleInputChange('fax', e.target.value);
                        }}
                        placeholder={t('admin_company_profile.fields.supportPhonePlaceholder')}
                      />
                    </div>
                  </div>
                </div>
              </div>

                <div className="sails-cp-group sails-cp-full">
                  <label className="sails-cp-label">{t('admin_company_profile.fields.addressLine1Required')}</label>
                  <input
                    type="text"
                    required
                    className="sails-input"
                    value={formData.streetAddress}
                    onChange={e => handleInputChange('streetAddress', e.target.value)}
                    placeholder={t('admin_company_profile.fields.addressLine1Placeholder')}
                  />
                </div>

                <div className="sails-cp-group sails-cp-full">
                  <label className="sails-cp-label">{t('admin_company_profile.fields.addressLine2Optional')}</label>
                  <input
                    type="text"
                    className="sails-input"
                    value={formData.subDistrict}
                    onChange={e => handleInputChange('subDistrict', e.target.value)}
                    placeholder={t('admin_company_profile.fields.addressLine2Placeholder')}
                  />
                </div>

                <div className="sails-cp-group">
                  <label className="sails-cp-label">{t('admin_company_profile.fields.city')}</label>
                  <input
                    type="text"
                    className="sails-input"
                    value={formData.city}
                    onChange={e => handleInputChange('city', e.target.value)}
                    placeholder={t('admin_company_profile.fields.cityPlaceholder')}
                  />
                </div>

                <div className="sails-cp-group">
                  <label className="sails-cp-label">{t('admin_company_profile.fields.country')}</label>
                  <CustomSelect
                    value={formData.country}
                    options={COUNTRY_OPTIONS}
                    onChange={val => handleInputChange('country', val)}
                    placeholder={t('admin_company_profile.fields.countryPlaceholder')}
                    searchable={true}
                  />
                </div>

                <div className="sails-cp-group">
                  <label className="sails-cp-label">{t('admin_company_profile.fields.postalCode')}</label>
                  <input
                    type="text"
                    className="sails-input"
                    value={formData.postalCode}
                    onChange={e => handleInputChange('postalCode', e.target.value)}
                    placeholder={t('admin_company_profile.fields.postalCodePlaceholder')}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="sails-cp-footer">
            <div>
              {savedSuccessMsg && (
                <div className="sails-cp-toast sails-cp-toast--success">
                  <CheckCircle2 size={16} />
                  <span>{savedSuccessMsg}</span>
                </div>
              )}
              {errorMsg && (
                <div className="sails-cp-toast sails-cp-toast--danger">
                  <AlertCircle size={16} />
                  <span>{errorMsg}</span>
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
              <span>{isSaving ? t('admin_company_profile.buttons.saving') : t('admin_company_profile.buttons.saveChanges')}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default AdminCompanyProfile;
