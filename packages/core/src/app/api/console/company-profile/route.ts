import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAppSession } from '@/lib/auth/session';

/**
 * GET /api/console/company-profile
 * Fetches company profile details for the active tenant.
 */
export async function GET() {
  try {
    const session = await getAppSession();
    const tenantId = (session?.user as any)?.tenantId || process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant context required' }, { status: 400 });
    }

    let profile = await db.companyProfile.findUnique({
      where: { tenantId }
    });

    if (!profile) {
      // Fallback: fetch tenant name as legal name default
      const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
      return NextResponse.json({
        success: true,
        data: {
          legalName: tenant?.name || 'Klao Enterprise',
          tradingName: tenant?.name || 'Klao Platform',
          taxId: '',
          industry: 'Software & Technology',
          companySize: '51-200',
          websiteUrl: '',
          corporateEmail: '',
          supportEmail: '',
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
        }
      });
    }

    return NextResponse.json({ success: true, data: profile });
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
    const session = await getAppSession();
    const tenantId = (session?.user as any)?.tenantId || process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant context required' }, { status: 400 });
    }

    const body = await req.json();

    const upserted = await db.companyProfile.upsert({
      where: { tenantId },
      create: {
        tenantId,
        legalName: body.legalName,
        tradingName: body.tradingName,
        taxId: body.taxId,
        industry: body.industry,
        companySize: body.companySize,
        websiteUrl: body.websiteUrl,
        corporateEmail: body.corporateEmail,
        supportEmail: body.supportEmail,
        phone: body.phone,
        fax: body.fax,
        streetAddress: body.streetAddress,
        subDistrict: body.subDistrict,
        city: body.city,
        postalCode: body.postalCode,
        country: body.country,
        dpoName: body.dpoName,
        dpoEmail: body.dpoEmail,
        termsUrl: body.termsUrl,
        privacyUrl: body.privacyUrl
      },
      update: {
        legalName: body.legalName,
        tradingName: body.tradingName,
        taxId: body.taxId,
        industry: body.industry,
        companySize: body.companySize,
        websiteUrl: body.websiteUrl,
        corporateEmail: body.corporateEmail,
        supportEmail: body.supportEmail,
        phone: body.phone,
        fax: body.fax,
        streetAddress: body.streetAddress,
        subDistrict: body.subDistrict,
        city: body.city,
        postalCode: body.postalCode,
        country: body.country,
        dpoName: body.dpoName,
        dpoEmail: body.dpoEmail,
        termsUrl: body.termsUrl,
        privacyUrl: body.privacyUrl
      }
    });

    return NextResponse.json({ success: true, data: upserted });
  } catch (error: any) {
    console.error('[API COMPANY PROFILE PUT]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
