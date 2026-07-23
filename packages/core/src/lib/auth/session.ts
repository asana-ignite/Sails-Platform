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
    // Fails gracefully in non-Next.js environments (like CLI)
    return null;
  }
}
