import { TRPCError } from "@trpc/server";
import type { TRPCBaseContext } from "../tmid";
import { getSession, type SessionData } from "./session";

export type { SessionData } from "./session";

/**
 * Authentication middleware for tmid
 *
 * Gets the current session from cookies and ensures the user is authenticated.
 * Adds session to the context.
 *
 * Usage:
 * ```typescript
 * tmid()
 *   .use(auth())
 *   .build(async ({ session }) => {
 *     // session.user.id, session.currentOrgId, etc.
 *   });
 * ```
 */
export function auth<TContext extends TRPCBaseContext, TResult>() {
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

    return next({
      ...context,
      session,
    });
  };
}
