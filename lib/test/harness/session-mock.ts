/**
 * Session mocking utilities for testing tmid middlewares
 */

import type { Session, User } from "../../generated/prisma/client";
import {
  resetSessionProvider,
  type SessionData,
  type SessionProvider,
  setSessionProvider,
} from "../../trpc/middlewares/session";

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

/**
 * Mock the session provider to return a specific session
 */
export function mockSession(session: SessionData | null): void {
  setSessionProvider({
    getSession: async () => session,
  });
}

/**
 * Unmock the session provider (restore default behavior)
 */
export function unmockSession(): void {
  resetSessionProvider();
}

/**
 * Create a session provider that returns the given session
 */
export function createTestSessionProvider(
  session: SessionData | null,
): SessionProvider {
  return {
    getSession: async () => session,
  };
}
