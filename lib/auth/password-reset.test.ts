import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import {
  createTestContext,
  disconnectTestPrisma,
  type TestContext,
} from "../test";
import { verifyPassword } from "./password";
import {
  cleanupExpiredResetTokens,
  createPasswordResetToken,
  generateResetToken,
  getPasswordResetTokenById,
  getUserResetTokens,
  hashResetToken,
  invalidateUserResetTokens,
  requestPasswordReset,
  resetPassword,
  validateResetToken,
} from "./password-reset";

describe("password reset token utilities", () => {
  describe("generateResetToken", () => {
    test("generates a 64-character hex string", () => {
      const token = generateResetToken();

      expect(token).toHaveLength(64);
      expect(/^[a-f0-9]+$/.test(token)).toBe(true);
    });

    test("generates unique tokens each time", () => {
      const token1 = generateResetToken();
      const token2 = generateResetToken();
      const token3 = generateResetToken();

      expect(token1).not.toBe(token2);
      expect(token2).not.toBe(token3);
      expect(token1).not.toBe(token3);
    });
  });

  describe("hashResetToken", () => {
    test("produces a consistent hash for the same token", () => {
      const token = generateResetToken();

      const hash1 = hashResetToken(token);
      const hash2 = hashResetToken(token);

      expect(hash1).toBe(hash2);
    });

    test("produces different hashes for different tokens", () => {
      const token1 = generateResetToken();
      const token2 = generateResetToken();

      const hash1 = hashResetToken(token1);
      const hash2 = hashResetToken(token2);

      expect(hash1).not.toBe(hash2);
    });

    test("produces a 64-character hex string (SHA-256)", () => {
      const token = generateResetToken();
      const hash = hashResetToken(token);

      expect(hash).toHaveLength(64);
      expect(/^[a-f0-9]+$/.test(hash)).toBe(true);
    });
  });
});

describe("createPasswordResetToken", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  test("creates a password reset token for a user", async () => {
    const user = await ctx.createUser();

    const result = await createPasswordResetToken(ctx.prisma, user.id);

    expect(result.token).toHaveLength(64);
    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());

    // Token should be stored in database
    const tokens = await getUserResetTokens(ctx.prisma, user.id);
    expect(tokens).toHaveLength(1);
    ctx.passwordResetTokenIds.add(tokens[0].id);
  });

  test("token expires in approximately 1 hour", async () => {
    const user = await ctx.createUser();

    const beforeCreate = Date.now();
    const result = await createPasswordResetToken(ctx.prisma, user.id);
    const afterCreate = Date.now();

    const oneHourMs = 60 * 60 * 1000;
    const expiresAtMs = result.expiresAt.getTime();

    expect(expiresAtMs).toBeGreaterThanOrEqual(beforeCreate + oneHourMs);
    expect(expiresAtMs).toBeLessThanOrEqual(afterCreate + oneHourMs + 1000);

    // Cleanup
    const tokens = await getUserResetTokens(ctx.prisma, user.id);
    for (const token of tokens) {
      ctx.passwordResetTokenIds.add(token.id);
    }
  });

  test("can create multiple tokens for the same user", async () => {
    const user = await ctx.createUser();

    await createPasswordResetToken(ctx.prisma, user.id);
    await createPasswordResetToken(ctx.prisma, user.id);
    await createPasswordResetToken(ctx.prisma, user.id);

    const tokens = await getUserResetTokens(ctx.prisma, user.id);
    expect(tokens).toHaveLength(3);

    for (const token of tokens) {
      ctx.passwordResetTokenIds.add(token.id);
    }
  });
});

