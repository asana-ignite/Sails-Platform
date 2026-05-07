import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { translator } from '@/lib/services';

export async function POST(req: NextRequest) {
  try {
    const { name, tableName, description } = await req.json();

    // 1. Get the first tenant for now (simulating multi-tenancy)
    let tenant = await db.tenant.findFirst();

    if (!tenant) {
      // Create a default tenant if none exists
      // @ts-ignore - This logic is legacy and needs refactoring to use TenantProvisioner
      tenant = await translator.createTable('Default Tenant', 'tenant_default');
    }

    // 2. Create the table via the translator (handles DDL and Metadata)
    const table = await translator.createTable(
      tenant.id,
      name,
      tableName,
      description
    );

    return NextResponse.json(table, { status: 201 });
  } catch (error: any) {
    console.error('Error creating table metadata:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create table' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const tables = await db.tableDefinition.findMany({
      include: {
        _count: {
          select: { fields: true }
        }
      }
    });
    return NextResponse.json(tables);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch tables' },
      { status: 500 }
    );
  }
}
