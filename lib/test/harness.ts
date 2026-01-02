/**
 * Test Harness for Parallelizable Database Tests
 *
 * This module provides utilities for creating and cleaning up test data
 * in a way that allows tests to run in parallel without interfering with each other.
 *
 * Key features:
 * - Each test context gets a unique prefix for all created records
 * - Cleanup is targeted to only records created within that context
 * - All factories return the created records for assertions
 * - Supports creating users, organizations, memberships, and sessions
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { hashPassword } from "../auth/password";
import { generateResetToken, hashResetToken } from "../auth/password-reset";
import {
  type MemberRole,
  type Organization,
  type OrganizationMember,
  type PasswordResetToken,
  PrismaClient,
  type Session,
  type Todo,
  type User,
} from "../generated/prisma/client";

// Shared Prisma client and pool for all tests
let sharedPrisma: PrismaClient | null = null;
let sharedPool: Pool | null = null;

/**
 * Get the shared Prisma client instance
 * Creates one if it doesn't exist
 */
export function getTestPrisma(): PrismaClient {
  if (!sharedPrisma) {
    const connectionString = process.env.DATABASE_URL;
    sharedPool = new Pool({ connectionString });
    const adapter = new PrismaPg(sharedPool);
    sharedPrisma = new PrismaClient({ adapter });
  }
  return sharedPrisma;
}

/**
 * Disconnect the shared Prisma client
 * Call this in afterAll() of your test suite
 */
export async function disconnectTestPrisma(): Promise<void> {
  if (sharedPrisma) {
    await sharedPrisma.$disconnect();
    sharedPrisma = null;
  }
  if (sharedPool) {
    await sharedPool.end();
    sharedPool = null;
  }
}

/**
 * Generate a unique ID with a prefix
 * Uses timestamp + random string for uniqueness
 */
function generateUniqueId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}${random}`;
}

/**
 * Test context that tracks all created records for cleanup
 */
export interface TestContext {
  prisma: PrismaClient;
  prefix: string;

  // Tracked record IDs
  userIds: Set<string>;
  organizationIds: Set<string>;
  membershipIds: Set<string>;
  sessionIds: Set<string>;
  todoIds: Set<string>;
  passwordResetTokenIds: Set<string>;

  // Factory methods
  createUser: (options?: CreateUserOptions) => Promise<User>;
  createOrganization: (
    options?: CreateOrganizationOptions,
  ) => Promise<Organization>;
  createMembership: (
    options: CreateMembershipOptions,
  ) => Promise<OrganizationMember>;
  createSession: (options: CreateSessionOptions) => Promise<Session>;
  createTodo: (options: CreateTodoOptions) => Promise<Todo>;
  createPasswordResetToken: (
    options: CreatePasswordResetTokenOptions,
  ) => Promise<PasswordResetTokenWithPlainToken>;

  // Convenience methods
  createUserWithOrg: (
    options?: CreateUserWithOrgOptions,
  ) => Promise<UserWithOrg>;
  signIn: (user: User, orgId?: string) => Promise<Session>;

  // Cleanup
  cleanup: () => Promise<void>;
}

export interface CreateUserOptions {
  email?: string;
  password?: string;
  isAdmin?: boolean;
}

export interface CreateOrganizationOptions {
  name?: string;
  slug?: string;
}

export interface CreateMembershipOptions {
  userId: string;
  organizationId: string;
  role?: MemberRole;
}

export interface CreateSessionOptions {
  userId: string;
  currentOrgId?: string | null;
  expiresAt?: Date;
}

export interface CreateTodoOptions {
  title?: string;
  description?: string | null;
  completed?: boolean;
  organizationId: string;
  createdById: string;
}

export interface CreatePasswordResetTokenOptions {
  userId: string;
  expiresAt?: Date;
  usedAt?: Date | null;
}

export interface PasswordResetTokenWithPlainToken {
  token: PasswordResetToken;
  plainToken: string;
}

export interface CreateUserWithOrgOptions {
  email?: string;
  password?: string;
  orgName?: string;
  role?: MemberRole;
}

export interface UserWithOrg {
  user: User;
  organization: Organization;
  membership: OrganizationMember;
}

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

  const createUser = async (options: CreateUserOptions = {}): Promise<User> => {
    const uniqueId = generateUniqueId();
    const email = options.email ?? `${prefix}user_${uniqueId}@test.local`;
    const password = options.password ?? "TestPassword123";
    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        isAdmin: options.isAdmin ?? false,
      },
    });

    userIds.add(user.id);
    return user;
  };

  const createOrganization = async (
    options: CreateOrganizationOptions = {},
  ): Promise<Organization> => {
    const uniqueId = generateUniqueId();
    const name = options.name ?? `${prefix}Org ${uniqueId}`;
    const slug = options.slug ?? `${prefix}org-${uniqueId}`;

    const organization = await prisma.organization.create({
      data: { name, slug },
    });

    organizationIds.add(organization.id);
    return organization;
  };

  const createMembership = async (
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

  const createSession = async (
    options: CreateSessionOptions,
  ): Promise<Session> => {
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

  const createTodo = async (options: CreateTodoOptions): Promise<Todo> => {
    const uniqueId = generateUniqueId();
    const title = options.title ?? `${prefix}Todo ${uniqueId}`;

    const todo = await prisma.todo.create({
      data: {
        title,
        description: options.description ?? null,
        completed: options.completed ?? false,
        organizationId: options.organizationId,
        createdById: options.createdById,
      },
    });

    todoIds.add(todo.id);
    return todo;
  };

  const createPasswordResetToken = async (
    options: CreatePasswordResetTokenOptions,
  ): Promise<PasswordResetTokenWithPlainToken> => {
    const plainToken = generateResetToken();
    const tokenHash = hashResetToken(plainToken);
    const expiresAt =
      options.expiresAt ?? new Date(Date.now() + 60 * 60 * 1000); // 1 hour default

    const token = await prisma.passwordResetToken.create({
      data: {
        userId: options.userId,
        tokenHash,
        expiresAt,
        usedAt: options.usedAt ?? null,
      },
    });

    passwordResetTokenIds.add(token.id);
    return { token, plainToken };
  };

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

  const signIn = async (user: User, orgId?: string): Promise<Session> => {
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

/**
 * Create a test user with a known password for authentication tests
 * Returns both the user and the plain password
 */
export interface TestUserWithPassword {
  user: User;
  password: string;
}

export async function createTestUserWithPassword(
  ctx: TestContext,
  options: CreateUserOptions = {},
): Promise<TestUserWithPassword> {
  const password = options.password ?? "TestPassword123";
  const user = await ctx.createUser({ ...options, password });
  return { user, password };
}
