import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAppSession } from '@/lib/auth/session';

/**
 * Helper to resolve active tenant context
 */
async function resolveTenantId() {
  const session = await getAppSession();
  return (session?.user as any)?.tenantId || process.env.DEFAULT_TENANT_ID;
}

/**
 * GET /api/console/company-profile
 * Fetches company profile details for the active tenant.
 */
export async function GET() {
  try {
    const tenantId = await resolveTenantId();
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant context required' }, { status: 400 });
    }

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
          branding: null
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

/**
 * PUT /api/console/company-profile
 * Upserts (creates or updates) company profile details for the active tenant.
 */
export async function PUT(req: Request) {
  try {
    const tenantId = await resolveTenantId();
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant context required' }, { status: 400 });
    }

    const body = await req.json();

    // Whitelist payload fields to avoid manual duplication between create/update
    const {
      id,
      tenantId: _t,
      createdAt,
      updatedAt,
      branding,
      ...profileData
    } = body;

    const payload: Record<string, any> = {
      ...profileData,
      supportPhone: profileData.supportPhone || profileData.fax || null
    };

    if (branding !== undefined) {
      payload.branding = typeof branding === 'string' ? JSON.parse(branding) : branding;
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
