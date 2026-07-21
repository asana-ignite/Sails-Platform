import { Pool, PoolClient } from 'pg';
import { ConnectionManager } from './ConnectionManager';
import { getAppSession } from '@/lib/auth/session';

export class TransactionContext {
  /**
   * Executes a database query or set of queries within a transaction
   * injected with the current user's session variables to enforce RLS.
   */
  static async executeWithUserContext<T>(
    pool: Pool,
    callback: (client: PoolClient) => Promise<T>,
    options?: { userId?: string; tenantId?: string | null; role?: string; activeTeamId?: string }
  ): Promise<T> {
    const client = await pool.connect();
    // Hoisted so the finally block can reference it even if try throws early.
    let resolvedRole: string | undefined;

    try {
      let resolvedUserId = options?.userId;
      let resolvedTenantId = options?.tenantId;
      let resolvedActiveTeamId = options?.activeTeamId;
      resolvedRole = options?.role;

      if (!resolvedUserId) {
        const session = await getAppSession();
        if (session?.user) {
          resolvedUserId = session.user.id;
          resolvedTenantId = session.user.tenantId || resolvedTenantId;
          resolvedRole = session.user.role || resolvedRole;
          resolvedActiveTeamId = session.user.activeTeamId || resolvedActiveTeamId;
        }
      }

      await client.query('BEGIN');

      if (resolvedRole) {
        // Switch role if provided (e.g., to a non-superuser for testing RLS)
        await client.query(`SET ROLE ${resolvedRole}`);
      }

      // Inject the user context into the PostgreSQL session in a single round-trip
      const configQueries: string[] = [];
      const configValues: string[] = [];
      
      if (resolvedUserId) {
        configQueries.push(`set_config('app.current_user_id', $${configValues.length + 1}, true)`);
        configValues.push(resolvedUserId);
      }
      if (resolvedTenantId) {
        configQueries.push(`set_config('app.current_tenant_id', $${configValues.length + 1}, true)`);
        configValues.push(resolvedTenantId);
      }
      if (resolvedActiveTeamId) {
        configQueries.push(`set_config('app.current_team_id', $${configValues.length + 1}, true)`);
        configValues.push(resolvedActiveTeamId);
      }

      if (configQueries.length > 0) {
        await client.query(`SELECT ${configQueries.join(', ')}`, configValues);
      }

      // Yield execution back to the caller for actual data queries
      const result = await callback(client);

      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      // Clean up the session context before returning the client to the pool in a single round-trip
      try {
        let resetQuery = "RESET app.current_user_id; RESET app.current_tenant_id; RESET app.current_team_id;";
        if (options?.role || resolvedRole) {
          resetQuery += " RESET ROLE;";
        }
        await client.query(resetQuery);
      } catch (e) {}
      client.release();
    }
  }
}
