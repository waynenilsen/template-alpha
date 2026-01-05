import { TRPCError } from "@trpc/server";
import type { TRPCBaseContext } from "../tmid";
import { getSession, type SessionData } from "./session";

/**
 * Admin-only middleware for tmid
 *
 * Gets the current session and ensures the user is an admin (isAdmin = true).
 * Adds session to the context.
 *
 * This middleware handles authentication itself, so it can be used standalone
 * or after auth() middleware.
 *
 * Usage:
 * ```typescript
 * tmid()
 *   .use(adminOnly())
 *   .build(async ({ session }) => {
 *     // Only admins reach here
 *   });
 * ```
 */
export function adminOnly<TContext extends TRPCBaseContext, TResult>() {
  return async (
    context: TContext,
    next: (context: TContext & { session: SessionData }) => Promise<TResult>,
  ): Promise<TResult> => {
    const session = await getSession();

    if (!session) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Not authenticated",
      });
    }

    if (!session.user.isAdmin) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Admin access required",
      });
    }

    return next({
      ...context,
      session,
    });
  };
}
