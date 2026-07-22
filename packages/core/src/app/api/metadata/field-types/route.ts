import { NextRequest, NextResponse } from 'next/server';
import { FieldRegistry } from '@/core/registry/FieldRegistry';
import { FieldTypeMetadata } from '@klao/shared';

export async function GET(req: NextRequest) {
  try {
    const registry = FieldRegistry.getInstance();
    const plugins = registry.getAllPlugins();

    const fieldTypesMetadata: FieldTypeMetadata[] = plugins.map(plugin => ({
      type: plugin.type,
      label: plugin.label || plugin.type.replace('_', ' ').toUpperCase(),
      description: plugin.description || '',
      iconName: plugin.iconName || 'Type',
      physicalType: plugin.physicalType || 'text',
      parametersSchema: plugin.parametersSchema || []
    }));

    return NextResponse.json(fieldTypesMetadata);
  } catch (error: any) {
    console.error('Error fetching field types metadata:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch field types' },
      { status: 500 }
    );
  }
}
