import { AsyncLocalStorage } from "node:async_hooks";
import { prisma } from "../../db";

/**
 * Session data type
 */
export interface SessionData {
  id: string;
  userId: string;
  currentOrgId: string | null;
  expiresAt: Date;
  user: {
    id: string;
    email: string;
    isAdmin: boolean;
  };
}

/**
 * AsyncLocalStorage for request-scoped session override
 * This allows parallel tests to each have their own session without interference
 */
const sessionStorage = new AsyncLocalStorage<SessionData | null>();

/**
 * Get the current session
 * Checks AsyncLocalStorage first (for tests), then falls back to cookies (for production)
 */
export async function getSession(): Promise<SessionData | null> {
  // Check if we're in a test context with a mocked session
  const store = sessionStorage.getStore();
  if (store !== undefined) {
    return store;
  }

  // Production path: read from cookies
  return getSessionFromCookies();
}

/**
 * Run a function with a specific session (for testing)
 * Uses AsyncLocalStorage so parallel tests don't interfere with each other
 *
 * Usage:
 * ```typescript
 * await runWithSession(mockSession, async () => {
 *   // Inside here, getSession() returns mockSession
 *   await tmid().use(auth()).build(async ({ session }) => {
 *     // ...
 *   });
 * });
 * ```
 */
export function runWithSession<T>(session: SessionData | null, fn: () => T): T {
  return sessionStorage.run(session, fn);
}

/**
 * Default session provider that reads from Next.js cookies
 */
async function getSessionFromCookies(): Promise<SessionData | null> {
  // Dynamic import to avoid issues in non-Next.js environments
  let sessionId: string | null = null;
  try {
    const { cookies } = await import("next/headers");
    const { SESSION_COOKIE_OPTIONS } = await import("../../auth/session");
    const cookieStore = await cookies();
    sessionId = cookieStore.get(SESSION_COOKIE_OPTIONS.name)?.value ?? null;
  } catch {
    // cookies() may fail in some contexts (tests, non-Next.js)
    return null;
  }

  if (!sessionId) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          isAdmin: true,
        },
      },
    },
  });

  if (!session || session.expiresAt < new Date()) {
    return null;
  }

  return session;
}
