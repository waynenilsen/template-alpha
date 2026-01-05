import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  createTestContext,
  disconnectTestPrisma,
  type TestContext,
} from "../lib/test/harness";
import { runWithSession } from "../lib/test/harness/session-mock";
import { createTestTRPCContext } from "./init";
import { appRouter } from "./router";

describe("app router", () => {
  let ctx: TestContext;

  beforeAll(() => {
    ctx = createTestContext();
  });

  afterAll(async () => {
    await ctx.cleanup();
    await disconnectTestPrisma();
  });

  describe("health", () => {
    test("returns ok status", async () => {
      const trpcCtx = createTestTRPCContext({ prisma: ctx.prisma });
      const caller = appRouter.createCaller(trpcCtx);

      const result = await caller.health();

      expect(result.status).toBe("ok");
      expect(result.timestamp).toBeInstanceOf(Date);
    });
  });

  describe("greeting", () => {
    test("returns greeting with default name", async () => {
      const trpcCtx = createTestTRPCContext({ prisma: ctx.prisma });
      const caller = appRouter.createCaller(trpcCtx);

      const result = await caller.greeting({});

      expect(result.message).toBe("Hello, World!");
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    test("returns greeting with custom name", async () => {
      const trpcCtx = createTestTRPCContext({ prisma: ctx.prisma });
      const caller = appRouter.createCaller(trpcCtx);

      const result = await caller.greeting({ name: "Alice" });

      expect(result.message).toBe("Hello, Alice!");
    });
  });

  describe("stats", () => {
    test("returns platform statistics", async () => {
      const trpcCtx = createTestTRPCContext({ prisma: ctx.prisma });
      const caller = appRouter.createCaller(trpcCtx);

      const result = await runWithSession(null, async () => {
        return caller.stats();
      });

      expect(typeof result.totalUsers).toBe("number");
      expect(typeof result.totalTenants).toBe("number");
      expect(typeof result.totalTodos).toBe("number");
      expect(typeof result.completedTodos).toBe("number");
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    test("counts include test data", async () => {
      // Create some test data
      const { user, organization } = await ctx.createUserWithOrg();
      await ctx.createTodo({
        title: "Stats Test Todo",
        completed: true,
        organizationId: organization.id,
        createdById: user.id,
      });

      const trpcCtx = createTestTRPCContext({ prisma: ctx.prisma });
      const caller = appRouter.createCaller(trpcCtx);

      const result = await runWithSession(null, async () => {
        return caller.stats();
      });

      expect(result.totalUsers).toBeGreaterThanOrEqual(1);
      expect(result.totalTenants).toBeGreaterThanOrEqual(1);
      expect(result.totalTodos).toBeGreaterThanOrEqual(1);
      expect(result.completedTodos).toBeGreaterThanOrEqual(1);
    });
  });
});
