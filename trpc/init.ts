import { initTRPC, TRPCError } from "@trpc/server";
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
 * Public (unauthenticated) procedure
 * Anyone can call these procedures
 */
export const publicProcedure = t.procedure;

/**
 * Protected (authenticated) procedure middleware
 * Ensures user is authenticated before proceeding
 */
const authMiddleware = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session || !ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to access this resource",
    });
  }

  return next({
    ctx: {
      ...ctx,
      // Narrow types - guaranteed to be non-null after middleware
      session: ctx.session,
      user: ctx.user,
    },
  });
});

/**
 * Protected (authenticated) procedure
 * Only authenticated users can call these
 */
export const protectedProcedure = t.procedure.use(authMiddleware);

/**
 * Organization-scoped procedure middleware
 * Ensures user is authenticated AND has an active organization context
 */
const orgMiddleware = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session || !ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to access this resource",
    });
  }

  if (!ctx.session.currentOrgId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You must select an organization to access this resource",
    });
  }

  // Verify user is still a member of the organization
  const membership = await ctx.prisma.organizationMember.findFirst({
    where: {
      userId: ctx.user.id,
      organizationId: ctx.session.currentOrgId,
    },
    include: {
      organization: true,
    },
  });

  if (!membership && !ctx.user.isAdmin) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You are not a member of this organization",
    });
  }

  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      user: ctx.user,
      organizationId: ctx.session.currentOrgId,
      membership: membership ?? null,
    },
  });
});

/**
 * Organization-scoped procedure
 * User must be authenticated and have an active organization context
 */
export const orgProcedure = t.procedure.use(orgMiddleware);
