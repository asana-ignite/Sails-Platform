/**
 * NextAuth v4 configuration — credentials (email/password) + Google/Microsoft
 * providers with a Prisma adapter. The session carries userId, tenantId, role
 * and teams; every API route reads it via requireSession/requireAdmin.
 */
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
