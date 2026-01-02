/**
 * Membership factory for test harness
 */

import type {
  OrganizationMember,
  PrismaClient,
} from "../../../generated/prisma/client";
import type { CreateMembershipOptions } from "../types";

export function createMembershipFactory(
  prisma: PrismaClient,
  membershipIds: Set<string>,
) {
  return async (
    options: CreateMembershipOptions,
  ): Promise<OrganizationMember> => {
    const membership = await prisma.organizationMember.create({
      data: {
        userId: options.userId,
        organizationId: options.organizationId,
        role: options.role ?? "member",
      },
    });

    membershipIds.add(membership.id);
    return membership;
  };
}
