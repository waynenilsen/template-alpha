/**
 * Helper functions for test harness
 */

import type {
  CreateUserOptions,
  TestContext,
  TestUserWithPassword,
} from "./types";

/**
 * Create a test user with a known password for authentication tests
 * Returns both the user and the plain password
 */
export async function createTestUserWithPassword(
  ctx: TestContext,
  options: CreateUserOptions = {},
): Promise<TestUserWithPassword> {
  const password = options.password ?? "TestPassword123";
  const user = await ctx.createUser({ ...options, password });
  return { user, password };
}
