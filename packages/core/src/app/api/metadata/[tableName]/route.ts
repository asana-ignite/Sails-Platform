/**
 * Metadata for one dynamic table (fields + rules), used by detail pages.
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: { tableName: string } }
) {
  try {
    const { tableName } = params;

    const table = await db.tableDefinition.findFirst({
      where: { tableName: tableName },
      include: {
        fields: {
            include: {
                rules: true
            }
        },
        rules: true
      },
    });

    if (!table) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 });
    }

    return NextResponse.json(table);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch table schema' },
      { status: 500 }
    );
  }
}
