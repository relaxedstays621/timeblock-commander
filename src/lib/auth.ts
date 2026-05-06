import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/db';

const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
].join(' ');

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      authorization: {
        params: {
          scope: GOOGLE_SCOPES,
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
  ],
  session: {
    strategy: 'database',
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
};

/**
 * Returns the current user for the request.
 *
 * Resolution order:
 *   1. NextAuth session (if signed in) — looked up by id
 *   2. (dev only) Hardcoded seed user `owner@timeblock.local`, behind
 *      `ALLOW_DEV_USER_FALLBACK=1` and `NODE_ENV !== 'production'`.
 *
 * Returns null for unauthenticated callers in production so route handlers
 * can reject them cleanly.
 *
 * Optionally includes related data (preferences) when `opts.includePreferences` is true.
 */
export async function getCurrentUser(opts?: { includePreferences?: boolean }) {
  const include = opts?.includePreferences ? { preferences: true } : undefined;

  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include,
    });
    if (user) return user;
  }

  if (
    process.env.NODE_ENV !== 'production' &&
    process.env.ALLOW_DEV_USER_FALLBACK === '1'
  ) {
    return prisma.user.findFirst({
      where: { email: 'owner@timeblock.local' },
      include,
    });
  }

  return null;
}
