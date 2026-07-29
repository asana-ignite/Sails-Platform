/**
 * SAILS Platform — Tenant Connection Manager
 * 
 * Manages database connection pools for Cell-Based Zoning Multi-Tenancy.
 * In `standalone` mode (default), uses the unified static process.env.DATABASE_URL pool.
 * In `zoned` mode, dynamically borrows and caches connection pools per tenant/DSN.
 */

import { Pool } from 'pg';

interface PoolEntry {
  pool: Pool;
  lastUsedAt: number;
}

class TenantConnectionManager {
  private pools: Map<string, PoolEntry> = new Map();
  private defaultPool: Pool | null = null;
  private idleCheckInterval: ReturnType<typeof setInterval> | null = null;
  private readonly idleTimeoutMs = 5 * 60 * 1000; // 5 minutes idle timeout

  constructor() {
    // Periodically clean up idle tenant pools in zoned mode
    if (typeof setInterval !== 'undefined') {
      this.idleCheckInterval = setInterval(() => this.cleanupIdlePools(), 60 * 1000);
    }
  }

  /**
   * Returns whether the API container is running in zoned multi-database mode.
   */
  public isZonedMode(): boolean {
    return process.env.PLATFORM_MODE === 'zoned';
  }

  /**
   * Gets the current Zone ID (defaults to 'zone-01').
   */
  public getZoneId(): string {
    return process.env.ZONE_ID || 'zone-01';
  }

  /**
   * Gets the default connection pool for the baseline core database.
   */
  public getDefaultPool(): Pool {
    if (!this.defaultPool) {
      this.defaultPool = new Pool({
        connectionString: process.env.DATABASE_URL || 'postgresql://postgres:mysecretpassword@db:5432/postgres?schema=core',
        max: 20,
        idleTimeoutMillis: 30000,
      });
    }
    return this.defaultPool;
  }

  /**
   * Gets or creates a database connection pool for a specific tenant DSN.
   * If in `standalone` mode or no custom DSN provided, returns the default pool.
   */
  public getTenantPool(tenantId: string, connectionString?: string): Pool {
    if (!this.isZonedMode() || !connectionString) {
      return this.getDefaultPool();
    }

    const key = `${tenantId}:${connectionString}`;
    const existing = this.pools.get(key);

    if (existing) {
      existing.lastUsedAt = Date.now();
      return existing.pool;
    }

    const pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
    });

    this.pools.set(key, { pool, lastUsedAt: Date.now() });
    return pool;
  }

  /**
   * Recycle pools that have been idle past the timeout limit.
   */
  private cleanupIdlePools(): void {
    const now = Date.now();
    for (const [key, entry] of this.pools.entries()) {
      if (now - entry.lastUsedAt > this.idleTimeoutMs) {
        entry.pool.end().catch((err) => {
          console.error(`[ConnectionManager] Error closing idle pool ${key}:`, err);
        });
        this.pools.delete(key);
      }
    }
  }

  /**
   * Returns active connection pool metrics for telemetry.
   */
  public getMetrics() {
    return {
      activePoolsCount: this.pools.size + (this.defaultPool ? 1 : 0),
      isZonedMode: this.isZonedMode(),
      zoneId: this.getZoneId(),
    };
  }

  /**
   * Graceful shutdown of all connection pools.
   */
  public async closeAll(): Promise<void> {
    if (this.idleCheckInterval) clearInterval(this.idleCheckInterval);
    for (const entry of this.pools.values()) {
      await entry.pool.end();
    }
    this.pools.clear();
    if (this.defaultPool) {
      await this.defaultPool.end();
      this.defaultPool = null;
    }
  }
}

export const tenantConnectionManager = new TenantConnectionManager();
