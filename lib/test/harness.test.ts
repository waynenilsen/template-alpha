import { afterAll, describe, expect, test } from "bun:test";
import {
  createTestContext,
  disconnectTestPrisma,
  withTestContext,
} from "./harness";

describe("test harness", () => {
  afterAll(async () => {
    await disconnectTestPrisma();
  });

  describe("createTestContext", () => {
    test("creates context with unique prefix", () => {
      const ctx1 = createTestContext();
      const ctx2 = createTestContext();

      expect(ctx1.prefix).toMatch(/^test_[a-z0-9]+_$/);
      expect(ctx2.prefix).toMatch(/^test_[a-z0-9]+_$/);
      expect(ctx1.prefix).not.toBe(ctx2.prefix);

      // Cleanup both contexts
      Promise.all([ctx1.cleanup(), ctx2.cleanup()]);
    });
  });

  describe("signIn", () => {
    test("creates a session for a user", async () => {
      const ctx = createTestContext();
      try {
        const user = await ctx.createUser();

        const session = await ctx.signIn(user);

        expect(session.id).toBeDefined();
        expect(session.userId).toBe(user.id);
        expect(session.currentOrgId).toBeNull();
      } finally {
        await ctx.cleanup();
      }
    });

    test("creates a session with organization context", async () => {
      const ctx = createTestContext();
      try {
        const { user, organization } = await ctx.createUserWithOrg();

        const session = await ctx.signIn(user, organization.id);

        expect(session.userId).toBe(user.id);
        expect(session.currentOrgId).toBe(organization.id);
      } finally {
        await ctx.cleanup();
      }
    });
  });

  describe("withTestContext", () => {
    test("provides context and cleans up on success", async () => {
      let _capturedUserEmail = "";
      let capturedUserId = "";

      await withTestContext(async (ctx) => {
        const user = await ctx.createUser();
        _capturedUserEmail = user.email;
        capturedUserId = user.id;

        expect(ctx.prisma).toBeDefined();
        expect(ctx.prefix).toMatch(/^test_[a-z0-9]+_$/);
      });

      // Verify the user was cleaned up
      const ctx = createTestContext();
      try {
        const found = await ctx.prisma.user.findUnique({
          where: { id: capturedUserId },
        });
        expect(found).toBeNull();
      } finally {
        await ctx.cleanup();
      }
    });

    test("cleans up on error", async () => {
      let capturedUserId = "";

      try {
        await withTestContext(async (ctx) => {
          const user = await ctx.createUser();
          capturedUserId = user.id;
          throw new Error("Test error");
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect((error as Error).message).toBe("Test error");
      }

      // Verify the user was cleaned up despite the error
      const ctx = createTestContext();
      try {
        const found = await ctx.prisma.user.findUnique({
          where: { id: capturedUserId },
        });
        expect(found).toBeNull();
      } finally {
        await ctx.cleanup();
      }
    });

    test("returns value from the function", async () => {
      const result = await withTestContext(async (ctx) => {
        const user = await ctx.createUser();
        return { userId: user.id, email: user.email };
      });

      expect(result.userId).toBeDefined();
      expect(result.email).toBeDefined();
    });
  });
});
