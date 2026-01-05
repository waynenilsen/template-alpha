import { describe, expect, mock, test } from "bun:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { ChangePasswordForm } from "./change-password-form";

describe("ChangePasswordForm", () => {
  describe("rendering", () => {
    test("renders form with all password fields", () => {
      const html = renderToString(createElement(ChangePasswordForm, {}));

      expect(html).toContain("Change Password");
      expect(html).toContain("Current Password");
      expect(html).toContain("New Password");
      expect(html).toContain("Confirm New Password");
    });

    test("renders password requirements hint", () => {
      const html = renderToString(createElement(ChangePasswordForm, {}));

      expect(html).toContain("at least 8 characters");
      expect(html).toContain("uppercase");
      expect(html).toContain("lowercase");
      expect(html).toContain("number");
    });

    test("renders error message when error is provided", () => {
      const html = renderToString(
        createElement(ChangePasswordForm, {
          error: "Current password is incorrect",
        }),
      );

      expect(html).toContain("Current password is incorrect");
      expect(html).toContain("password-error");
    });

    test("renders success message when success is true", () => {
      const html = renderToString(
        createElement(ChangePasswordForm, {
          success: true,
        }),
      );

      expect(html).toContain("Password changed successfully");
      expect(html).toContain("password-success");
    });

    test("renders loading state", () => {
      const html = renderToString(
        createElement(ChangePasswordForm, {
          isLoading: true,
        }),
      );

      expect(html).toContain("Changing...");
    });

    test("renders button text when not loading", () => {
      const html = renderToString(
        createElement(ChangePasswordForm, {
          isLoading: false,
        }),
      );

      expect(html).toContain("Change Password");
    });

    test("all inputs have type password", () => {
      const html = renderToString(createElement(ChangePasswordForm, {}));

      // Should have 3 password inputs
      const passwordMatches = html.match(/type="password"/g);
      expect(passwordMatches).toHaveLength(3);
    });

    test("includes all required data-testid attributes", () => {
      const html = renderToString(createElement(ChangePasswordForm, {}));

      expect(html).toContain("password-current-input");
      expect(html).toContain("password-new-input");
      expect(html).toContain("password-confirm-input");
      expect(html).toContain("password-submit-button");
    });

    test("inputs are disabled when loading", () => {
      const html = renderToString(
        createElement(ChangePasswordForm, {
          isLoading: true,
        }),
      );

      // Check that disabled attribute appears multiple times
      const disabledMatches = html.match(/disabled=""/g);
      expect(disabledMatches).not.toBeNull();
      expect(disabledMatches?.length ?? 0).toBeGreaterThanOrEqual(3);
    });
  });

  describe("props", () => {
    test("accepts onSubmit callback", () => {
      const onSubmit = mock(() => {});
      const html = renderToString(
        createElement(ChangePasswordForm, {
          onSubmit,
        }),
      );

      expect(html).toBeDefined();
    });

    test("renders card description", () => {
      const html = renderToString(createElement(ChangePasswordForm, {}));

      expect(html).toContain("keep your account secure");
    });
  });
});
