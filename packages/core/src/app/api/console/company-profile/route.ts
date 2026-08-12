/**
 * Tenant company profile (branding, legal, address) read/update.
 */
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSession } from '@/lib/auth/session';

const PROFILE_FIELDS = [
  'legalName', 'tradingName', 'taxId', 'industry', 'companySize', 'websiteUrl',
  'businessContactName', 'corporateEmail', 'businessContactPhone',
  'supportContactName', 'supportEmail', 'supportPhone', 'phone', 'fax',
  'streetAddress', 'subDistrict', 'city', 'postalCode', 'country',
  'dpoName', 'dpoEmail', 'termsUrl', 'privacyUrl',
  'baseCurrency', 'fiscalYearStartMonth', 'timezone', 'dateFormat', 'timeFormat',
  'loginTagline', 'allowSelfRegistration', 'allowedEmailDomains', 'defaultUserRole',
  'defaultLandingPage', 'inactivityTimeoutMinutes', 'maxFileUploadMb',
  'maintenanceMode', 'announcementBannerText', 'announcementType',
] as const;

function pickProfileFields(body: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of PROFILE_FIELDS) {
    if (key in body) result[key] = body[key];
  }
  return result;
}

export async function GET() {
  try {
    const { tenantId } = await requireSession();

    const profile = await db.companyProfile.findUnique({
      where: { tenantId }
    });

    if (!profile) {
      const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
      return NextResponse.json({
        success: true,
        data: {
          legalName: tenant?.name || '',
          tradingName: tenant?.name || '',
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
          privacyUrl: '',
          themeConfig: null
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        ...profile,
        businessContactPhone: profile.businessContactPhone || profile.phone || '',
        supportPhone: profile.supportPhone || profile.fax || ''
      }
    });
  } catch (error: any) {
    console.error('[API COMPANY PROFILE GET]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { tenantId } = await requireSession();

    const body = await req.json();

    const {
      id,
      tenantId: _t,
      createdAt,
      updatedAt,
      themeConfig,
      ...rest
    } = body;

    const profileData = pickProfileFields(rest);
    const payload: Record<string, any> = {
      ...profileData,
      supportPhone: profileData.supportPhone || rest.fax || null,
    };

    if (themeConfig !== undefined) {
      payload.themeConfig = typeof themeConfig === 'string' ? JSON.parse(themeConfig) : themeConfig;
    }

    const upserted = await db.companyProfile.upsert({
      where: { tenantId },
      create: {
        tenantId,
        ...payload
      },
      update: payload
    });

    return NextResponse.json({ success: true, data: upserted });
  } catch (error: any) {
    console.error('[API COMPANY PROFILE PUT]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
