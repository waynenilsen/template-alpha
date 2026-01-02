/**
 * Session factory for test harness
 */

import type { PrismaClient, Session } from "../../../generated/prisma/client";
import type { CreateSessionOptions } from "../types";

export function createSessionFactory(
  prisma: PrismaClient,
  sessionIds: Set<string>,
) {
  return async (options: CreateSessionOptions): Promise<Session> => {
    const expiresAt =
      options.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const session = await prisma.session.create({
      data: {
        userId: options.userId,
        currentOrgId: options.currentOrgId ?? null,
        expiresAt,
      },
    });

    sessionIds.add(session.id);
    return session;
  };
}
