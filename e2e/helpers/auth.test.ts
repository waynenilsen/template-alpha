import { describe, expect, test } from "bun:test";
import {
  dashboardLocators,
  generateUniqueEmail,
  signupLocators,
  TEST_USER,
} from "./auth";

describe("auth helpers", () => {
  describe("TEST_USER constants", () => {
    test("has expected properties", () => {
      expect(TEST_USER.name).toBe("Test User");
      expect(TEST_USER.password).toBe("SecurePass123!");
      expect(TEST_USER.weakPassword).toBe("weak");
    });

    test("constants are readonly", () => {
      // TypeScript enforces this at compile time via `as const`
      // At runtime we just verify the values exist
      expect(Object.isFrozen(TEST_USER)).toBe(false); // as const doesn't freeze
      expect(typeof TEST_USER.name).toBe("string");
    });
  });

  describe("generateUniqueEmail", () => {
    test("generates email with default prefix", () => {
      const email = generateUniqueEmail();
      expect(email).toMatch(/^test-\d+-\d+@example\.com$/);
    });

    test("generates email with custom prefix", () => {
      const email = generateUniqueEmail("signup");
      expect(email).toMatch(/^signup-\d+-\d+@example\.com$/);
    });

    test("generates unique emails on successive calls", () => {
      const email1 = generateUniqueEmail();
      const email2 = generateUniqueEmail();
      // Even in the same millisecond, counter ensures uniqueness
      expect(email1).not.toBe(email2);
    });

    test("uses timestamp and counter for uniqueness", () => {
      const before = Date.now();
      const email = generateUniqueEmail();
      const after = Date.now();

      // Extract timestamp from email (format: prefix-timestamp-counter@domain)
      const match = email.match(/^test-(\d+)-\d+@example\.com$/);
      expect(match).not.toBeNull();

      const timestamp = Number.parseInt(match?.[1] ?? "0", 10);
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe("signupLocators", () => {
    test("has all expected locators", () => {
      expect(signupLocators.nameInput).toBe("signup-name-input");
      expect(signupLocators.emailInput).toBe("signup-email-input");
      expect(signupLocators.passwordInput).toBe("signup-password-input");
      expect(signupLocators.confirmPasswordInput).toBe(
        "signup-confirm-password-input",
      );
      expect(signupLocators.submitButton).toBe("signup-submit-button");
      expect(signupLocators.errorMessage).toBe("signup-error");
      expect(signupLocators.passwordMismatchError).toBe(
        "password-mismatch-error",
      );
      expect(signupLocators.signinLink).toBe("signin-link");
    });
  });

  describe("dashboardLocators", () => {
    test("has all expected locators", () => {
      expect(dashboardLocators.dashboard).toBe("dashboard");
      expect(dashboardLocators.dashboardTitle).toBe("dashboard-title");
    });
  });
});

// Note: fillSignupForm, submitSignupForm, fillAndSubmitSignupForm, waitForDashboard,
// and completeSignup require a Playwright Page object and are tested via e2e tests