describe("requestPasswordReset", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  test("creates a reset token for existing user", async () => {
    const user = await ctx.createUser({ email: "test@example.com" });

    const result = await requestPasswordReset(ctx.prisma, "test@example.com");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.token).toHaveLength(64);
      expect(result.expiresAt).toBeInstanceOf(Date);
    }

    // Cleanup
    const tokens = await getUserResetTokens(ctx.prisma, user.id);
    for (const token of tokens) {
      ctx.passwordResetTokenIds.add(token.id);
    }
  });

  test("is case-insensitive for email lookup", async () => {
    const user = await ctx.createUser({ email: "test@example.com" });

    const result = await requestPasswordReset(ctx.prisma, "TEST@EXAMPLE.COM");

    expect(result.success).toBe(true);

    // Cleanup
    const tokens = await getUserResetTokens(ctx.prisma, user.id);
    for (const token of tokens) {
      ctx.passwordResetTokenIds.add(token.id);
    }
  });

  test("returns error for non-existent user", async () => {
    const result = await requestPasswordReset(
      ctx.prisma,
      "nonexistent@example.com",
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("user_not_found");
    }
  });

  test("invalidates existing unused tokens when requesting new one", async () => {
    const user = await ctx.createUser({ email: "test@example.com" });

    // Create first token
    const result1 = await requestPasswordReset(ctx.prisma, "test@example.com");
    expect(result1.success).toBe(true);

    // Create second token
    const result2 = await requestPasswordReset(ctx.prisma, "test@example.com");
    expect(result2.success).toBe(true);

    // First token should be invalidated (marked as used)
    if (result1.success) {
      const validation = await validateResetToken(ctx.prisma, result1.token);
      expect(validation.valid).toBe(false);
      if (!validation.valid) {
        expect(validation.error).toBe("used_token");
      }
    }

    // Second token should still be valid
    if (result2.success) {
      const validation = await validateResetToken(ctx.prisma, result2.token);
      expect(validation.valid).toBe(true);
    }

    // Cleanup
    const tokens = await getUserResetTokens(ctx.prisma, user.id);
    for (const token of tokens) {
      ctx.passwordResetTokenIds.add(token.id);
    }
  });
});

describe("validateResetToken", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  test("validates a valid token", async () => {
    const user = await ctx.createUser();
    const { plainToken } = await ctx.createPasswordResetToken({
      userId: user.id,
    });

    const result = await validateResetToken(ctx.prisma, plainToken);

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.userId).toBe(user.id);
    }
  });

  test("returns error for invalid token", async () => {
    const result = await validateResetToken(ctx.prisma, "invalid-token");

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe("invalid_token");
    }
  });

  test("returns error for expired token", async () => {
    const user = await ctx.createUser();
    const { plainToken } = await ctx.createPasswordResetToken({
      userId: user.id,
      expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
    });

    const result = await validateResetToken(ctx.prisma, plainToken);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe("expired_token");
    }
  });

  test("returns error for used token", async () => {
    const user = await ctx.createUser();
    const { plainToken } = await ctx.createPasswordResetToken({
      userId: user.id,
      usedAt: new Date(), // Already used
    });

    const result = await validateResetToken(ctx.prisma, plainToken);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe("used_token");
    }
  });
});

