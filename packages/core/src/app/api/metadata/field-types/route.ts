/**
 * Field-type registry endpoint (labels/physical types for the schema UI).
 */
import { NextResponse } from 'next/server';
import { FIELD_TYPE_REGISTRY } from '@sails/shared';

export async function GET() {
  try {
    return NextResponse.json(FIELD_TYPE_REGISTRY);
  } catch (error: any) {
    console.error('Error fetching field types metadata:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch field types' },
      { status: 500 }
    );
  }
}
