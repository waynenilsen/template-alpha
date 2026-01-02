/**
 * Test context creation and management
 */

import {
  createMembershipFactory,
  createOrganizationFactory,
  createPasswordResetTokenFactory,
  createSessionFactory,
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
    // Todos first (depend on users and orgs)
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
    createUser,
    createOrganization,
    createMembership,
    createSession,
    createTodo,
    createPasswordResetToken,
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