describe("resetPassword", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  test("resets password with valid token", async () => {
    const user = await ctx.createUser({ password: "OldPassword123" });
    const { plainToken, token } = await ctx.createPasswordResetToken({
      userId: user.id,
    });

    const newPassword = "NewPassword456";
    const result = await resetPassword(ctx.prisma, plainToken, newPassword);

    expect(result.success).toBe(true);

    // Verify password was changed
    const updatedUser = await ctx.prisma.user.findUnique({
      where: { id: user.id },
    });
    expect(updatedUser).not.toBeNull();

    if (updatedUser) {
      const passwordValid = await verifyPassword(
        newPassword,
        updatedUser.passwordHash,
      );
      expect(passwordValid).toBe(true);
    }

    // Token should be marked as used
    const tokenRecord = await getPasswordResetTokenById(ctx.prisma, token.id);
    expect(tokenRecord?.usedAt).not.toBeNull();
  });

  test("returns error for invalid token", async () => {
    const result = await resetPassword(
      ctx.prisma,
      "invalid-token",
      "NewPassword456",
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("invalid_token");
    }
  });

  test("returns error for expired token", async () => {
    const user = await ctx.createUser();
    const { plainToken } = await ctx.createPasswordResetToken({
      userId: user.id,
      expiresAt: new Date(Date.now() - 1000),
    });

    const result = await resetPassword(
      ctx.prisma,
      plainToken,
      "NewPassword456",
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("expired_token");
    }
  });

  test("returns error for used token", async () => {
    const user = await ctx.createUser();
    const { plainToken } = await ctx.createPasswordResetToken({
      userId: user.id,
      usedAt: new Date(),
    });

    const result = await resetPassword(
      ctx.prisma,
      plainToken,
      "NewPassword456",
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("used_token");
    }
  });

  test("returns error if user was deleted", async () => {
    const user = await ctx.createUser();
    const { plainToken } = await ctx.createPasswordResetToken({
      userId: user.id,
    });

    // Delete the user (cascade will delete the token too)
    await ctx.prisma.user.delete({ where: { id: user.id } });
    ctx.userIds.delete(user.id);
    ctx.passwordResetTokenIds.clear(); // Token was cascade deleted

    const result = await resetPassword(
      ctx.prisma,
      plainToken,
      "NewPassword456",
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("invalid_token"); // Token no longer exists
    }
  });

  test("cannot use same token twice", async () => {
    const user = await ctx.createUser({ password: "OldPassword123" });
    const { plainToken } = await ctx.createPasswordResetToken({
      userId: user.id,
    });

    // First reset should succeed
    const result1 = await resetPassword(
      ctx.prisma,
      plainToken,
      "NewPassword456",
    );
    expect(result1.success).toBe(true);

    // Second reset should fail
    const result2 = await resetPassword(
      ctx.prisma,
      plainToken,
      "AnotherPassword789",
    );
    expect(result2.success).toBe(false);
    if (!result2.success) {
      expect(result2.error).toBe("used_token");
    }
  });
});

describe("invalidateUserResetTokens", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  test("invalidates all unused tokens for a user", async () => {
    const user = await ctx.createUser();

    const { plainToken: token1 } = await ctx.createPasswordResetToken({
      userId: user.id,
    });
    const { plainToken: token2 } = await ctx.createPasswordResetToken({
      userId: user.id,
    });
    const { plainToken: token3 } = await ctx.createPasswordResetToken({
      userId: user.id,
    });

    const count = await invalidateUserResetTokens(ctx.prisma, user.id);

    expect(count).toBe(3);

    // All tokens should now be invalid
    const validation1 = await validateResetToken(ctx.prisma, token1);
    const validation2 = await validateResetToken(ctx.prisma, token2);
    const validation3 = await validateResetToken(ctx.prisma, token3);

    expect(validation1.valid).toBe(false);
    expect(validation2.valid).toBe(false);
    expect(validation3.valid).toBe(false);
  });

  test("does not affect already used tokens", async () => {
    const user = await ctx.createUser();

    await ctx.createPasswordResetToken({
      userId: user.id,
      usedAt: new Date(), // Already used
    });
    await ctx.createPasswordResetToken({
      userId: user.id,
    });

    const count = await invalidateUserResetTokens(ctx.prisma, user.id);

    expect(count).toBe(1); // Only one unused token
  });

  test("does not affect tokens from other users", async () => {
    const user1 = await ctx.createUser();
    const user2 = await ctx.createUser();

    await ctx.createPasswordResetToken({ userId: user1.id });
    const { plainToken: user2Token } = await ctx.createPasswordResetToken({
      userId: user2.id,
    });

    await invalidateUserResetTokens(ctx.prisma, user1.id);

    // User2's token should still be valid
    const validation = await validateResetToken(ctx.prisma, user2Token);
    expect(validation.valid).toBe(true);
  });
});

