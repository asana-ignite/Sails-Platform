/**
 * Related records for Related-List blocks: rows of a child model whose FK
 * points at the parent record, using the configured child LIST view.
 */
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/knex';
import { db } from '@/lib/db';
import { QueryLayer } from '@/core/engine/QueryLayer';
import { preprocessFilterGroups } from '@/core/engine/filterPreprocess';
import { resolveTable } from '@/lib/dynamicTable';
import { requireSession } from '@/lib/auth/session';
import { serializeFilterGroups, normalizeFilters, LayoutSort, LayoutColumn } from '@sails/shared';

type RouteContext = { params: { tableName: string } };

/**
 * GET /api/dynamic/[tableName]/related?field=<fkFieldName>&parentId=<recordId>&viewId=<layoutId>
 *
 * Returns records of this model whose FK column `field` equals `parentId` (i.e. the
 * related records pointing at the currently open parent record). When `viewId` is
 * provided, the LIST layout's columns, filters, and sort are applied server-side.
 *
 * Runs inside QueryLayer.listRecords → executeSecureQuery, so AccessGuard and RLS
 * apply exactly as they do for normal record lists.
 */
export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const { tableName } = params;
    const { searchParams } = req.nextUrl;

    const fieldName = searchParams.get('field') || '';
    const parentId = searchParams.get('parentId') || '';
    const viewId = searchParams.get('viewId');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25')));

    // Runtime (session) filters/sort from the rendering engine — merged with the view's own.
    let runtimeFilters: Record<string, string> | undefined;
    let runtimeSort: { fieldId: string; dir: 'asc' | 'desc' }[] | undefined;
    const filtersRaw = searchParams.get('filters');
    const sortRaw = searchParams.get('sort');
    if (filtersRaw) {
      try {
        const parsed = JSON.parse(filtersRaw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) runtimeFilters = parsed;
      } catch { /* ignore malformed JSON */ }
    }
    if (sortRaw) {
      try {
        const parsed = JSON.parse(sortRaw);
        if (Array.isArray(parsed)) runtimeSort = parsed;
      } catch { /* ignore malformed JSON */ }
    }

    if (!fieldName || !parentId) {
      return NextResponse.json(
        { error: 'field and parentId query parameters are required.' },
        { status: 400 }
      );
    }

    const resolved = await resolveTable(tableName);
    if (!resolved) {
      return NextResponse.json({ error: 'Table not found or access denied.' }, { status: 404 });
    }

    const tableFields = (resolved.table?.fields || []) as any[];
    const fkField = tableFields.find((f: any) => f.fieldName === fieldName);
    const isRelation = fkField?.logicalType === 'relation' || fkField?.logicalType === 'lookup';
    if (!isRelation) {
      return NextResponse.json(
        { error: `"${fieldName}" is not a relation field of this model.` },
        { status: 400 }
      );
    }

    const validFields = new Set<string>(tableFields.map((f: any) => f.fieldName));
    const textTypes = new Set(['text', 'varchar', 'string', 'char', 'email', 'phone', 'url', 'description']);
    const textFields = tableFields
      .filter((f: any) => textTypes.has(String(f.type || f.physicalType || '').toLowerCase()))
      .map((f: any) => f.fieldName);
    const jsonbFields = new Set<string>(
      tableFields
        .filter((f: any) => (f.physicalType || '').toLowerCase() === 'jsonb')
        .map((f: any) => f.fieldName)
    );

    const idToName = new Map(tableFields.map((f: any) => [f.id, f.fieldName]));
    const resolveName = (fieldId: string) => idToName.get(fieldId) || null;

    let columns: LayoutColumn[] | undefined;
    let filterGroups: { groupLogic: 'and' | 'or'; rules: any[] }[] | undefined;
    let sort: { fieldId: string; dir: 'asc' | 'desc' }[] | undefined;

    if (viewId) {
      const session = await requireSession();
      const layout = await db.tableLayout.findFirst({
        where: {
          OR: [{ id: viewId }, { systemName: viewId }],
          tableId: resolved.table.id,
          viewType: 'LIST',
        },
      });
      if (!layout) {
        return NextResponse.json({ error: 'List view not found for this model.' }, { status: 404 });
      }

      const cfg = layout.status === 'active' && layout.publishedConfig ? layout.publishedConfig : layout.config;
      const anyCfg = (cfg || {}) as any;

      columns = Array.isArray(anyCfg.columns)
        ? (anyCfg.columns as LayoutColumn[]).filter((c: any) => c.visible !== false)
        : undefined;

      const rawFilters = anyCfg.filters;
      if (Array.isArray(rawFilters) && rawFilters.length > 0) {
        const groups = normalizeFilters(rawFilters);
        if (groups.length > 0) {
          const serialized = serializeFilterGroups(groups, resolveName);
          if (serialized.length > 0) {
            // Resolve drill chains and session context macros (@me, @today, …).
            await preprocessFilterGroups({
              session,
              tableName,
              tableFields,
              filterGroups: serialized,
            });
            filterGroups = serialized;
          }
        }
      }

      if (Array.isArray(anyCfg.sortBy)) {
        const merged: { fieldId: string; dir: 'asc' | 'desc' }[] = [];
        for (const s of anyCfg.sortBy as LayoutSort[]) {
          const name = resolveName(s.fieldId || (s as any).id || '');
          if (name) merged.push({ fieldId: name, dir: (s as any).direction === 'desc' ? 'desc' : 'asc' });
        }
        if (merged.length > 0) sort = merged;
      }
    }

    const result = await QueryLayer.listRecords(pool, resolved.schemaName, tableName, {
      filters: { ...(runtimeFilters || {}), [fieldName]: parentId },
      filterGroups,
      sort: [...(sort || []), ...(runtimeSort || [])],
      page,
      limit,
      validFields,
      textFields,
      jsonbFields,
    });

    return NextResponse.json(
      { ...result, columns, fields: tableFields },
      { status: 200 }
    );
  } catch (error: any) {
    const status = error.message?.startsWith('Unauthorized') || error.message?.startsWith('Forbidden') ? 403 : 500;
    return NextResponse.json({ error: error.message || 'Failed to fetch related records.' }, { status });
  }
}
