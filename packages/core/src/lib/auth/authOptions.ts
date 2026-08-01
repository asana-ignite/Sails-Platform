import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import GoogleProvider from "next-auth/providers/google";

const jwtCache = new Map<string, { data: any; expiresAt: number }>();
const JWT_CACHE_TTL = 60000;

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db) as any,
  session: {
    strategy: "jwt",
  },
  providers: [
    CredentialsProvider({
      name: "SAILS Identity",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "jsmith@example.com" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Missing email or password");
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email },
          include: { teams: true }
        });

        if (!user) {
          throw new Error("No user found with this email");
        }

        if (!user.password) {
          throw new Error("Please sign in with your external provider (e.g., Google or Microsoft)");
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);

        if (!isValid) {
          throw new Error("Invalid password");
        }

        return user as any;
      }
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      // 1. Common: Update last login timestamp for any provider
      // Use findUnique first to avoid Prisma error on non-existent records (for JIT flow)
      if (user.email) {
        const dbUser = await db.user.findUnique({ where: { email: user.email } });
        if (dbUser) {
          await db.user.update({
            where: { email: user.email },
            data: { lastLoginAt: new Date() },
          });
        }
      }

      if (account?.provider === "google") {
        const email = user.email;
        if (!email) return false;

        // 2. Domain Restriction
        const domain = email.split("@")[1];
        const allowedDomains = ["igniteidea.ai", "ignite-idea.com"];

        if (!allowedDomains.includes(domain)) {
          return false;
        }

        // 3. JIT Provisioning & Identity Synchronization
        const existingUser = await db.user.findUnique({
          where: { email },
        });

        const defaultTenant = await db.tenant.findFirst();

        if (existingUser) {
          // If user exists, check if they are enabled
          if (!existingUser.isActive) {
            console.log(`Access denied for inactive user: ${email}`);
            return false;
          }

          // Sync Google-specific fields if they are missing or need updating
          await db.user.update({
            where: { email },
            data: {
              googleId: (profile as any).sub,
              googleDomain: domain,
              emailVerified: new Date(), // Google emails are verified
              tenantId: existingUser.tenantId || defaultTenant?.id, // Ensure tenant is assigned
            },
          });
        } else {
          // If new user, create the record (JIT)
          await db.user.create({
            data: {
              email,
              name: user.name,
              image: user.image,
              role: "MEMBER",
              isActive: true,
              googleId: (profile as any).sub,
              googleDomain: domain,
              emailVerified: new Date(),
              tenantId: defaultTenant?.id, // Assign to default tenant
              metadata: {},
            },
          });
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.tenantId = (user as any).tenantId;
        token.role = (user as any).role;
        token.teams = (user as any).teams?.map((ut: any) => ({
          teamId: ut.teamId,
          isLeader: ut.isLeader
        }));
        jwtCache.delete(token.id as string);
      } else if (token.id) {
        const cached = jwtCache.get(token.id as string);
        if (cached && cached.expiresAt > Date.now()) {
          Object.assign(token, cached.data);
        } else {
          const dbUser = await db.user.findUnique({
            where: { id: token.id as string },
            include: { teams: true }
          });
          if (dbUser) {
            token.tenantId = dbUser.tenantId;
            token.role = dbUser.role;
            token.teams = dbUser.teams?.map((ut: any) => ({
              teamId: ut.teamId,
              isLeader: ut.isLeader
            }));
            jwtCache.set(token.id as string, {
              data: { tenantId: token.tenantId, role: token.role, teams: token.teams },
              expiresAt: Date.now() + JWT_CACHE_TTL
            });
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id = token.id;
        (session.user as any).tenantId = token.tenantId;
        (session.user as any).role = token.role;
        (session.user as any).teams = token.teams;
      }
      return session;
    },
  },
};
