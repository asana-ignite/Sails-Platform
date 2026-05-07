/**
 * ConnectionManager
 * 
 * A centralized abstraction for resolving database connections.
 * All services (AlchemaCore, QueryLayer, TenantProvisioner) MUST use this
 * instead of holding raw Pool references, to allow seamless future migration
 * from schema-per-tenant to database-per-tenant without rewriting business logic.
 * 
 * Current Strategy: SCHEMA_PER_TENANT
 *   - All tenants share a single PostgreSQL database.
 *   - Each tenant gets an isolated schema (e.g., tenant_acme).
 *   - The `core` schema holds metadata, auth, and audit tables.
 * 
 * Future Strategy: DATABASE_PER_TENANT
 *   - Each tenant gets a completely separate PostgreSQL database.
 *   - The ConnectionManager would maintain a pool-per-database cache.
 *   - Only the internals of this class need to change; no consumer changes required.
 */

import { Pool } from 'pg';

export type IsolationStrategy = 'SCHEMA_PER_TENANT' | 'DATABASE_PER_TENANT';

export class ConnectionManager {
  private static instance: ConnectionManager;

  private corePool: Pool;
  private tenantPools: Map<string, Pool> = new Map();
  private strategy: IsolationStrategy;

  private constructor(corePool: Pool, strategy: IsolationStrategy = 'SCHEMA_PER_TENANT') {
    this.corePool = corePool;
    this.strategy = strategy;
  }

  /**
   * Initializes the singleton ConnectionManager.
   * Call this once at application startup.
   */
  static initialize(corePool: Pool, strategy: IsolationStrategy = 'SCHEMA_PER_TENANT'): ConnectionManager {
    ConnectionManager.instance = new ConnectionManager(corePool, strategy);
    return ConnectionManager.instance;
  }

  /**
   * Returns the singleton instance. Throws if not initialized.
   */
  static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      throw new Error('ConnectionManager has not been initialized. Call ConnectionManager.initialize() first.');
    }
    return ConnectionManager.instance;
  }

  /**
   * Resets the singleton (useful for tests).
   */
  static reset(): void {
    ConnectionManager.instance = undefined as any;
  }

  /**
   * Returns the current isolation strategy.
   */
  getStrategy(): IsolationStrategy {
    return this.strategy;
  }

  /**
   * Returns the connection pool for the core metadata schema.
   * This is always the main database pool.
   */
  getCorePool(): Pool {
    return this.corePool;
  }

  /**
   * Returns the appropriate connection pool for a tenant's data.
   * 
   * SCHEMA_PER_TENANT: Returns the same core pool (tenants share one DB).
   * DATABASE_PER_TENANT: Would return a dedicated pool for the tenant's database.
   */
  getTenantPool(schemaName: string): Pool {
    if (this.strategy === 'SCHEMA_PER_TENANT') {
      // All tenants share the same database — return the core pool
      return this.corePool;
    }

    // DATABASE_PER_TENANT: Look up or create a dedicated pool
    // This is the future expansion point.
    let tenantPool = this.tenantPools.get(schemaName);
    if (!tenantPool) {
      // Future: resolve the connection string for this tenant's database
      // e.g., from a config table or environment-based mapping.
      throw new Error(
        `DATABASE_PER_TENANT is not yet fully implemented. ` +
        `No pool registered for tenant schema: ${schemaName}`
      );
    }
    return tenantPool;
  }

  /**
   * Registers a dedicated pool for a specific tenant (used in DATABASE_PER_TENANT mode).
   * Future use only.
   */
  registerTenantPool(schemaName: string, pool: Pool): void {
    this.tenantPools.set(schemaName, pool);
  }

  /**
   * Gracefully shuts down all pools.
   */
  async shutdown(): Promise<void> {
    await this.corePool.end();
    for (const [, pool] of Array.from(this.tenantPools)) {
      await pool.end();
    }
    this.tenantPools.clear();
  }
}