describe("getPasswordResetTokenById", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  test("retrieves an existing token", async () => {
    const user = await ctx.createUser();
    const { token } = await ctx.createPasswordResetToken({ userId: user.id });

    const retrieved = await getPasswordResetTokenById(ctx.prisma, token.id);

    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(token.id);
    expect(retrieved?.userId).toBe(user.id);
  });

  test("returns null for non-existent token", async () => {
    const retrieved = await getPasswordResetTokenById(
      ctx.prisma,
      "non-existent-id",
    );

    expect(retrieved).toBeNull();
  });
});

describe("cleanupExpiredResetTokens", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  test("deletes expired tokens", async () => {
    const user = await ctx.createUser();

    // Create expired tokens
    const { token: expired1 } = await ctx.createPasswordResetToken({
      userId: user.id,
      expiresAt: new Date(Date.now() - 1000),
    });
    const { token: expired2 } = await ctx.createPasswordResetToken({
      userId: user.id,
      expiresAt: new Date(Date.now() - 2000),
    });

    // Create valid token
    const { token: validToken } = await ctx.createPasswordResetToken({
      userId: user.id,
      expiresAt: new Date(Date.now() + 1000000),
    });

    const count = await cleanupExpiredResetTokens(ctx.prisma);
    ctx.passwordResetTokenIds.delete(expired1.id);
    ctx.passwordResetTokenIds.delete(expired2.id);

    expect(count).toBeGreaterThanOrEqual(2);

    // Valid token should still exist
    const found = await getPasswordResetTokenById(ctx.prisma, validToken.id);
    expect(found).not.toBeNull();
  });
});

describe("getUserResetTokens", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  test("returns all tokens for a user", async () => {
    const user = await ctx.createUser();

    await ctx.createPasswordResetToken({ userId: user.id });
    await ctx.createPasswordResetToken({ userId: user.id });
    await ctx.createPasswordResetToken({ userId: user.id });

    const tokens = await getUserResetTokens(ctx.prisma, user.id);

    expect(tokens).toHaveLength(3);
    for (const token of tokens) {
      expect(token.userId).toBe(user.id);
    }
  });

  test("returns tokens ordered by creation date (newest first)", async () => {
    const user = await ctx.createUser();

    await ctx.createPasswordResetToken({ userId: user.id });
    await new Promise((resolve) => setTimeout(resolve, 10));
    await ctx.createPasswordResetToken({ userId: user.id });
    await new Promise((resolve) => setTimeout(resolve, 10));
    await ctx.createPasswordResetToken({ userId: user.id });

    const tokens = await getUserResetTokens(ctx.prisma, user.id);

    expect(tokens[0].createdAt.getTime()).toBeGreaterThan(
      tokens[1].createdAt.getTime(),
    );
    expect(tokens[1].createdAt.getTime()).toBeGreaterThan(
      tokens[2].createdAt.getTime(),
    );
  });

  test("returns empty array for user with no tokens", async () => {
    const user = await ctx.createUser();

    const tokens = await getUserResetTokens(ctx.prisma, user.id);

    expect(tokens).toHaveLength(0);
  });

  test("does not return tokens from other users", async () => {
    const user1 = await ctx.createUser();
    const user2 = await ctx.createUser();

    await ctx.createPasswordResetToken({ userId: user1.id });
    await ctx.createPasswordResetToken({ userId: user2.id });

    const user1Tokens = await getUserResetTokens(ctx.prisma, user1.id);

    expect(user1Tokens).toHaveLength(1);
    expect(user1Tokens[0].userId).toBe(user1.id);
  });
});

describe("password reset token cascade deletion", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  test("tokens are deleted when user is deleted", async () => {
    const user = await ctx.createUser();
    const { token } = await ctx.createPasswordResetToken({ userId: user.id });

    await ctx.prisma.user.delete({ where: { id: user.id } });
    ctx.userIds.delete(user.id);
    ctx.passwordResetTokenIds.delete(token.id);

    const found = await getPasswordResetTokenById(ctx.prisma, token.id);
    expect(found).toBeNull();
  });
});
