import { initTRPC } from "@trpc/server";
import { cache } from "react";
import superjson from "superjson";

/**
 * Create the tRPC context for each request.
 * This is where you'd add session data, database connections, etc.
 */
export const createTRPCContext = cache(async () => {
  // In the future, you can add session, user, and tenant context here
  return {
    // Example: session: await getSession(),
  };
});

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

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
 * Protected (authenticated) procedure
 * Only authenticated users can call these - add middleware when auth is implemented
 */
export const protectedProcedure = t.procedure;
