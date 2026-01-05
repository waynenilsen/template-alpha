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

// Context
export { createTestContext, withTestContext } from "./context";

// Helpers
export { createTestUserWithPassword } from "./helpers";

// Prisma utilities
export { disconnectTestPrisma, getTestPrisma } from "./prisma";

// Session mocking for tmid middleware tests
export {
  createMockSession,
  createMockSessionFromUserWithOrg,
  createTestSessionProvider,
  mockSession,
  unmockSession,
} from "./session-mock";

// Types
export type {
  CreateMembershipOptions,
  CreateOrganizationOptions,
  CreatePasswordResetTokenOptions,
  CreateSessionOptions,
  CreateTodoOptions,
  CreateUserOptions,
  CreateUserWithOrgOptions,
  PasswordResetTokenWithPlainToken,
  TestContext,
  TestUserWithPassword,
  UserWithOrg,
} from "./types";
