import { describe, expect, mock, test } from "bun:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { UserSettingsForm } from "./user-settings-form";

describe("UserSettingsForm", () => {
  describe("rendering", () => {
    test("renders with initial name", () => {
      const html = renderToString(
        createElement(UserSettingsForm, {
          initialName: "John Doe",
          email: "john@example.com",
        }),
      );

      expect(html).toContain("Profile Settings");
      expect(html).toContain("john@example.com");
      expect(html).toContain('value="John Doe"');
    });

    test("renders with empty initial name", () => {
      const html = renderToString(
        createElement(UserSettingsForm, {
          email: "user@example.com",
        }),
      );

      expect(html).toContain("user@example.com");
      expect(html).toContain('value=""');
    });

    test("renders email as disabled", () => {
      const html = renderToString(
        createElement(UserSettingsForm, {
          email: "test@example.com",
        }),
      );

      expect(html).toContain("disabled");
      expect(html).toContain("Email cannot be changed");
    });

    test("renders error message when error is provided", () => {
      const html = renderToString(
        createElement(UserSettingsForm, {
          error: "Something went wrong",
        }),
      );

      expect(html).toContain("Something went wrong");
      expect(html).toContain("settings-error");
    });

    test("renders success message when success is true", () => {
      const html = renderToString(
        createElement(UserSettingsForm, {
          success: true,
        }),
      );

      expect(html).toContain("Profile updated successfully");
      expect(html).toContain("settings-success");
    });

    test("renders loading state", () => {
      const html = renderToString(
        createElement(UserSettingsForm, {
          isLoading: true,
        }),
      );

      expect(html).toContain("Saving...");
    });

    test("submit button is disabled when loading", () => {
      const html = renderToString(
        createElement(UserSettingsForm, {
          isLoading: true,
        }),
      );

      expect(html).toContain('disabled=""');
    });

    test("includes all required data-testid attributes", () => {
      const html = renderToString(
        createElement(UserSettingsForm, {
          initialName: "Test",
          email: "test@example.com",
        }),
      );

      expect(html).toContain("settings-email-input");
      expect(html).toContain("settings-name-input");
      expect(html).toContain("settings-submit-button");
    });
  });

  describe("props", () => {
    test("accepts onSubmit callback", () => {
      const onSubmit = mock(() => {});
      const html = renderToString(
        createElement(UserSettingsForm, {
          onSubmit,
        }),
      );

      expect(html).toBeDefined();
    });

    test("renders save button text when not loading", () => {
      const html = renderToString(
        createElement(UserSettingsForm, {
          isLoading: false,
        }),
      );

      expect(html).toContain("Save Changes");
    });
  });
});
