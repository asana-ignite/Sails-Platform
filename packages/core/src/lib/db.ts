// Purpose: Instantiates the Prisma Client.
// Used EXCLUSIVELY for querying the static metadata tables (tenants, objects, fields, etc.)
// Ensures a single connection pool is used across the Next.js application.

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// At 10k OPS, enforce PgBouncer and connection pooling limits in production
let datasourceUrl = process.env.DATABASE_URL;
if (process.env.NODE_ENV === 'production' && datasourceUrl && !datasourceUrl.includes('pgbouncer=true')) {
  const separator = datasourceUrl.includes('?') ? '&' : '?';
  datasourceUrl = `${datasourceUrl}${separator}pgbouncer=true&connection_limit=20`;
}

export const db = globalForPrisma.prisma ?? new PrismaClient({
  datasourceUrl
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
