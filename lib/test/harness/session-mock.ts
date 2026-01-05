/**
 * Session mocking utilities for testing tmid middlewares
 *
 * Uses AsyncLocalStorage for parallel-safe session mocking.
 * Each test can run with its own session without interfering with others.
 */

import type { Session, User } from "../../generated/prisma/client";
import {
  runWithSession,
  type SessionData,
} from "../../trpc/middlewares/session";

export type { SessionData } from "../../trpc/middlewares/session";
// Re-export for convenience
export { runWithSession } from "../../trpc/middlewares/session";

/**
 * Create a mock session from a Prisma Session and User
 */
export function createMockSession(
  session: Session,
  user: { id: string; email: string; isAdmin: boolean },
): SessionData {
  return {
    id: session.id,
    userId: session.userId,
    currentOrgId: session.currentOrgId,
    expiresAt: session.expiresAt,
    user,
  };
}

/**
 * Create a mock session from a user with org
 * Convenience method for common test setup
 */
export function createMockSessionFromUserWithOrg(
  session: Session,
  user: User,
): SessionData {
  return createMockSession(session, {
    id: user.id,
    email: user.email,
    isAdmin: user.isAdmin,
  });
}
