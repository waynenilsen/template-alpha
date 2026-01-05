import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { TRPCError } from "@trpc/server";
import {
  createTestContext,
  disconnectTestPrisma,
  type TestContext,
} from "../../lib/test/harness";
import { createTestTRPCContext } from "../init";
import { appRouter } from "../router";

describe("admin router", () => {
  let ctx: TestContext;

  beforeAll(() => {
    ctx = createTestContext();
  });

  afterAll(async () => {
    await ctx.cleanup();
    await disconnectTestPrisma();
  });

  describe("dashboard", () => {
    test("requires authentication", async () => {
      const trpcCtx = createTestTRPCContext({ prisma: ctx.prisma });
      const caller = appRouter.createCaller(trpcCtx);

      try {
        await caller.admin.dashboard();
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("UNAUTHORIZED");
      }
    });

    test("requires admin privileges", async () => {
      const user = await ctx.createUser({ isAdmin: false });
      const session = await ctx.createSession({ userId: user.id });

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
      });
      const caller = appRouter.createCaller(trpcCtx);

      try {
        await caller.admin.dashboard();
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("FORBIDDEN");
        expect((error as TRPCError).message).toBe("Admin access required");
      }
    });

    test("returns dashboard stats for admin users", async () => {
      const adminUser = await ctx.createUser({ isAdmin: true });
      const session = await ctx.createSession({ userId: adminUser.id });

      // Create some test data
      const { user: regularUser, organization } = await ctx.createUserWithOrg();
      await ctx.createOrganization();
      await ctx.createTodo({
        organizationId: organization.id,
        createdById: regularUser.id,
        completed: false,
      });
      await ctx.createTodo({
        organizationId: organization.id,
        createdById: regularUser.id,
        completed: true,
      });

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: {
          id: adminUser.id,
          email: adminUser.email,
          isAdmin: adminUser.isAdmin,
        },
      });
      const caller = appRouter.createCaller(trpcCtx);

      const result = await caller.admin.dashboard();

      // Verify stats structure
      expect(result.stats).toBeDefined();
      expect(typeof result.stats.totalUsers).toBe("number");
      expect(typeof result.stats.totalOrganizations).toBe("number");
      expect(typeof result.stats.totalTodos).toBe("number");
      expect(typeof result.stats.completedTodos).toBe("number");
      expect(typeof result.stats.completionRate).toBe("number");

      // Stats should include test data
      expect(result.stats.totalUsers).toBeGreaterThanOrEqual(2); // admin + regular user
      expect(result.stats.totalOrganizations).toBeGreaterThanOrEqual(2); // org + anotherOrg
      expect(result.stats.totalTodos).toBeGreaterThanOrEqual(2);
      expect(result.stats.completedTodos).toBeGreaterThanOrEqual(1);

      // Verify recent users structure
      expect(Array.isArray(result.recentUsers)).toBe(true);
      expect(result.recentUsers.length).toBeLessThanOrEqual(5);
      if (result.recentUsers.length > 0) {
        const recentUser = result.recentUsers[0];
        expect(recentUser.id).toBeDefined();
        expect(recentUser.email).toBeDefined();
        expect(typeof recentUser.isAdmin).toBe("boolean");
        expect(recentUser.createdAt).toBeDefined();
      }

      // Verify recent organizations structure
      expect(Array.isArray(result.recentOrganizations)).toBe(true);
      expect(result.recentOrganizations.length).toBeLessThanOrEqual(5);
      if (result.recentOrganizations.length > 0) {
        const recentOrg = result.recentOrganizations[0];
        expect(recentOrg.id).toBeDefined();
        expect(recentOrg.name).toBeDefined();
        expect(recentOrg.slug).toBeDefined();
        expect(typeof recentOrg.memberCount).toBe("number");
        expect(recentOrg.createdAt).toBeDefined();
      }
    });

    test("calculates completion rate correctly", async () => {
      const adminUser = await ctx.createUser({ isAdmin: true });
      const session = await ctx.createSession({ userId: adminUser.id });

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: {
          id: adminUser.id,
          email: adminUser.email,
          isAdmin: adminUser.isAdmin,
        },
      });
      const caller = appRouter.createCaller(trpcCtx);

      const result = await caller.admin.dashboard();

      // Verify completion rate is a valid percentage
      expect(result.stats.completionRate).toBeGreaterThanOrEqual(0);
      expect(result.stats.completionRate).toBeLessThanOrEqual(100);

      // Verify rate calculation (if there are todos)
      if (result.stats.totalTodos > 0) {
        const expectedRate = Math.round(
          (result.stats.completedTodos / result.stats.totalTodos) * 100,
        );
        expect(result.stats.completionRate).toBe(expectedRate);
      }
    });
  });
});
