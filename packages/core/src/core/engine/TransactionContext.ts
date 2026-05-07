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

      // Inject the user context into the PostgreSQL session
      if (resolvedUserId) {
        await client.query('SELECT set_config($1, $2, true)', ['app.current_user_id', resolvedUserId]);
      }

      if (resolvedTenantId) {
        await client.query('SELECT set_config($1, $2, true)', ['app.current_tenant_id', resolvedTenantId]);
      }

      if (resolvedActiveTeamId) {
        await client.query('SELECT set_config($1, $2, true)', ['app.current_team_id', resolvedActiveTeamId]);
      }

      // Yield execution back to the caller for actual data queries
      const result = await callback(client);

      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      // Clean up the session context before returning the client to the pool
      try { await client.query("RESET app.current_user_id"); } catch (e) {}
      try { await client.query("RESET app.current_tenant_id"); } catch (e) {}
      try { await client.query("RESET app.current_team_id"); } catch (e) {}
      if (options?.role || resolvedRole) {
        try { await client.query('RESET ROLE'); } catch (e) {}
      }
      client.release();
    }
  }
}
