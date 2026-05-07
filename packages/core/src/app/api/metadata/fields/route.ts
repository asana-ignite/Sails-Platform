import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { translator } from '@/lib/services';

export async function POST(req: NextRequest) {
  try {
    const { 
        tableId, 
        name, 
        fieldName, 
        physicalType, 
        logicalType, 
        config, 
        isRequired 
    } = await req.json();

    // 1. Add the field via the translator (handles DDL and Metadata)
    const field = await translator.addFieldDef(
        tableId,
        name,
        fieldName,
        physicalType,
        logicalType,
        config,
        isRequired
    );

    return NextResponse.json(field, { status: 201 });
  } catch (error: any) {
    console.error('Error creating field metadata:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create field' },
      { status: 500 }
    );
  }
}
