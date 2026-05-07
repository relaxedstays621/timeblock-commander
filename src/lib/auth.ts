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
    /**
     * Persist refreshed OAuth tokens on every sign-in.
     *
     * NextAuth v4's PrismaAdapter only writes Account tokens via
     * `linkAccount`, which fires on *first* link. On a subsequent sign-in
     * for an already-linked (provider, providerAccountId) pair, the fresh
     * `access_token` / `refresh_token` / `expires_at` returned by Google
     * are silently discarded — leaving us with the (now-dead) tokens from
     * the original consent. That's how `invalid_grant` errors persist
     * across re-auths without anything visibly broken in the sign-in UX.
     *
     * We close the gap here: when the OAuth response carries token
     * material, upsert it into the Account row keyed by the compound
     * unique `(provider, providerAccountId)`. Refresh tokens are only
     * overwritten when the new payload supplies one — Google omits the
     * RT on subsequent flows that don't go through `prompt=consent`, and
     * we don't want to clobber a still-valid stored RT in that case.
     *
     * Returns `true` unconditionally so this never blocks sign-in; the
     * callback's job is the side-effect, not access control.
     */
    async signIn({ account }) {
      if (account?.provider && account.providerAccountId) {
        const data: Record<string, unknown> = {};
        if (account.access_token) data.access_token = account.access_token;
        if (account.refresh_token) data.refresh_token = account.refresh_token;
        if (account.expires_at) data.expires_at = account.expires_at;
        if (account.id_token) data.id_token = account.id_token;
        if (account.scope) data.scope = account.scope;
        if (account.token_type) data.token_type = account.token_type;

        if (Object.keys(data).length > 0) {
          try {
            await prisma.account.update({
              where: {
                provider_providerAccountId: {
                  provider: account.provider,
                  providerAccountId: account.providerAccountId,
                },
              },
              data,
            });
          } catch (e) {
            // First-link race or other transient DB error — don't block
            // sign-in; PrismaAdapter's linkAccount will still write the
            // initial row from the same OAuth response on first link.
            console.error('[auth] account token upsert failed:', e);
          }
        }
      }
      return true;
    },
  },
};

// ─────────────────────────────────────────────────────────
// AUTH RESOLUTION (no DB load)
// ─────────────────────────────────────────────────────────

/**
 * Returns the user id from the current NextAuth session, or null if there
 * is no signed-in user. Does NOT consult the dev fallback and does NOT load
 * the user row — that's deliberate, so callers that only need an id (e.g. to
 * scope a query) don't pay for an extra round-trip and the fallback stays
 * out of the auth path.
 */
export async function getSessionUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

// ─────────────────────────────────────────────────────────
// USER LOAD (no auth fallback)
// ─────────────────────────────────────────────────────────

type LoadUserOptions = { includePreferences?: boolean };

/**
 * Loads a user row by id. No fallback, no auth resolution — just a DB read.
 */
export async function loadUser(userId: string, opts?: LoadUserOptions) {
  const include = opts?.includePreferences ? { preferences: true } : undefined;
  return prisma.user.findUnique({ where: { id: userId }, include });
}

// ─────────────────────────────────────────────────────────
// COMPOSITE ENTRYPOINT (auth + load + dev fallback)
// ─────────────────────────────────────────────────────────

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
export async function getCurrentUser(opts?: LoadUserOptions) {
  const userId = await getSessionUserId();
  if (userId) {
    const user = await loadUser(userId, opts);
    if (user) return user;
  }

  if (
    process.env.NODE_ENV !== 'production' &&
    process.env.ALLOW_DEV_USER_FALLBACK === '1'
  ) {
    const include = opts?.includePreferences ? { preferences: true } : undefined;
    return prisma.user.findFirst({
      where: { email: 'owner@timeblock.local' },
      include,
    });
  }

  return null;
}
