import { AsyncLocalStorage } from 'async_hooks';

export interface AppSession {
  user: {
    id: string;
    email: string;
    role: string;
    tenantId: string;
    teams: { teamId: string; isLeader: boolean }[];
    activeTeamId?: string;
  };
}

export interface SessionContext {
  userId: string;
  tenantId: string;
  role: string;
  email: string;
  teams: { teamId: string; isLeader: boolean }[];
  activeTeamId?: string;
}

const _sessionStore = new AsyncLocalStorage<SessionContext>();

/**
 * Reads session from the per-request AsyncLocalStorage cache.
 * Falls back to `getAppSession()` if no store is active (CLI context).
 * Engines call this to avoid redundant NextAuth JWT lookups within a request.
 */
export async function getSession(): Promise<SessionContext | null> {
  const cached = _sessionStore.getStore();
  if (cached) return cached;

  const session = await getAppSession();
  if (!session) return null;

  return toSessionContext(session);
}

/**
 * Raw session fetch from NextAuth. Retained for backward compatibility
 * (CLI scripts, optional-auth routes like config/route.ts).
 */
export async function getAppSession(): Promise<AppSession | null> {
  // Allow CLI / integration tests to inject a fake session via environment variable.
  // Never set in production — the env var is absent so this branch is never reached.
  // Imports are intentionally lazy so next-auth is NOT loaded in CLI/Docker contexts.
  if (process.env.TEST_SESSION_JSON) {
    return JSON.parse(process.env.TEST_SESSION_JSON);
  }

  try {
    const { getServerSession } = await import('next-auth/next');
    const { authOptions } = await import('@/lib/auth/authOptions');
    const session = await getServerSession(authOptions);
    return session as any as AppSession;
  } catch (error) {
    return null;
  }
}

/**
 * Require a valid session. Throws if unauthenticated or missing tenant.
 * Intended for authenticated API route handlers.
 *
 * Populates the per-request cache so subsequent calls from engine classes
 * (TransactionContext, AccessGuard, AlchemaCore, QueryLayer) read from
 * AsyncLocalStorage instead of re-verifying the JWT.
 */
export async function requireSession(): Promise<SessionContext> {
  const session = await getAppSession();
  if (!session) {
    throw new Error('Unauthorized: No active session. Please sign in.');
  }

  const ctx = toSessionContext(session);

  if (!ctx.tenantId) {
    throw new Error('Forbidden: User is not associated with any tenant.');
  }

  _sessionStore.enterWith(ctx);
  return ctx;
}

/**
 * Require an authenticated session with SUPER_ADMIN or TENANT_ADMIN role.
 * Throws otherwise.
 */
export async function requireAdmin(): Promise<SessionContext> {
  const ctx = await requireSession();
  if (ctx.role !== 'SUPER_ADMIN' && ctx.role !== 'TENANT_ADMIN') {
    throw new Error('Forbidden: Admin role required.');
  }
  return ctx;
}

function toSessionContext(session: AppSession): SessionContext {
  const user = session.user as any;
  return {
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role ?? 'MEMBER',
    email: user.email,
    teams: user.teams ?? [],
    activeTeamId: user.activeTeamId,
  };
}
