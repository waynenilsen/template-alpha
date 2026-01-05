/**
 * Subscription service
 *
 * Runtime functions for managing subscriptions and checking limits.
 * This module requires the database to be synced (stripe:sync).
 */

import type { PrismaClient, Subscription } from "../generated/prisma/client";
import type { PlanLimit } from "./plans";

/**
 * Error thrown when subscription/plan limits are exceeded
 */
export class LimitExceededError extends Error {
  constructor(
    public readonly limitType: keyof PlanLimit,
    public readonly current: number,
    public readonly limit: number,
    public readonly planName: string,
  ) {
    super(
      `${limitType} limit exceeded: ${current}/${limit === -1 ? "unlimited" : limit} on ${planName} plan`,
    );
    this.name = "LimitExceededError";
  }
}

/**
 * Error thrown when subscription operations fail
 */
export class SubscriptionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "SubscriptionError";
  }
}

/**
 * Get the subscription for an organization, creating a free one if needed
 */
export async function getOrCreateSubscription(
  prisma: PrismaClient,
  organizationId: string,
): Promise<
  Subscription & {
    plan: {
      slug: string;
      name: string;
      limits: PlanLimit;
    };
  }
> {
  // Try to get existing subscription
  let subscription = await prisma.subscription.findUnique({
    where: { organizationId },
    include: {
      plan: {
        select: {
          slug: true,
          name: true,
          limits: true,
        },
      },
    },
  });

  if (subscription) {
    return subscription as typeof subscription & {
      plan: { limits: PlanLimit };
    };
  }

  // No subscription - create one on the free plan
  const freePlan = await prisma.plan.findFirst({
    where: { isDefault: true },
  });

  if (!freePlan) {
    throw new SubscriptionError(
      "No default plan configured. Run 'bun run stripe:sync' to set up plans.",
      "NO_DEFAULT_PLAN",
    );
  }

  subscription = await prisma.subscription.create({
    data: {
      organizationId,
      planId: freePlan.id,
      status: "active",
    },
    include: {
      plan: {
        select: {
          slug: true,
          name: true,
          limits: true,
        },
      },
    },
  });

  return subscription as typeof subscription & { plan: { limits: PlanLimit } };
}

/**
 * Check if an organization can create more todos
 */
export async function checkTodoLimit(
  prisma: PrismaClient,
  organizationId: string,
): Promise<{ allowed: boolean; current: number; limit: number }> {
  const subscription = await getOrCreateSubscription(prisma, organizationId);
  const limits = subscription.plan.limits as PlanLimit;

  if (limits.maxTodos === -1) {
    return { allowed: true, current: 0, limit: -1 };
  }

  const todoCount = await prisma.todo.count({
    where: { organizationId },
  });

  return {
    allowed: todoCount < limits.maxTodos,
    current: todoCount,
    limit: limits.maxTodos,
  };
}

/**
 * Check if an organization can add more members
 */
export async function checkMemberLimit(
  prisma: PrismaClient,
  organizationId: string,
): Promise<{ allowed: boolean; current: number; limit: number }> {
  const subscription = await getOrCreateSubscription(prisma, organizationId);
  const limits = subscription.plan.limits as PlanLimit;

  if (limits.maxMembers === -1) {
    return { allowed: true, current: 0, limit: -1 };
  }

  const memberCount = await prisma.organizationMember.count({
    where: { organizationId },
  });

  return {
    allowed: memberCount < limits.maxMembers,
    current: memberCount,
    limit: limits.maxMembers,
  };
}

/**
 * Check if a user can create more organizations
 */
export async function checkOrganizationLimit(
  prisma: PrismaClient,
  userId: string,
): Promise<{ allowed: boolean; current: number; limit: number }> {
  // Get all orgs where user is owner
  const ownedOrgs = await prisma.organizationMember.findMany({
    where: {
      userId,
      role: "owner",
    },
    include: {
      organization: {
        include: {
          subscription: {
            include: {
              plan: true,
            },
          },
        },
      },
    },
  });

  // Use the most permissive limit from any of the user's organizations
  let maxLimit = 1; // Default to 1 if no subscriptions

  for (const membership of ownedOrgs) {
    const sub = membership.organization.subscription;
    if (sub) {
      const limits = sub.plan.limits as unknown as PlanLimit;
      if (limits.maxOrganizations === -1) {
        return { allowed: true, current: ownedOrgs.length, limit: -1 };
      }
      maxLimit = Math.max(maxLimit, limits.maxOrganizations);
    }
  }

  return {
    allowed: ownedOrgs.length < maxLimit,
    current: ownedOrgs.length,
    limit: maxLimit,
  };
}

/**
 * Enforce todo limit - throws if limit exceeded
 */
export async function enforceTodoLimit(
  prisma: PrismaClient,
  organizationId: string,
): Promise<void> {
  const check = await checkTodoLimit(prisma, organizationId);
  if (!check.allowed) {
    const subscription = await getOrCreateSubscription(prisma, organizationId);
    throw new LimitExceededError(
      "maxTodos",
      check.current,
      check.limit,
      subscription.plan.name,
    );
  }
}

/**
 * Enforce member limit - throws if limit exceeded
 */
export async function enforceMemberLimit(
  prisma: PrismaClient,
  organizationId: string,
): Promise<void> {
  const check = await checkMemberLimit(prisma, organizationId);
  if (!check.allowed) {
    const subscription = await getOrCreateSubscription(prisma, organizationId);
    throw new LimitExceededError(
      "maxMembers",
      check.current,
      check.limit,
      subscription.plan.name,
    );
  }
}

/**
 * Enforce organization limit - throws if limit exceeded
 */
export async function enforceOrganizationLimit(
  prisma: PrismaClient,
  userId: string,
): Promise<void> {
  const check = await checkOrganizationLimit(prisma, userId);
  if (!check.allowed) {
    throw new LimitExceededError(
      "maxOrganizations",
      check.current,
      check.limit,
      "current",
    );
  }
}

/**
 * Get usage statistics for an organization
 */
export async function getUsageStats(
  prisma: PrismaClient,
  organizationId: string,
): Promise<{
  todos: { current: number; limit: number };
  members: { current: number; limit: number };
}> {
  const subscription = await getOrCreateSubscription(prisma, organizationId);
  const limits = subscription.plan.limits as PlanLimit;

  const [todoCount, memberCount] = await Promise.all([
    prisma.todo.count({ where: { organizationId } }),
    prisma.organizationMember.count({ where: { organizationId } }),
  ]);

  return {
    todos: { current: todoCount, limit: limits.maxTodos },
    members: { current: memberCount, limit: limits.maxMembers },
  };
}
