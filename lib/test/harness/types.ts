/**
 * Type definitions for the test harness
 */

import type {
  BillingInterval,
  MemberRole,
  Organization,
  OrganizationMember,
  PasswordResetToken,
  Plan,
  PrismaClient,
  Session,
  Subscription,
  SubscriptionStatus,
  Todo,
  User,
} from "../../generated/prisma/client";
import type { PlanLimit } from "../../subscriptions/plans";

export interface CreateUserOptions {
  email?: string;
  password?: string;
  name?: string;
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

export interface CreatePlanOptions {
  slug?: string;
  name?: string;
  description?: string;
  priceMonthly?: number;
  priceYearly?: number | null;
  limits?: PlanLimit;
  sortOrder?: number;
  active?: boolean;
  isDefault?: boolean;
  stripeProductId?: string | null;
  stripePriceMonthlyId?: string | null;
  stripePriceYearlyId?: string | null;
}

export interface CreateSubscriptionOptions {
  organizationId: string;
  planId: string;
  status?: SubscriptionStatus;
  interval?: BillingInterval;
  stripeSubscriptionId?: string | null;
  stripeCustomerId?: string | null;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
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
  planIds: Set<string>;
  subscriptionIds: Set<string>;

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
  createPlan: (options?: CreatePlanOptions) => Promise<Plan>;
  createSubscription: (
    options: CreateSubscriptionOptions,
  ) => Promise<Subscription>;

  // Convenience methods
  createUserWithOrg: (
    options?: CreateUserWithOrgOptions,
  ) => Promise<UserWithOrg>;
  signIn: (user: User, orgId?: string) => Promise<Session>;

  // Cleanup
  cleanup: () => Promise<void>;
}
