/**
 * SAILS Platform — Zone Health & Telemetry Endpoint
 * `GET /api/zone/health`
 * 
 * Exposes live health metrics (CPU, Memory, DB Connection Pools, Active Tenants)
 * to the Global Control Plane & Super Admin War Room.
 */

import { NextResponse } from 'next/server';
import { tenantConnectionManager } from '@/lib/TenantConnectionManager';
import { db } from '@/lib/db';
import type { ZoneTelemetryPayload, ZoneHealthStatus } from '@sails/shared';

export async function GET(request: Request) {
  try {
    // 1. Authenticate War Room telemetry request
    const authHeader = request.headers.get('x-zone-secret');
    const expectedSecret = process.env.ZONE_SECRET_KEY;

    if (expectedSecret && authHeader !== expectedSecret) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid X-Zone-Secret header' },
        { status: 401 }
      );
    }

    // 2. Measure Memory Usage
    const memory = process.memoryUsage();
    const memoryUsageMB = Math.round(memory.heapUsed / 1024 / 1024);

    // 3. Measure Database Connection Health & Active Tenants
    let tenantCount = 0;
    let dbStatus: 'ok' | 'error' = 'ok';

    try {
      tenantCount = await db.tenant.count();
    } catch (err) {
      dbStatus = 'error';
      console.error('[ZoneHealth] Database query failed:', err);
    }

    // 4. Derive Zone Status
    let status: ZoneHealthStatus = 'healthy';
    if (dbStatus === 'error') {
      status = 'critical';
    } else if (memoryUsageMB > 1024) {
      status = 'degraded';
    }

    // 5. Construct Telemetry Payload
    const poolMetrics = tenantConnectionManager.getMetrics();
    const payload: ZoneTelemetryPayload = {
      zoneId: poolMetrics.zoneId,
      status,
      memoryUsageMB,
      activeDbConnections: poolMetrics.activePoolsCount,
      tenantCount,
      errorCount15m: 0,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (error: any) {
    console.error('[ZoneHealth] Telemetry endpoint error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
