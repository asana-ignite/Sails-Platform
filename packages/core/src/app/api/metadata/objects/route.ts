/**
 * Table (data model) CRUD: create (schema + metadata + system fields),
 * list with fields, for the Object Manager.
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTranslator } from '@/lib/services';
import { requireAdmin } from '@/lib/auth/session';
import { SchemaLogger } from '@/core/engine/SchemaLogger';

export async function POST(req: NextRequest) {
  try {
    const { userId, tenantId } = await requireAdmin();

    const { name, tableName, description, nameI18n, descriptionI18n } = await req.json();

    // Create the table via the translator (handles DDL and Metadata)
    const table = await getTranslator().createTable(
      tenantId,
      name,
      tableName,
      description,
      false,
      nameI18n,
      descriptionI18n
    );

    // Log Logical Metadata Event
    SchemaLogger.logSystemEvent({
      tenantId: tenantId,
      userId: userId,
      category: 'METADATA',
      action: 'CREATE',
      eventName: 'Create Table Definition',
      details: { id: table.id, name, tableName, description }
    });

    return NextResponse.json(table, { status: 201 });
  } catch (error: any) {
    console.error('Error creating table metadata:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create table' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await requireAdmin();

    const tables = await db.tableDefinition.findMany({
      where: {
        tenantId
      },
      include: {
        tenant: true,
        fields: true,
        _count: {
          select: { fields: true }
        }
      }
    });
    return NextResponse.json(tables);
  } catch (error: any) {
    console.error('Error fetching tables:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tables' },
      { status: 500 }
    );
  }
}
