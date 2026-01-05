import { TRPCError } from "@trpc/server";
import { prisma } from "../../db";
import type {
  Organization,
  OrganizationMember,
} from "../../generated/prisma/client";
import type { TRPCBaseContext } from "../tmid";
import type { SessionData } from "./auth";

/**
 * Organization context data for org-scoped requests
 */
export interface OrgContext {
  organizationId: string;
  membership: (OrganizationMember & { organization: Organization }) | null;
}

/**
 * Organization context middleware for tmid
 *
 * Ensures the user has an active organization context before proceeding.
 * Verifies the user is a member of the organization (or is an admin).
 * Adds organizationId and membership to the context.
 *
 * Must be used after auth() middleware.
 *
 * Usage:
 * ```typescript
 * tmid()
 *   .use(auth())
 *   .use(orgContext())
 *   .build(async ({ session, organizationId, membership }) => {
 *     // handler code
 *   });
 * ```
 */
export function orgContext<TContext extends TRPCBaseContext, TResult>() {
  return async (
    context: TContext,
    next: (context: TContext & OrgContext) => Promise<TResult>,
  ): Promise<TResult> => {
    const { session } = context as TContext & { session: SessionData };

    if (!session.currentOrgId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You must select an organization to access this resource",
      });
    }

    // Verify user is still a member of the organization
    const membership = await prisma.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        organizationId: session.currentOrgId,
      },
      include: {
        organization: true,
      },
    });

    if (!membership && !session.user.isAdmin) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You are not a member of this organization",
      });
    }

    return next({
      ...context,
      organizationId: session.currentOrgId,
      membership: membership ?? null,
    });
  };
}
