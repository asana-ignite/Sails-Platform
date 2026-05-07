// Purpose: Instantiates the Prisma Client.
// Used EXCLUSIVELY for querying the static metadata tables (tenants, objects, fields, etc.)
// Ensures a single connection pool is used across the Next.js application.

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
