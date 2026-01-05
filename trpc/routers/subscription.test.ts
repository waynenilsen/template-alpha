import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { Plan } from "../../lib/generated/prisma/client";
import {
  createMockSession,
  createTestContext,
  runWithSession,
  type TestContext,
} from "../../lib/test/harness";
import { createTestTRPCContext } from "../init";
import { appRouter } from "../router";

describe("subscription router", () => {
  let ctx: TestContext;
  let freePlan: Plan;
  let proPlan: Plan;

  beforeEach(async () => {
    ctx = createTestContext();

    // Create plans
    freePlan = await ctx.createPlan({
      slug: "free",
      name: "Free",
      description: "Free plan",
      priceMonthly: 0,
      priceYearly: null,
      limits: { maxTodos: 10, maxMembers: 1, maxOrganizations: 1 },
      isDefault: true,
      active: true,
      sortOrder: 0,
    });

    proPlan = await ctx.createPlan({
      slug: "pro",
      name: "Pro",
      description: "Pro plan",
      priceMonthly: 1200,
      priceYearly: 9600,
      limits: { maxTodos: 1000, maxMembers: 5, maxOrganizations: 3 },
      isDefault: false,
      active: true,
      sortOrder: 1,
      stripeProductId: "prod_test",
      stripePriceMonthlyId: "price_monthly_test",
      stripePriceYearlyId: "price_yearly_test",
    });
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  describe("getPlans", () => {
    test("returns all active plans", async () => {
      const trpcCtx = createTestTRPCContext({ prisma: ctx.prisma });
      const caller = appRouter.createCaller(trpcCtx);

      const plans = await caller.subscription.getPlans();

      expect(plans).toHaveLength(2);
      expect(plans[0].slug).toBe("free");
      expect(plans[1].slug).toBe("pro");
    });

    test("excludes inactive plans", async () => {
      // Create an inactive plan
      await ctx.createPlan({
        slug: "legacy",
        name: "Legacy",
        active: false,
      });

      const trpcCtx = createTestTRPCContext({ prisma: ctx.prisma });
      const caller = appRouter.createCaller(trpcCtx);

      const plans = await caller.subscription.getPlans();

      expect(plans).toHaveLength(2);
      expect(plans.find((p) => p.slug === "legacy")).toBeUndefined();
    });
  });

  describe("getCurrent", () => {
    test("returns current subscription with usage", async () => {
      const { user, organization } = await ctx.createUserWithOrg();
      const session = await ctx.signIn(user, organization.id);

      await ctx.createSubscription({
        organizationId: organization.id,
        planId: freePlan.id,
      });

      // Create some todos
      for (let i = 0; i < 3; i++) {
        await ctx.createTodo({
          organizationId: organization.id,
          createdById: user.id,
        });
      }

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
      });
      const caller = appRouter.createCaller(trpcCtx);

      const mockSession = createMockSession(session, {
        id: user.id,
        email: user.email,
        isAdmin: user.isAdmin,
      });

      const subscription = await runWithSession(mockSession, async () => {
        return caller.subscription.getCurrent();
      });

      expect(subscription.plan.slug).toBe("free");
      expect(subscription.status).toBe("active");
      expect(subscription.usage.todos.current).toBe(3);
      expect(subscription.usage.todos.limit).toBe(10);
    });

    test("creates subscription if none exists", async () => {
      const { user, organization } = await ctx.createUserWithOrg();
      const session = await ctx.signIn(user, organization.id);

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
      });
      const caller = appRouter.createCaller(trpcCtx);

      const mockSession = createMockSession(session, {
        id: user.id,
        email: user.email,
        isAdmin: user.isAdmin,
      });

      const subscription = await runWithSession(mockSession, async () => {
        return caller.subscription.getCurrent();
      });

      expect(subscription.plan.slug).toBe("free");
      expect(subscription.status).toBe("active");
    });

    test("requires org context", async () => {
      const { user } = await ctx.createUserWithOrg();
      const session = await ctx.signIn(user); // No org

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
      });
      const caller = appRouter.createCaller(trpcCtx);

      const mockSession = createMockSession(session, {
        id: user.id,
        email: user.email,
        isAdmin: user.isAdmin,
      });

      await expect(
        runWithSession(mockSession, async () => {
          return caller.subscription.getCurrent();
        }),
      ).rejects.toThrow("You must select an organization");
    });
  });

  describe("getUsage", () => {
    test("returns usage stats", async () => {
      const { user, organization } = await ctx.createUserWithOrg();
      const session = await ctx.signIn(user, organization.id);

      await ctx.createSubscription({
        organizationId: organization.id,
        planId: freePlan.id,
      });

      // Create todos
      for (let i = 0; i < 5; i++) {
        await ctx.createTodo({
          organizationId: organization.id,
          createdById: user.id,
        });
      }

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
      });
      const caller = appRouter.createCaller(trpcCtx);

      const mockSession = createMockSession(session, {
        id: user.id,
        email: user.email,
        isAdmin: user.isAdmin,
      });

      const usage = await runWithSession(mockSession, async () => {
        return caller.subscription.getUsage();
      });

      expect(usage.todos.current).toBe(5);
      expect(usage.todos.limit).toBe(10);
      expect(usage.members.current).toBe(1);
      expect(usage.members.limit).toBe(1);
    });
  });

  describe("createCheckout", () => {
    test("rejects if stripe not configured", async () => {
      const { user, organization } = await ctx.createUserWithOrg();
      const session = await ctx.signIn(user, organization.id);

      await ctx.createSubscription({
        organizationId: organization.id,
        planId: freePlan.id,
      });

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
      });
      const caller = appRouter.createCaller(trpcCtx);

      const mockSession = createMockSession(session, {
        id: user.id,
        email: user.email,
        isAdmin: user.isAdmin,
      });

      await expect(
        runWithSession(mockSession, async () => {
          return caller.subscription.createCheckout({
            planSlug: "pro",
            interval: "monthly",
            successUrl: "https://example.com/success",
            cancelUrl: "https://example.com/cancel",
          });
        }),
      ).rejects.toThrow("Stripe is not configured");
    });
  });

  describe("createBillingPortal", () => {
    test("rejects if stripe not configured", async () => {
      const { user, organization } = await ctx.createUserWithOrg();
      const session = await ctx.signIn(user, organization.id);

      await ctx.createSubscription({
        organizationId: organization.id,
        planId: freePlan.id,
        stripeCustomerId: "cus_test",
      });

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
      });
      const caller = appRouter.createCaller(trpcCtx);

      const mockSession = createMockSession(session, {
        id: user.id,
        email: user.email,
        isAdmin: user.isAdmin,
      });

      await expect(
        runWithSession(mockSession, async () => {
          return caller.subscription.createBillingPortal({
            returnUrl: "https://example.com/settings",
          });
        }),
      ).rejects.toThrow("Stripe is not configured");
    });
  });
});
