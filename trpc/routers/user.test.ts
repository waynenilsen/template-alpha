import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { TRPCError } from "@trpc/server";
import { verifyPassword } from "../../lib/auth/password";
import {
  createTestContext,
  createTestUserWithPassword,
  disconnectTestPrisma,
  type TestContext,
} from "../../lib/test/harness";
import { createTestTRPCContext } from "../init";
import { appRouter } from "../router";

describe("user router", () => {
  let ctx: TestContext;

  beforeAll(() => {
    ctx = createTestContext();
  });

  afterAll(async () => {
    await ctx.cleanup();
    await disconnectTestPrisma();
  });

  describe("getProfile", () => {
    test("returns current user profile", async () => {
      const user = await ctx.createUser({ name: "Test User" });
      const session = await ctx.createSession({ userId: user.id });

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
      });
      const caller = appRouter.createCaller(trpcCtx);

      const result = await caller.user.getProfile();

      expect(result.id).toBe(user.id);
      expect(result.email).toBe(user.email);
      expect(result.name).toBe("Test User");
      expect(result.isAdmin).toBe(false);
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    test("returns null name when not set", async () => {
      const user = await ctx.createUser();
      const session = await ctx.createSession({ userId: user.id });

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
      });
      const caller = appRouter.createCaller(trpcCtx);

      const result = await caller.user.getProfile();

      expect(result.name).toBeNull();
    });

    test("requires authentication", async () => {
      const trpcCtx = createTestTRPCContext({ prisma: ctx.prisma });
      const caller = appRouter.createCaller(trpcCtx);

      try {
        await caller.user.getProfile();
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("UNAUTHORIZED");
      }
    });
  });

  describe("updateProfile", () => {
    test("updates user name", async () => {
      const user = await ctx.createUser({ name: "Original Name" });
      const session = await ctx.createSession({ userId: user.id });

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
      });
      const caller = appRouter.createCaller(trpcCtx);

      const result = await caller.user.updateProfile({ name: "New Name" });

      expect(result.name).toBe("New Name");
      expect(result.id).toBe(user.id);
      expect(result.email).toBe(user.email);

      // Verify in database
      const updated = await ctx.prisma.user.findUnique({
        where: { id: user.id },
      });
      expect(updated?.name).toBe("New Name");
    });

    test("requires authentication", async () => {
      const trpcCtx = createTestTRPCContext({ prisma: ctx.prisma });
      const caller = appRouter.createCaller(trpcCtx);

      try {
        await caller.user.updateProfile({ name: "Test" });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("UNAUTHORIZED");
      }
    });

    test("rejects empty name", async () => {
      const user = await ctx.createUser();
      const session = await ctx.createSession({ userId: user.id });

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
      });
      const caller = appRouter.createCaller(trpcCtx);

      try {
        await caller.user.updateProfile({ name: "" });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("BAD_REQUEST");
      }
    });

    test("rejects name over 100 characters", async () => {
      const user = await ctx.createUser();
      const session = await ctx.createSession({ userId: user.id });

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
      });
      const caller = appRouter.createCaller(trpcCtx);

      try {
        await caller.user.updateProfile({ name: "a".repeat(101) });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("BAD_REQUEST");
      }
    });
  });

  describe("changePassword", () => {
    test("changes password with correct current password", async () => {
      const { user, password } = await createTestUserWithPassword(ctx);
      const session = await ctx.createSession({ userId: user.id });

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
      });
      const caller = appRouter.createCaller(trpcCtx);

      const result = await caller.user.changePassword({
        currentPassword: password,
        newPassword: "NewValidPass456",
      });

      expect(result.success).toBe(true);

      // Verify new password works
      const updated = await ctx.prisma.user.findUnique({
        where: { id: user.id },
      });
      expect(updated).not.toBeNull();
      const isValid = await verifyPassword(
        "NewValidPass456",
        updated?.passwordHash ?? "",
      );
      expect(isValid).toBe(true);
    });

    test("rejects incorrect current password", async () => {
      const { user } = await createTestUserWithPassword(ctx);
      const session = await ctx.createSession({ userId: user.id });

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
      });
      const caller = appRouter.createCaller(trpcCtx);

      try {
        await caller.user.changePassword({
          currentPassword: "WrongPassword123",
          newPassword: "NewValidPass456",
        });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("UNAUTHORIZED");
        expect((error as TRPCError).message).toContain("incorrect");
      }
    });

    test("rejects weak new password", async () => {
      const { user, password } = await createTestUserWithPassword(ctx);
      const session = await ctx.createSession({ userId: user.id });

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
      });
      const caller = appRouter.createCaller(trpcCtx);

      try {
        await caller.user.changePassword({
          currentPassword: password,
          newPassword: "weak",
        });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("BAD_REQUEST");
      }
    });

    test("requires authentication", async () => {
      const trpcCtx = createTestTRPCContext({ prisma: ctx.prisma });
      const caller = appRouter.createCaller(trpcCtx);

      try {
        await caller.user.changePassword({
          currentPassword: "OldPass123",
          newPassword: "NewPass456",
        });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("UNAUTHORIZED");
      }
    });
  });

  describe("deleteAccount", () => {
    test("deletes account with correct password", async () => {
      const { user, password } = await createTestUserWithPassword(ctx);
      const session = await ctx.createSession({ userId: user.id });

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
      });
      const caller = appRouter.createCaller(trpcCtx);

      const result = await caller.user.deleteAccount({ password });

      expect(result.success).toBe(true);

      // Verify user is deleted
      const deleted = await ctx.prisma.user.findUnique({
        where: { id: user.id },
      });
      expect(deleted).toBeNull();

      // Verify session is deleted
      const deletedSession = await ctx.prisma.session.findUnique({
        where: { id: session.id },
      });
      expect(deletedSession).toBeNull();

      // Remove from cleanup sets since already deleted
      ctx.userIds.delete(user.id);
      ctx.sessionIds.delete(session.id);
    });

    test("rejects incorrect password", async () => {
      const { user } = await createTestUserWithPassword(ctx);
      const session = await ctx.createSession({ userId: user.id });

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
      });
      const caller = appRouter.createCaller(trpcCtx);

      try {
        await caller.user.deleteAccount({ password: "WrongPassword123" });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("UNAUTHORIZED");
        expect((error as TRPCError).message).toContain("incorrect");
      }

      // Verify user still exists
      const stillExists = await ctx.prisma.user.findUnique({
        where: { id: user.id },
      });
      expect(stillExists).not.toBeNull();
    });

    test("requires authentication", async () => {
      const trpcCtx = createTestTRPCContext({ prisma: ctx.prisma });
      const caller = appRouter.createCaller(trpcCtx);

      try {
        await caller.user.deleteAccount({ password: "SomePassword123" });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("UNAUTHORIZED");
      }
    });
  });
});
