import { describe, expect, test } from "bun:test";
import { isStripeConfigured, PLAN_SLUG_METADATA_KEY } from "./stripe";

describe("stripe utilities", () => {
  describe("isStripeConfigured", () => {
    test("returns boolean based on env var presence", () => {
      const result = isStripeConfigured();
      // Should return false in test environment (no real Stripe key)
      expect(typeof result).toBe("boolean");
    });
  });

  describe("PLAN_SLUG_METADATA_KEY", () => {
    test("is defined as expected", () => {
      expect(PLAN_SLUG_METADATA_KEY).toBe("plan_slug");
    });
  });
});
