import type { PrismaClient, Session } from "../generated/prisma/client";

// Transaction-compatible Prisma client type (for use in $transaction callbacks)
type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

// Type that accepts both full PrismaClient and transaction clients
type PrismaClientLike = PrismaClient | TransactionClient;

// Session duration: 7 days in milliseconds
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface SessionData {
  id: string;
  userId: string;
  currentOrgId: string | null;
  expiresAt: Date;
  lastAccessedAt: Date;
  createdAt: Date;
}

export interface SessionWithUser extends SessionData {
  user: {
    id: string;
    email: string;
    isAdmin: boolean;
  };
}

export const SESSION_COOKIE_OPTIONS = {
  name: "session_id" as const,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7, // 7 days in seconds
};

/**
 * Create a new session in the database
 */
export async function createSession(
  prisma: PrismaClientLike,
  userId: string,
  currentOrgId?: string | null,
): Promise<Session> {
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS);

  return prisma.session.create({
    data: {
      userId,
      currentOrgId: currentOrgId ?? null,
      expiresAt,
    },
  });
}

/**
 * Get a session by ID
 * Returns null if session doesn't exist or is expired
 */
export async function getSessionById(
  prisma: PrismaClient,
  sessionId: string,
): Promise<Session | null> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    return null;
  }

  // Check if session is expired
  if (session.expiresAt < new Date()) {
    // Clean up expired session
    await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
    return null;
  }

  return session;
}

/**
 * Get a session with user data
 */
export async function getSessionWithUser(
  prisma: PrismaClient,
  sessionId: string,
): Promise<SessionWithUser | null> {
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

  if (!session) {
    return null;
  }

  // Check if session is expired
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
    return null;
  }

  return session;
}

/**
 * Update session's last accessed time (sliding expiration)
 */
export async function refreshSession(
  prisma: PrismaClient,
  sessionId: string,
): Promise<Session | null> {
  try {
    return await prisma.session.update({
      where: { id: sessionId },
      data: { lastAccessedAt: new Date() },
    });
  } catch {
    return null;
  }
}

/**
 * Delete a session by ID
 */
export async function deleteSession(
  prisma: PrismaClient,
  sessionId: string,
): Promise<boolean> {
  try {
    await prisma.session.delete({ where: { id: sessionId } });
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete all sessions for a user
 */
export async function deleteUserSessions(
  prisma: PrismaClient,
  userId: string,
): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: { userId },
  });
  return result.count;
}

/**
 * Switch organization context for a session
 */
export async function switchOrganization(
  prisma: PrismaClient,
  sessionId: string,
  organizationId: string | null,
): Promise<Session | null> {
  try {
    return await prisma.session.update({
      where: { id: sessionId },
      data: { currentOrgId: organizationId },
    });
  } catch {
    return null;
  }
}

/**
 * Clean up expired sessions
 * Returns the number of sessions deleted
 */
export async function cleanupExpiredSessions(
  prisma: PrismaClient,
): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });
  return result.count;
}

/**
 * Get all active sessions for a user
 */
export async function getUserSessions(
  prisma: PrismaClient,
  userId: string,
): Promise<Session[]> {
  return prisma.session.findMany({
    where: {
      userId,
      expiresAt: { gt: new Date() },
    },
    orderBy: { lastAccessedAt: "desc" },
  });
}
