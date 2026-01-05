import { initTRPC } from "@trpc/server";
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { cache } from "react";
import superjson from "superjson";
import {
  getSessionWithUser,
  SESSION_COOKIE_OPTIONS,
} from "../lib/auth/session";
import { prisma } from "../lib/db";
import type { PrismaClient, Session } from "../lib/generated/prisma/client";

/**
 * Context type for tRPC procedures
 *
 * Note: Authentication and authorization are now handled by the tmid middleware library.
 * This context is kept minimal for backwards compatibility with tests and server-side calls.
 */
export interface TRPCContext {
  prisma: PrismaClient;
  sessionId: string | null;
  session: Session | null;
  user: { id: string; email: string; isAdmin: boolean } | null;
}

/**
 * Extract session ID from request cookies
 */
function getSessionIdFromRequest(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").reduce(
    (acc, cookie) => {
      const [key, value] = cookie.trim().split("=");
      if (key && value) {
        acc[key] = value;
      }
      return acc;
    },
    {} as Record<string, string>,
  );

  return cookies[SESSION_COOKIE_OPTIONS.name] ?? null;
}

/**
 * Create the tRPC context for each request.
 * Includes database connection and session data.
 */
export const createTRPCContext = cache(
  async (opts: FetchCreateContextFnOptions): Promise<TRPCContext> => {
    const sessionId = getSessionIdFromRequest(opts.req);

    if (!sessionId) {
      return {
        prisma,
        sessionId: null,
        session: null,
        user: null,
      };
    }

    const sessionWithUser = await getSessionWithUser(prisma, sessionId);

    if (!sessionWithUser) {
      return {
        prisma,
        sessionId: null,
        session: null,
        user: null,
      };
    }

    return {
      prisma,
      sessionId: sessionWithUser.id,
      session: {
        id: sessionWithUser.id,
        userId: sessionWithUser.userId,
        currentOrgId: sessionWithUser.currentOrgId,
        expiresAt: sessionWithUser.expiresAt,
        lastAccessedAt: sessionWithUser.lastAccessedAt,
        createdAt: sessionWithUser.createdAt,
      },
      user: sessionWithUser.user,
    };
  },
);

/**
 * Create a test context for unit tests
 * This allows tests to inject their own Prisma client and session data
 */
export function createTestTRPCContext(opts: {
  prisma: PrismaClient;
  sessionId?: string | null;
  session?: Session | null;
  user?: { id: string; email: string; isAdmin: boolean } | null;
}): TRPCContext {
  return {
    prisma: opts.prisma,
    sessionId: opts.sessionId ?? null,
    session: opts.session ?? null,
    user: opts.user ?? null,
  };
}

/**
 * Create a server-side context for direct procedure calls
 * This is used by server components and RSC - reads session from Next.js cookies
 *
 * NOTE: This function requires Next.js runtime (cookies() from next/headers).
 * Lines after the sessionId check cannot be tested outside Next.js environment.
 */
/* c8 ignore start */
export async function createServerSideContext(): Promise<TRPCContext> {
  // Dynamic import to avoid issues in non-Next.js environments (like tests)
  const { cookies } = await import("next/headers");

  let sessionId: string | null = null;
  try {
    const cookieStore = await cookies();
    sessionId = cookieStore.get(SESSION_COOKIE_OPTIONS.name)?.value ?? null;
  } catch {
    // cookies() may fail in some contexts
  }

  if (!sessionId) {
    return {
      prisma,
      sessionId: null,
      session: null,
      user: null,
    };
  }

  const sessionWithUser = await getSessionWithUser(prisma, sessionId);

  if (!sessionWithUser) {
    return {
      prisma,
      sessionId: null,
      session: null,
      user: null,
    };
  }

  return {
    prisma,
    sessionId: sessionWithUser.id,
    session: {
      id: sessionWithUser.id,
      userId: sessionWithUser.userId,
      currentOrgId: sessionWithUser.currentOrgId,
      expiresAt: sessionWithUser.expiresAt,
      lastAccessedAt: sessionWithUser.lastAccessedAt,
      createdAt: sessionWithUser.createdAt,
    },
    user: sessionWithUser.user,
  };
}
/* c8 ignore stop */

/**
 * Initialize tRPC with superjson transformer for Date, Map, Set serialization
 */
const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
});

/**
 * Export reusable router and procedure helpers
 */
export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

/**
 * Public procedure - base procedure for all endpoints
 *
 * Authentication and authorization are handled by the tmid middleware library.
 * Use tmid().use(auth()).use(orgContext()).build(...) within procedure handlers.
 */
export const publicProcedure = t.procedure;
