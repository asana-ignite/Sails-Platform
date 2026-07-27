import React, { useState } from 'react';
import { 
  Building2, 
  MapPin, 
  ShieldCheck, 
  Globe, 
  Save, 
  CheckCircle2, 
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
  corporateEmail: string;
  supportEmail: string;
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
  legalName: 'Klao Corporation Co., Ltd.',
  tradingName: 'Klao Platform',
  taxId: '0105566012345',
  industry: 'Software & Technology',
  companySize: '51-200',
  websiteUrl: 'https://klao.io',

  corporateEmail: 'corporate@klao.io',
  supportEmail: 'support@klao.io',
  phone: '+66 2 123 4567',
  fax: '+66 2 123 4568',
  streetAddress: '123 Tech Tower, 15th Floor, Sukhumvit Rd',
  subDistrict: 'Klongtoey Nua, Wattana',
  city: 'Bangkok',
  postalCode: '10110',
  country: 'Thailand',

  dpoName: 'Somsak Compliance',
  dpoEmail: 'dpo@klao.io',
  termsUrl: 'https://klao.io/terms',
  privacyUrl: 'https://klao.io/privacy'
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

const AdminCompanyProfile: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'organization' | 'address' | 'compliance'>('organization');
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
        setFormData(prev => ({
          ...prev,
          ...result.data
        }));
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
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSavedSuccessMsg(null);
    setErrorMsg(null);

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
        <button
          type="button"
          className={`klao-company-profile__tab ${activeTab === 'compliance' ? 'klao-company-profile__tab--active' : ''}`}
          onClick={() => setActiveTab('compliance')}
        >
          <ShieldCheck size={16} />
          <span>Legal & Compliance</span>
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
                  <h3 className="klao-company-profile__section-title">Headquarters & Corporate Contact</h3>
                  <p className="klao-company-profile__section-subtitle">
                    Corporate contact details and registered physical business location.
                  </p>
                </div>
              </div>

              <div className="klao-cp-grid-2">
                <div className="klao-cp-group">
                  <label className="klao-cp-label">Corporate Email</label>
                  <input
                    type="email"
                    className="klao-input"
                    value={formData.corporateEmail}
                    onChange={e => handleInputChange('corporateEmail', e.target.value)}
                    placeholder="corporate@company.com"
                  />
                </div>

                <div className="klao-cp-group">
                  <label className="klao-cp-label">Support Email</label>
                  <input
                    type="email"
                    className="klao-input"
                    value={formData.supportEmail}
                    onChange={e => handleInputChange('supportEmail', e.target.value)}
                    placeholder="support@company.com"
                  />
                </div>

                <div className="klao-cp-group">
                  <label className="klao-cp-label">Phone Number</label>
                  <input
                    type="text"
                    className="klao-input"
                    value={formData.phone}
                    onChange={e => handleInputChange('phone', e.target.value)}
                    placeholder="+66 2 123 4567"
                  />
                </div>

                <div className="klao-cp-group">
                  <label className="klao-cp-label">Fax Number</label>
                  <input
                    type="text"
                    className="klao-input"
                    value={formData.fax}
                    onChange={e => handleInputChange('fax', e.target.value)}
                    placeholder="+66 2 123 4568"
                  />
                </div>

                <div className="klao-cp-group klao-cp-full">
                  <label className="klao-cp-label">Street Address & Building</label>
                  <input
                    type="text"
                    className="klao-input"
                    value={formData.streetAddress}
                    onChange={e => handleInputChange('streetAddress', e.target.value)}
                    placeholder="123 Tech Building, 10th Floor, Main St"
                  />
                </div>

                <div className="klao-cp-group">
                  <label className="klao-cp-label">Sub-District / District</label>
                  <input
                    type="text"
                    className="klao-input"
                    value={formData.subDistrict}
                    onChange={e => handleInputChange('subDistrict', e.target.value)}
                    placeholder="Klongtoey Nua"
                  />
                </div>

                <div className="klao-cp-group">
                  <label className="klao-cp-label">City / Province</label>
                  <input
                    type="text"
                    className="klao-input"
                    value={formData.city}
                    onChange={e => handleInputChange('city', e.target.value)}
                    placeholder="Bangkok"
                  />
                </div>

                <div className="klao-cp-group">
                  <label className="klao-cp-label">Postal / Zip Code</label>
                  <input
                    type="text"
                    className="klao-input"
                    value={formData.postalCode}
                    onChange={e => handleInputChange('postalCode', e.target.value)}
                    placeholder="10110"
                  />
                </div>

                <div className="klao-cp-group">
                  <label className="klao-cp-label">Country</label>
                  <input
                    type="text"
                    className="klao-input"
                    value={formData.country}
                    onChange={e => handleInputChange('country', e.target.value)}
                    placeholder="Thailand"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Legal & Compliance */}
          {activeTab === 'compliance' && (
            <div>
              <div className="klao-company-profile__section-header">
                <div className="klao-company-profile__section-icon">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="klao-company-profile__section-title">Legal & Data Privacy Compliance</h3>
                  <p className="klao-company-profile__section-subtitle">
                    Data Protection Officer (DPO) contact details and legal terms links.
                  </p>
                </div>
              </div>

              <div className="klao-cp-grid-2">
                <div className="klao-cp-group">
                  <label className="klao-cp-label">Data Protection Officer (DPO) Name</label>
                  <input
                    type="text"
                    className="klao-input"
                    value={formData.dpoName}
                    onChange={e => handleInputChange('dpoName', e.target.value)}
                    placeholder="e.g. Jane Doe"
                  />
                </div>

                <div className="klao-cp-group">
                  <label className="klao-cp-label">DPO Contact Email</label>
                  <input
                    type="email"
                    className="klao-input"
                    value={formData.dpoEmail}
                    onChange={e => handleInputChange('dpoEmail', e.target.value)}
                    placeholder="dpo@company.com"
                  />
                </div>

                <div className="klao-cp-group">
                  <label className="klao-cp-label">Terms of Service URL</label>
                  <input
                    type="url"
                    className="klao-input"
                    value={formData.termsUrl}
                    onChange={e => handleInputChange('termsUrl', e.target.value)}
                    placeholder="https://company.com/terms"
                  />
                </div>

                <div className="klao-cp-group">
                  <label className="klao-cp-label">Privacy Policy URL</label>
                  <input
                    type="url"
                    className="klao-input"
                    value={formData.privacyUrl}
                    onChange={e => handleInputChange('privacyUrl', e.target.value)}
                    placeholder="https://company.com/privacy"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Footer Save Actions */}
          <div className="klao-cp-footer">
            <div>
              {savedSuccessMsg && (
                <div className="klao-cp-toast">
                  <CheckCircle2 size={16} />
                  <span>{savedSuccessMsg}</span>
                </div>
              )}
              {errorMsg && (
                <div className="klao-cp-toast" style={{ background: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#ef4444' }}>
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
