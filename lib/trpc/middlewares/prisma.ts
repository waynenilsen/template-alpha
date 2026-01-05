import { prisma } from "../../db";
import type { PrismaClient } from "../../generated/prisma/client";
import type { TRPCBaseContext } from "../tmid";

/**
 * Prisma context for database access
 */
export interface PrismaContext {
  prisma: PrismaClient;
}

/**
 * Prisma middleware for tmid
 *
 * Adds the global Prisma client to the context for database operations.
 * This should typically be the first middleware in the chain.
 *
 * Usage:
 * ```typescript
 * tmid()
 *   .use(withPrisma())
 *   .use(auth())
 *   .build(async ({ prisma, session }) => {
 *     await prisma.user.findMany();
 *   });
 * ```
 */
export function withPrisma<TContext extends TRPCBaseContext, TResult>() {
  return async (
    context: TContext,
    next: (context: TContext & PrismaContext) => Promise<TResult>,
  ): Promise<TResult> => {
    return next({
      ...context,
      prisma,
    });
  };
}
