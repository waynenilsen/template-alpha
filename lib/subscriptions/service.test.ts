import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { Plan, Subscription } from "../generated/prisma/client";
import { createTestContext, type TestContext } from "../test/harness";
import {
  checkMemberLimit,
  checkOrganizationLimit,
  checkTodoLimit,
  enforceMemberLimit,
  enforceOrganizationLimit,
  enforceTodoLimit,
  getOrCreateSubscription,
  getUsageStats,
  LimitExceededError,
  SubscriptionError,
} from "./service";

describe("subscription service", () => {
  let ctx: TestContext;
  let freePlan: Plan;

  beforeEach(async () => {
    ctx = createTestContext();
    // Create a default free plan
    freePlan = await ctx.createPlan({
      slug: "free",
      name: "Free",
      description: "Free plan",
      priceMonthly: 0,
      priceYearly: null,
      limits: { maxTodos: 10, maxMembers: 1, maxOrganizations: 1 },
      isDefault: true,
      active: true,
    });
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  describe("getOrCreateSubscription", () => {
    test("creates subscription for org without one", async () => {
      const { organization } = await ctx.createUserWithOrg();

      const subscription = await getOrCreateSubscription(
        ctx.prisma,
        organization.id,
      );

      expect(subscription).toBeDefined();
      expect(subscription.organizationId).toBe(organization.id);
      expect(subscription.planId).toBe(freePlan.id);
      expect(subscription.status).toBe("active");
    });

    test("returns existing subscription", async () => {
      const { organization } = await ctx.createUserWithOrg();

      // Create subscription manually
      const existingSub = await ctx.createSubscription({
        organizationId: organization.id,
        planId: freePlan.id,
      });

      const subscription = await getOrCreateSubscription(
        ctx.prisma,
        organization.id,
      );

      expect(subscription.id).toBe(existingSub.id);
    });

    test("throws if no default plan exists", async () => {
      // Delete the free plan
      await ctx.prisma.plan.delete({ where: { id: freePlan.id } });
      ctx.planIds.delete(freePlan.id);

      const { organization } = await ctx.createUserWithOrg();

      await expect(
        getOrCreateSubscription(ctx.prisma, organization.id),
      ).rejects.toThrow(SubscriptionError);
    });
  });

  describe("checkTodoLimit", () => {
    test("allows creation when under limit", async () => {
      const { organization, user } = await ctx.createUserWithOrg();
      await ctx.createSubscription({
        organizationId: organization.id,
        planId: freePlan.id,
      });

      // Create 5 todos (under 10 limit)
      for (let i = 0; i < 5; i++) {
        await ctx.createTodo({
          organizationId: organization.id,
          createdById: user.id,
        });
      }

      const result = await checkTodoLimit(ctx.prisma, organization.id);

      expect(result.allowed).toBe(true);
      expect(result.current).toBe(5);
      expect(result.limit).toBe(10);
    });

    test("disallows creation at limit", async () => {
      const { organization, user } = await ctx.createUserWithOrg();
      await ctx.createSubscription({
        organizationId: organization.id,
        planId: freePlan.id,
      });

      // Create 10 todos (at limit)
      for (let i = 0; i < 10; i++) {
        await ctx.createTodo({
          organizationId: organization.id,
          createdById: user.id,
        });
      }

      const result = await checkTodoLimit(ctx.prisma, organization.id);

      expect(result.allowed).toBe(false);
      expect(result.current).toBe(10);
      expect(result.limit).toBe(10);
    });

    test("allows unlimited todos with unlimited plan", async () => {
      const { organization, user } = await ctx.createUserWithOrg();

      const unlimitedPlan = await ctx.createPlan({
        slug: "unlimited",
        name: "Unlimited",
        limits: { maxTodos: -1, maxMembers: -1, maxOrganizations: -1 },
      });

      await ctx.createSubscription({
        organizationId: organization.id,
        planId: unlimitedPlan.id,
      });

      // Create lots of todos
      for (let i = 0; i < 100; i++) {
        await ctx.createTodo({
          organizationId: organization.id,
          createdById: user.id,
        });
      }

      const result = await checkTodoLimit(ctx.prisma, organization.id);

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(-1);
    });
  });

  describe("checkMemberLimit", () => {
    test("allows adding member when under limit", async () => {
      const { organization } = await ctx.createUserWithOrg();
      await ctx.createSubscription({
        organizationId: organization.id,
        planId: freePlan.id,
      });

      const result = await checkMemberLimit(ctx.prisma, organization.id);

      // Already has 1 member (owner), limit is 1 so can't add more
      expect(result.allowed).toBe(false);
      expect(result.current).toBe(1);
      expect(result.limit).toBe(1);
    });

    test("allows more members with higher plan", async () => {
      const { organization } = await ctx.createUserWithOrg();

      const proPlan = await ctx.createPlan({
        slug: "pro",
        name: "Pro",
        limits: { maxTodos: 1000, maxMembers: 5, maxOrganizations: 3 },
        priceMonthly: 1200,
      });

      await ctx.createSubscription({
        organizationId: organization.id,
        planId: proPlan.id,
      });

      const result = await checkMemberLimit(ctx.prisma, organization.id);

      expect(result.allowed).toBe(true);
      expect(result.current).toBe(1);
      expect(result.limit).toBe(5);
    });
  });

  describe("checkOrganizationLimit", () => {
    test("disallows creating more orgs on free plan", async () => {
      const { user, organization } = await ctx.createUserWithOrg();
      await ctx.createSubscription({
        organizationId: organization.id,
        planId: freePlan.id,
      });

      const result = await checkOrganizationLimit(ctx.prisma, user.id);

      expect(result.allowed).toBe(false);
      expect(result.current).toBe(1);
      expect(result.limit).toBe(1);
    });

    test("allows more orgs with higher plan", async () => {
      const { user, organization } = await ctx.createUserWithOrg();

      const proPlan = await ctx.createPlan({
        slug: "pro",
        name: "Pro",
        limits: { maxTodos: 1000, maxMembers: 5, maxOrganizations: 3 },
        priceMonthly: 1200,
      });

      await ctx.createSubscription({
        organizationId: organization.id,
        planId: proPlan.id,
      });

      const result = await checkOrganizationLimit(ctx.prisma, user.id);

      expect(result.allowed).toBe(true);
      expect(result.current).toBe(1);
      expect(result.limit).toBe(3);
    });
  });

  describe("getUsageStats", () => {
    test("returns correct usage stats", async () => {
      const { organization, user } = await ctx.createUserWithOrg();
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

      const stats = await getUsageStats(ctx.prisma, organization.id);

      expect(stats.todos.current).toBe(3);
      expect(stats.todos.limit).toBe(10);
      expect(stats.members.current).toBe(1);
      expect(stats.members.limit).toBe(1);
    });
  });

  describe("LimitExceededError", () => {
    test("has correct properties", () => {
      const error = new LimitExceededError("maxTodos", 10, 10, "Free");

      expect(error.limitType).toBe("maxTodos");
      expect(error.current).toBe(10);
      expect(error.limit).toBe(10);
      expect(error.planName).toBe("Free");
      expect(error.message).toContain("maxTodos limit exceeded");
    });

    test("shows unlimited in message for -1 limit", () => {
      const error = new LimitExceededError("maxTodos", 100, -1, "Team");

      expect(error.message).toContain("unlimited");
    });
  });

  describe("enforceTodoLimit", () => {
    test("does not throw when under limit", async () => {
      const { organization, user } = await ctx.createUserWithOrg();
      await ctx.createSubscription({
        organizationId: organization.id,
        planId: freePlan.id,
      });

      // Create 5 todos (under 10 limit)
      for (let i = 0; i < 5; i++) {
        await ctx.createTodo({
          organizationId: organization.id,
          createdById: user.id,
        });
      }

      // Should not throw
      await expect(
        enforceTodoLimit(ctx.prisma, organization.id),
      ).resolves.toBeUndefined();
    });

    test("throws LimitExceededError at limit", async () => {
      const { organization, user } = await ctx.createUserWithOrg();
      await ctx.createSubscription({
        organizationId: organization.id,
        planId: freePlan.id,
      });

      // Create 10 todos (at limit)
      for (let i = 0; i < 10; i++) {
        await ctx.createTodo({
          organizationId: organization.id,
          createdById: user.id,
        });
      }

      await expect(
        enforceTodoLimit(ctx.prisma, organization.id),
      ).rejects.toThrow(LimitExceededError);
    });
  });

  describe("enforceMemberLimit", () => {
    test("throws LimitExceededError when at limit", async () => {
      const { organization } = await ctx.createUserWithOrg();
      await ctx.createSubscription({
        organizationId: organization.id,
        planId: freePlan.id,
      });

      // Free plan has maxMembers: 1, and org already has 1 member (owner)
      await expect(
        enforceMemberLimit(ctx.prisma, organization.id),
      ).rejects.toThrow(LimitExceededError);
    });

    test("does not throw when under limit", async () => {
      const { organization } = await ctx.createUserWithOrg();

      const proPlan = await ctx.createPlan({
        slug: "pro-enforce",
        name: "Pro",
        limits: { maxTodos: 1000, maxMembers: 5, maxOrganizations: 3 },
        priceMonthly: 1200,
      });

      await ctx.createSubscription({
        organizationId: organization.id,
        planId: proPlan.id,
      });

      // Should not throw with 1 member and limit of 5
      await expect(
        enforceMemberLimit(ctx.prisma, organization.id),
      ).resolves.toBeUndefined();
    });
  });

  describe("enforceOrganizationLimit", () => {
    test("throws LimitExceededError when at limit", async () => {
      const { user, organization } = await ctx.createUserWithOrg();
      await ctx.createSubscription({
        organizationId: organization.id,
        planId: freePlan.id,
      });

      // Free plan has maxOrganizations: 1, user already owns 1
      await expect(
        enforceOrganizationLimit(ctx.prisma, user.id),
      ).rejects.toThrow(LimitExceededError);
    });

    test("does not throw when under limit", async () => {
      const { user, organization } = await ctx.createUserWithOrg();

      const proPlan = await ctx.createPlan({
        slug: "pro-org-enforce",
        name: "Pro",
        limits: { maxTodos: 1000, maxMembers: 5, maxOrganizations: 3 },
        priceMonthly: 1200,
      });

      await ctx.createSubscription({
        organizationId: organization.id,
        planId: proPlan.id,
      });

      // Should not throw with 1 org and limit of 3
      await expect(
        enforceOrganizationLimit(ctx.prisma, user.id),
      ).resolves.toBeUndefined();
    });
  });

  describe("checkOrganizationLimit with unlimited plan", () => {
    test("allows unlimited organizations with -1 limit", async () => {
      const { user, organization } = await ctx.createUserWithOrg();

      const unlimitedPlan = await ctx.createPlan({
        slug: "unlimited-orgs",
        name: "Unlimited",
        limits: { maxTodos: -1, maxMembers: -1, maxOrganizations: -1 },
      });

      await ctx.createSubscription({
        organizationId: organization.id,
        planId: unlimitedPlan.id,
      });

      const result = await checkOrganizationLimit(ctx.prisma, user.id);

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(-1);
    });
  });

  describe("checkMemberLimit with unlimited plan", () => {
    test("allows unlimited members with -1 limit", async () => {
      const { organization } = await ctx.createUserWithOrg();

      const unlimitedPlan = await ctx.createPlan({
        slug: "unlimited-members",
        name: "Unlimited",
        limits: { maxTodos: -1, maxMembers: -1, maxOrganizations: -1 },
      });

      await ctx.createSubscription({
        organizationId: organization.id,
        planId: unlimitedPlan.id,
      });

      const result = await checkMemberLimit(ctx.prisma, organization.id);

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(-1);
    });
  });
});
