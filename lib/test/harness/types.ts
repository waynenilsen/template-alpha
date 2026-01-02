/**
 * Type definitions for the test harness
 */

import type {
  MemberRole,
  Organization,
  OrganizationMember,
  PasswordResetToken,
  PrismaClient,
  Session,
  Todo,
  User,
} from "../../generated/prisma/client";

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

export interface TestUserWithPassword {
  user: User;
  password: string;
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
