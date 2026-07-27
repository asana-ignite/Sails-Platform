import React, { useState } from 'react';
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
  // Section 1: Organization Details
  legalName: string;
  tradingName: string;
  taxId: string;
  industry: string;
  companySize: string;
  websiteUrl: string;

  // Section 2: Contact & Headquarters
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

  // Section 3: Legal & Compliance
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

const COUNTRY_OPTIONS = [
  { value: 'Afghanistan', label: 'Afghanistan' },
  { value: 'Albania', label: 'Albania' },
  { value: 'Algeria', label: 'Algeria' },
  { value: 'Andorra', label: 'Andorra' },
  { value: 'Angola', label: 'Angola' },
  { value: 'Argentina', label: 'Argentina' },
  { value: 'Armenia', label: 'Armenia' },
  { value: 'Australia', label: 'Australia' },
  { value: 'Austria', label: 'Austria' },
  { value: 'Azerbaijan', label: 'Azerbaijan' },
  { value: 'Bahrain', label: 'Bahrain' },
  { value: 'Bangladesh', label: 'Bangladesh' },
  { value: 'Belgium', label: 'Belgium' },
  { value: 'Brazil', label: 'Brazil' },
  { value: 'Brunei', label: 'Brunei' },
  { value: 'Bulgaria', label: 'Bulgaria' },
  { value: 'Cambodia', label: 'Cambodia' },
  { value: 'Canada', label: 'Canada' },
  { value: 'Chile', label: 'Chile' },
  { value: 'China', label: 'China' },
  { value: 'Colombia', label: 'Colombia' },
  { value: 'Costa Rica', label: 'Costa Rica' },
  { value: 'Croatia', label: 'Croatia' },
  { value: 'Cyprus', label: 'Cyprus' },
  { value: 'Czech Republic', label: 'Czech Republic' },
  { value: 'Denmark', label: 'Denmark' },
  { value: 'Egypt', label: 'Egypt' },
  { value: 'Estonia', label: 'Estonia' },
  { value: 'Finland', label: 'Finland' },
  { value: 'France', label: 'France' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Germany', label: 'Germany' },
  { value: 'Greece', label: 'Greece' },
  { value: 'Hong Kong', label: 'Hong Kong' },
  { value: 'Hungary', label: 'Hungary' },
  { value: 'Iceland', label: 'Iceland' },
  { value: 'India', label: 'India' },
  { value: 'Indonesia', label: 'Indonesia' },
  { value: 'Ireland', label: 'Ireland' },
  { value: 'Israel', label: 'Israel' },
  { value: 'Italy', label: 'Italy' },
  { value: 'Japan', label: 'Japan' },
  { value: 'Jordan', label: 'Jordan' },
  { value: 'Kazakhstan', label: 'Kazakhstan' },
  { value: 'Kenya', label: 'Kenya' },
  { value: 'Kuwait', label: 'Kuwait' },
  { value: 'Laos', label: 'Laos' },
  { value: 'Latvia', label: 'Latvia' },
  { value: 'Lebanon', label: 'Lebanon' },
  { value: 'Lithuania', label: 'Lithuania' },
  { value: 'Luxembourg', label: 'Luxembourg' },
  { value: 'Malaysia', label: 'Malaysia' },
  { value: 'Maldives', label: 'Maldives' },
  { value: 'Malta', label: 'Malta' },
  { value: 'Mexico', label: 'Mexico' },
  { value: 'Monaco', label: 'Monaco' },
  { value: 'Morocco', label: 'Morocco' },
  { value: 'Myanmar', label: 'Myanmar' },
  { value: 'Nepal', label: 'Nepal' },
  { value: 'Netherlands', label: 'Netherlands' },
  { value: 'New Zealand', label: 'New Zealand' },
  { value: 'Nigeria', label: 'Nigeria' },
  { value: 'Norway', label: 'Norway' },
  { value: 'Oman', label: 'Oman' },
  { value: 'Pakistan', label: 'Pakistan' },
  { value: 'Panama', label: 'Panama' },
  { value: 'Peru', label: 'Peru' },
  { value: 'Philippines', label: 'Philippines' },
  { value: 'Poland', label: 'Poland' },
  { value: 'Portugal', label: 'Portugal' },
  { value: 'Qatar', label: 'Qatar' },
  { value: 'Romania', label: 'Romania' },
  { value: 'Saudi Arabia', label: 'Saudi Arabia' },
  { value: 'Singapore', label: 'Singapore' },
  { value: 'Slovakia', label: 'Slovakia' },
  { value: 'Slovenia', label: 'Slovenia' },
  { value: 'South Africa', label: 'South Africa' },
  { value: 'South Korea', label: 'South Korea' },
  { value: 'Spain', label: 'Spain' },
  { value: 'Sri Lanka', label: 'Sri Lanka' },
  { value: 'Sweden', label: 'Sweden' },
  { value: 'Switzerland', label: 'Switzerland' },
  { value: 'Taiwan', label: 'Taiwan' },
  { value: 'Thailand', label: 'Thailand' },
  { value: 'Turkey', label: 'Turkey' },
  { value: 'United Arab Emirates', label: 'United Arab Emirates' },
  { value: 'United Kingdom', label: 'United Kingdom' },
  { value: 'United States', label: 'United States' },
  { value: 'Vietnam', label: 'Vietnam' }
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
      setErrorMsg('Failed to load company profile from server.');
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
    if (!email) return true; // Optional email fields allowed
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleEmailBlur = (field: 'corporateEmail' | 'supportEmail' | 'dpoEmail') => {
    const val = formData[field];
    if (val && !validateEmail(val)) {
      setEmailErrors(prev => ({ ...prev, [field]: 'Please enter a valid email address (e.g. name@domain.com).' }));
    } else {
      setEmailErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSavedSuccessMsg(null);
    setErrorMsg(null);

    // Re-validate email formats
    const isCorpValid = validateEmail(formData.corporateEmail);
    const isSuppValid = validateEmail(formData.supportEmail);
    const isDpoValid = validateEmail(formData.dpoEmail);

    if (!isCorpValid || !isSuppValid || !isDpoValid) {
      setEmailErrors({
        corporateEmail: isCorpValid ? undefined : 'Please enter a valid email address.',
        supportEmail: isSuppValid ? undefined : 'Please enter a valid email address.',
        dpoEmail: isDpoValid ? undefined : 'Please enter a valid email address.'
      });
      setErrorMsg('Please fix the invalid email formats highlighted below before saving.');
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
        setSavedSuccessMsg('Company Profile updated successfully.');
        setTimeout(() => {
          setSavedSuccessMsg(null);
        }, 4000);
      } else {
        setErrorMsg(result.error || 'Failed to save company profile.');
      }
    } catch (err: any) {
      console.error('Failed to save company profile:', err);
      setErrorMsg('Failed to save company profile to server.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="klao-company-profile klao-page-container">
      {/* Tab Navigation */}
      <nav className="klao-company-profile__nav">
        <button
          type="button"
          className={`klao-company-profile__tab ${activeTab === 'organization' ? 'klao-company-profile__tab--active' : ''}`}
          onClick={() => setActiveTab('organization')}
        >
          <Briefcase size={16} />
          <span>Organization Details</span>
        </button>
        <button
          type="button"
          className={`klao-company-profile__tab ${activeTab === 'address' ? 'klao-company-profile__tab--active' : ''}`}
          onClick={() => setActiveTab('address')}
        >
          <MapPin size={16} />
          <span>Contact & Address</span>
        </button>
      </nav>

      {/* Form Container */}
      <form onSubmit={handleSave}>
        <div className="klao-card klao-company-profile__card">
          {/* TAB 1: Organization Details */}
          {activeTab === 'organization' && (
            <div>
              <div className="klao-company-profile__section-header">
                <div className="klao-company-profile__section-icon">
                  <Briefcase size={20} />
                </div>
                <div>
                  <h3 className="klao-company-profile__section-title">Organization Details</h3>
                  <p className="klao-company-profile__section-subtitle">
                    Legal registration, trading names, tax identifiers, and public business profile.
                  </p>
                </div>
              </div>

              <div className="klao-cp-grid-2">
                <div className="klao-cp-group">
                  <label className="klao-cp-label">Official Legal Name *</label>
                  <input
                    type="text"
                    className="klao-input"
                    value={formData.legalName}
                    onChange={e => handleInputChange('legalName', e.target.value)}
                    placeholder="e.g. Acme Corporation Co., Ltd."
                    required
                  />
                  <span className="klao-cp-help">Registered legal entity name as shown on tax certificates</span>
                </div>

                <div className="klao-cp-group">
                  <label className="klao-cp-label">Trading / Display Name *</label>
                  <input
                    type="text"
                    className="klao-input"
                    value={formData.tradingName}
                    onChange={e => handleInputChange('tradingName', e.target.value)}
                    placeholder="e.g. Acme Software"
                    required
                  />
                  <span className="klao-cp-help">Display name used in platform menus and invoices</span>
                </div>

                <div className="klao-cp-group">
                  <label className="klao-cp-label">Tax ID / Business Registration Number</label>
                  <input
                    type="text"
                    className="klao-input"
                    value={formData.taxId}
                    onChange={e => handleInputChange('taxId', e.target.value)}
                    placeholder="e.g. 0105566012345"
                  />
                  <span className="klao-cp-help">Official government tax identification number</span>
                </div>

                <div className="klao-cp-group">
                  <label className="klao-cp-label">Corporate Website URL</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="url"
                      className="klao-input"
                      value={formData.websiteUrl}
                      onChange={e => handleInputChange('websiteUrl', e.target.value)}
                      placeholder="https://example.com"
                    />
                  </div>
                </div>

                <div className="klao-cp-group">
                  <label className="klao-cp-label">Industry Sector</label>
                  <CustomSelect
                    size="md"
                    value={formData.industry}
                    options={INDUSTRY_OPTIONS}
                    onChange={val => handleInputChange('industry', val)}
                  />
                </div>

                <div className="klao-cp-group">
                  <label className="klao-cp-label">Company Size</label>
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

          {/* TAB 2: Contact & Address */}
          {activeTab === 'address' && (
            <div>
              <div className="klao-company-profile__section-header">
                <div className="klao-company-profile__section-icon">
                  <MapPin size={20} />
                </div>
                <div>
                  <h3 className="klao-company-profile__section-title">Corporate Contact & Location</h3>
                  <p className="klao-company-profile__section-subtitle">
                    Corporate contact details and registered physical business location.
                  </p>
                </div>
              </div>

              <div className="klao-cp-grid-2">
              <div className="klao-cp-grid-2 klao-cp-full" style={{ marginBottom: '24px' }}>
                {/* Column 1: Business Contact Person */}
                <div style={{ background: 'var(--klao-bg-body, #f4f7f9)', padding: '16px', borderRadius: 'var(--klao-radius-md, 8px)', border: '1px solid var(--klao-border-color, #e1e9ef)' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--klao-text-main, #344759)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    Business Contact Person
                  </h4>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="klao-cp-group">
                      <label className="klao-cp-label">Business Contact Name</label>
                      <input
                        type="text"
                        className="klao-input"
                        value={formData.businessContactName}
                        onChange={e => handleInputChange('businessContactName', e.target.value)}
                        placeholder="e.g. John Doe"
                      />
                    </div>

                    <div className="klao-cp-group">
                      <label className="klao-cp-label">Email</label>
                      <input
                        type="email"
                        className={`klao-input ${emailErrors.corporateEmail ? 'is-invalid' : ''}`}
                        value={formData.corporateEmail}
                        onChange={e => handleInputChange('corporateEmail', e.target.value)}
                        onBlur={() => handleEmailBlur('corporateEmail')}
                        placeholder="john@company.com"
                        style={emailErrors.corporateEmail ? { borderColor: 'var(--klao-danger, #fd6161)' } : undefined}
                      />
                      {emailErrors.corporateEmail && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--klao-danger, #fd6161)', marginTop: '2px' }}>
                          {emailErrors.corporateEmail}
                        </span>
                      )}
                    </div>

                    <div className="klao-cp-group">
                      <label className="klao-cp-label">Phone Number</label>
                      <input
                        type="text"
                        className="klao-input"
                        value={formData.businessContactPhone || formData.phone}
                        onChange={e => {
                          handleInputChange('businessContactPhone', e.target.value);
                          handleInputChange('phone', e.target.value);
                        }}
                        placeholder="+66 2 123 4567"
                      />
                    </div>
                  </div>
                </div>

                {/* Column 2: Support Contact Person */}
                <div style={{ background: 'var(--klao-bg-body, #f4f7f9)', padding: '16px', borderRadius: 'var(--klao-radius-md, 8px)', border: '1px solid var(--klao-border-color, #e1e9ef)' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--klao-text-main, #344759)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    Support Contact Person
                  </h4>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="klao-cp-group">
                      <label className="klao-cp-label">Support Contact Name</label>
                      <input
                        type="text"
                        className="klao-input"
                        value={formData.supportContactName}
                        onChange={e => handleInputChange('supportContactName', e.target.value)}
                        placeholder="e.g. Jane Smith / Support Lead"
                      />
                    </div>

                    <div className="klao-cp-group">
                      <label className="klao-cp-label">Email</label>
                      <input
                        type="email"
                        className={`klao-input ${emailErrors.supportEmail ? 'is-invalid' : ''}`}
                        value={formData.supportEmail}
                        onChange={e => handleInputChange('supportEmail', e.target.value)}
                        onBlur={() => handleEmailBlur('supportEmail')}
                        placeholder="support@company.com"
                        style={emailErrors.supportEmail ? { borderColor: 'var(--klao-danger, #fd6161)' } : undefined}
                      />
                      {emailErrors.supportEmail && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--klao-danger, #fd6161)', marginTop: '2px' }}>
                          {emailErrors.supportEmail}
                        </span>
                      )}
                    </div>

                    <div className="klao-cp-group">
                      <label className="klao-cp-label">Support Phone Number</label>
                      <input
                        type="text"
                        className="klao-input"
                        value={formData.supportPhone || formData.fax}
                        onChange={e => {
                          handleInputChange('supportPhone', e.target.value);
                          handleInputChange('fax', e.target.value);
                        }}
                        placeholder="+66 2 123 4568"
                      />
                    </div>
                  </div>
                </div>
              </div>

                <div className="klao-cp-group klao-cp-full">
                  <label className="klao-cp-label">Address Line 1 <span style={{ color: 'var(--klao-danger, #fd6161)' }}>*</span></label>
                  <input
                    type="text"
                    required
                    className="klao-input"
                    value={formData.streetAddress}
                    onChange={e => handleInputChange('streetAddress', e.target.value)}
                    placeholder="Street address, P.O. box, building, suite, unit, etc."
                  />
                </div>

                <div className="klao-cp-group klao-cp-full">
                  <label className="klao-cp-label">Address Line 2 <span style={{ color: 'var(--klao-text-muted, #6b8ba4)', fontWeight: 400 }}>(Optional)</span></label>
                  <input
                    type="text"
                    className="klao-input"
                    value={formData.subDistrict}
                    onChange={e => handleInputChange('subDistrict', e.target.value)}
                    placeholder="Apartment, suite, unit, building, floor, etc."
                  />
                </div>

                <div className="klao-cp-group">
                  <label className="klao-cp-label">City / Province / State</label>
                  <input
                    type="text"
                    className="klao-input"
                    value={formData.city}
                    onChange={e => handleInputChange('city', e.target.value)}
                    placeholder="e.g. San Francisco / Bangkok / Bavaria"
                  />
                </div>

                <div className="klao-cp-group">
                  <label className="klao-cp-label">Country</label>
                  <CustomSelect
                    value={formData.country}
                    options={COUNTRY_OPTIONS}
                    onChange={val => handleInputChange('country', val)}
                    placeholder="Select or search country..."
                    searchable={true}
                  />
                </div>

                <div className="klao-cp-group">
                  <label className="klao-cp-label">Zip / Postal Code</label>
                  <input
                    type="text"
                    className="klao-input"
                    value={formData.postalCode}
                    onChange={e => handleInputChange('postalCode', e.target.value)}
                    placeholder="e.g. 94105 / 10110"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Footer Save Actions */}
          <div className="klao-cp-footer">
            <div>
              {savedSuccessMsg && (
                <div className="klao-cp-toast klao-cp-toast--success">
                  <CheckCircle2 size={16} />
                  <span>{savedSuccessMsg}</span>
                </div>
              )}
              {errorMsg && (
                <div className="klao-cp-toast klao-cp-toast--danger">
                  <AlertCircle size={16} />
                  <span>{errorMsg}</span>
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
              <span>{isSaving ? 'Saving Changes...' : 'Save Profile Changes'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default AdminCompanyProfile;
