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
 * Session provider interface - allows mocking in tests
 */
export interface SessionProvider {
  getSession: () => Promise<SessionData | null>;
}

/**
 * Default session provider that reads from Next.js cookies
 */
async function getSessionFromCookies(): Promise<SessionData | null> {
  // Dynamic import to avoid issues in non-Next.js environments
  const { cookies } = await import("next/headers");
  const { SESSION_COOKIE_OPTIONS } = await import("../../auth/session");

  let sessionId: string | null = null;
  try {
    const cookieStore = await cookies();
    sessionId = cookieStore.get(SESSION_COOKIE_OPTIONS.name)?.value ?? null;
  } catch {
    // cookies() may fail in some contexts
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

/**
 * Current session provider - can be overridden for testing
 */
let currentProvider: SessionProvider = {
  getSession: getSessionFromCookies,
};

/**
 * Get the current session using the configured provider
 */
export async function getSession(): Promise<SessionData | null> {
  return currentProvider.getSession();
}

/**
 * Set a custom session provider (for testing)
 */
export function setSessionProvider(provider: SessionProvider): void {
  currentProvider = provider;
}

/**
 * Reset to the default session provider
 */
export function resetSessionProvider(): void {
  currentProvider = {
    getSession: getSessionFromCookies,
  };
}

/**
 * Create a mock session provider for testing
 */
export function createMockSessionProvider(
  session: SessionData | null,
): SessionProvider {
  return {
    getSession: async () => session,
  };
}
