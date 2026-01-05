/**
 * Test context creation and management
 */

import {
  createMembershipFactory,
  createOrganizationFactory,
  createPasswordResetTokenFactory,
  createPlanFactory,
  createSessionFactory,
  createSubscriptionFactory,
  createTodoFactory,
  createUserFactory,
} from "./factories";
import { getTestPrisma } from "./prisma";
import type {
  CreateUserWithOrgOptions,
  TestContext,
  UserWithOrg,
} from "./types";
import { generateUniqueId } from "./utils";

/**
 * Create a new test context
 * Each context has a unique prefix and tracks its own records
 */
export function createTestContext(): TestContext {
  const prisma = getTestPrisma();
  const prefix = `test_${generateUniqueId()}_`;

  const userIds = new Set<string>();
  const organizationIds = new Set<string>();
  const membershipIds = new Set<string>();
  const sessionIds = new Set<string>();
  const todoIds = new Set<string>();
  const passwordResetTokenIds = new Set<string>();
  const planIds = new Set<string>();
  const subscriptionIds = new Set<string>();

  const createUser = createUserFactory(prisma, prefix, userIds);
  const createOrganization = createOrganizationFactory(
    prisma,
    prefix,
    organizationIds,
  );
  const createMembership = createMembershipFactory(prisma, membershipIds);
  const createSession = createSessionFactory(prisma, sessionIds);
  const createTodo = createTodoFactory(prisma, prefix, todoIds);
  const createPasswordResetToken = createPasswordResetTokenFactory(
    prisma,
    passwordResetTokenIds,
  );
  const createPlan = createPlanFactory(prisma, prefix, planIds);
  const createSubscription = createSubscriptionFactory(
    prisma,
    prefix,
    subscriptionIds,
  );

  const createUserWithOrg = async (
    options: CreateUserWithOrgOptions = {},
  ): Promise<UserWithOrg> => {
    const user = await createUser({
      email: options.email,
      password: options.password,
    });

    const uniqueId = generateUniqueId();
    const organization = await createOrganization({
      name: options.orgName ?? `${prefix}Org for ${user.email}`,
      slug: `${prefix}org-${uniqueId}`,
    });

    const membership = await createMembership({
      userId: user.id,
      organizationId: organization.id,
      role: options.role ?? "owner",
    });

    return { user, organization, membership };
  };

  const signIn = async (user: { id: string }, orgId?: string) => {
    return createSession({
      userId: user.id,
      currentOrgId: orgId,
    });
  };

  const cleanup = async (): Promise<void> => {
    // Delete in reverse order of dependencies
    // Subscriptions first (depend on orgs and plans)
    if (subscriptionIds.size > 0) {
      await prisma.subscription.deleteMany({
        where: { id: { in: Array.from(subscriptionIds) } },
      });
    }

    // Todos (depend on users and orgs)
    if (todoIds.size > 0) {
      await prisma.todo.deleteMany({
        where: { id: { in: Array.from(todoIds) } },
      });
    }

    // Sessions next (depend on users and orgs)
    if (sessionIds.size > 0) {
      await prisma.session.deleteMany({
        where: { id: { in: Array.from(sessionIds) } },
      });
    }

    // Password reset tokens (depend on users)
    if (passwordResetTokenIds.size > 0) {
      await prisma.passwordResetToken.deleteMany({
        where: { id: { in: Array.from(passwordResetTokenIds) } },
      });
    }

    // Memberships next (depend on users and orgs)
    if (membershipIds.size > 0) {
      await prisma.organizationMember.deleteMany({
        where: { id: { in: Array.from(membershipIds) } },
      });
    }

    // Organizations (after memberships that reference them)
    if (organizationIds.size > 0) {
      await prisma.organization.deleteMany({
        where: { id: { in: Array.from(organizationIds) } },
      });
    }

    // Plans (after subscriptions that reference them)
    if (planIds.size > 0) {
      await prisma.plan.deleteMany({
        where: { id: { in: Array.from(planIds) } },
      });
    }

    // Users last (after everything that references them)
    if (userIds.size > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: Array.from(userIds) } },
      });
    }
  };

  return {
    prisma,
    prefix,
    userIds,
    organizationIds,
    membershipIds,
    sessionIds,
    todoIds,
    passwordResetTokenIds,
    planIds,
    subscriptionIds,
    createUser,
    createOrganization,
    createMembership,
    createSession,
    createTodo,
    createPasswordResetToken,
    createPlan,
    createSubscription,
    createUserWithOrg,
    signIn,
    cleanup,
  };
}

/**
 * Helper to wrap a test with automatic cleanup
 * Use this when you want to ensure cleanup even if the test fails
 */
export async function withTestContext<T>(
  fn: (ctx: TestContext) => Promise<T>,
): Promise<T> {
  const ctx = createTestContext();
  try {
    return await fn(ctx);
  } finally {
    await ctx.cleanup();
  }
}
