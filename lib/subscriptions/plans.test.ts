import { describe, expect, test } from "bun:test";
import {
  formatLimit,
  formatPrice,
  getActivePlans,
  getDefaultPlan,
  getPlanBySlug,
  PLANS,
} from "./plans";

describe("plan utility functions", () => {
  describe("getPlanBySlug", () => {
    test("returns plan when slug exists", () => {
      const plan = getPlanBySlug("free");

      expect(plan).toBeDefined();
      expect(plan?.slug).toBe("free");
      expect(plan?.name).toBe("Free");
    });

    test("returns undefined for non-existent slug", () => {
      const plan = getPlanBySlug("nonexistent");

      expect(plan).toBeUndefined();
    });
  });

  describe("getDefaultPlan", () => {
    test("returns the default plan", () => {
      const plan = getDefaultPlan();

      expect(plan).toBeDefined();
      expect(plan.isDefault).toBe(true);
      expect(plan.slug).toBe("free");
    });
  });

  describe("getActivePlans", () => {
    test("returns all active plans sorted by order", () => {
      const plans = getActivePlans();

      expect(plans.length).toBeGreaterThan(0);
      expect(plans.every((p) => p.active)).toBe(true);

      // Check sorting by order
      for (let i = 1; i < plans.length; i++) {
        expect(plans[i].order).toBeGreaterThanOrEqual(plans[i - 1].order);
      }
    });

    test("includes free, pro, and team plans", () => {
      const plans = getActivePlans();
      const slugs = plans.map((p) => p.slug);

      expect(slugs).toContain("free");
      expect(slugs).toContain("pro");
      expect(slugs).toContain("team");
    });
  });

  describe("formatPrice", () => {
    test("returns 'Free' for zero price", () => {
      expect(formatPrice(0)).toBe("Free");
    });

    test("formats whole dollar amounts without decimals", () => {
      expect(formatPrice(1200)).toBe("$12");
      expect(formatPrice(4900)).toBe("$49");
    });

    test("formats partial dollar amounts with decimals", () => {
      expect(formatPrice(1250)).toBe("$12.50");
      expect(formatPrice(999)).toBe("$9.99");
    });
  });

  describe("formatLimit", () => {
    test("returns 'Unlimited' for -1", () => {
      expect(formatLimit(-1)).toBe("Unlimited");
    });

    test("formats positive numbers with locale formatting", () => {
      expect(formatLimit(10)).toBe("10");
      expect(formatLimit(1000)).toBe("1,000");
      expect(formatLimit(1000000)).toBe("1,000,000");
    });
  });

  describe("PLANS configuration", () => {
    test("has exactly one default plan", () => {
      const defaultPlans = PLANS.filter((p) => p.isDefault);
      expect(defaultPlans).toHaveLength(1);
    });

    test("all slugs are unique", () => {
      const slugs = PLANS.map((p) => p.slug);
      const uniqueSlugs = new Set(slugs);
      expect(uniqueSlugs.size).toBe(slugs.length);
    });

    test("all plans have required fields", () => {
      for (const plan of PLANS) {
        expect(plan.slug).toBeTruthy();
        expect(plan.name).toBeTruthy();
        expect(plan.description).toBeTruthy();
        expect(typeof plan.priceMonthly).toBe("number");
        expect(plan.limits).toBeDefined();
        expect(typeof plan.limits.maxTodos).toBe("number");
        expect(typeof plan.limits.maxMembers).toBe("number");
        expect(typeof plan.limits.maxOrganizations).toBe("number");
        expect(Array.isArray(plan.features)).toBe(true);
      }
    });
  });
});
