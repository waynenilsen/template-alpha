import { describe, expect, test } from "bun:test";
import { render } from "@react-email/render";
import { InvitationEmail } from "./invitation";
import { PasswordResetEmail } from "./password-reset";
import { WelcomeEmail } from "./welcome";

describe("email templates", () => {
  describe("WelcomeEmail", () => {
    test("renders with default props", async () => {
      const html = await render(WelcomeEmail({}));

      expect(html).toContain("Welcome");
      expect(html).toContain("Template Alpha");
      expect(html).toContain("user@example.com");
    });

    test("renders with custom email", async () => {
      const html = await render(WelcomeEmail({ email: "custom@test.com" }));

      expect(html).toContain("custom@test.com");
    });

    test("renders with custom app name", async () => {
      const html = await render(WelcomeEmail({ appName: "My App" }));

      expect(html).toContain("My App");
    });

    test("renders with custom app URL", async () => {
      const html = await render(WelcomeEmail({ appUrl: "https://myapp.com" }));

      expect(html).toContain("https://myapp.com");
    });

    test("renders as plain text", async () => {
      const text = await render(WelcomeEmail({}), { plainText: true });

      // Plain text renders uppercase headers
      expect(text).toContain("WELCOME ABOARD");
    });

    test("includes dashboard link", async () => {
      const html = await render(
        WelcomeEmail({ appUrl: "https://example.com" }),
      );

      expect(html).toContain("https://example.com/dashboard");
    });

    test("includes feature list", async () => {
      const html = await render(WelcomeEmail({}));

      expect(html).toContain("What you can do");
      expect(html).toContain("task management");
      expect(html).toContain("Collaborate");
    });
  });

  describe("InvitationEmail", () => {
    test("renders with default props", async () => {
      const html = await render(InvitationEmail({}));

      expect(html).toContain("invited");
      expect(html).toContain("Acme Corp");
      expect(html).toContain("admin@acme.com");
    });

    test("renders with custom organization name", async () => {
      const html = await render(
        InvitationEmail({ organizationName: "Test Corp" }),
      );

      expect(html).toContain("Test Corp");
    });

    test("renders with custom inviter email", async () => {
      const html = await render(
        InvitationEmail({ invitedByEmail: "boss@company.com" }),
      );

      expect(html).toContain("boss@company.com");
    });

    test("renders with custom invite URL", async () => {
      const html = await render(
        InvitationEmail({ inviteUrl: "https://app.com/invite/xyz" }),
      );

      expect(html).toContain("https://app.com/invite/xyz");
    });

    test("renders with custom recipient email", async () => {
      const html = await render(
        InvitationEmail({ email: "newmember@test.com" }),
      );

      expect(html).toContain("newmember@test.com");
    });

    test("renders as plain text", async () => {
      const text = await render(InvitationEmail({}), { plainText: true });

      expect(text).toContain("invited");
    });

    test("includes expiration warning", async () => {
      const html = await render(InvitationEmail({}));

      expect(html).toContain("expire");
      expect(html).toContain("7 days");
    });

    test("includes accept button", async () => {
      const html = await render(InvitationEmail({}));

      expect(html).toContain("Accept Invitation");
    });
  });

  describe("PasswordResetEmail", () => {
    test("renders with default props", async () => {
      const html = await render(PasswordResetEmail({}));

      expect(html).toContain("Reset your password");
      expect(html).toContain("user@example.com");
    });

    test("renders with custom email", async () => {
      const html = await render(
        PasswordResetEmail({ email: "forgot@test.com" }),
      );

      expect(html).toContain("forgot@test.com");
    });

    test("renders with custom reset link", async () => {
      const html = await render(
        PasswordResetEmail({
          resetLink: "https://app.com/reset?token=abc123",
        }),
      );

      expect(html).toContain("https://app.com/reset?token=abc123");
    });

    test("renders with custom app name", async () => {
      const html = await render(PasswordResetEmail({ appName: "Custom App" }));

      expect(html).toContain("Custom App");
    });

    test("renders as plain text", async () => {
      const text = await render(PasswordResetEmail({}), { plainText: true });

      expect(text).toContain("Reset");
      expect(text).toContain("password");
    });

    test("includes expiration notice", async () => {
      const html = await render(PasswordResetEmail({}));

      expect(html).toContain("expire");
      expect(html).toContain("1 hour");
    });

    test("includes security warning", async () => {
      const html = await render(PasswordResetEmail({}));

      // HTML entities encode apostrophes
      expect(html).toContain("you can safely ignore this email");
    });

    test("includes reset button", async () => {
      const html = await render(PasswordResetEmail({}));

      expect(html).toContain("Reset Password");
    });

    test("includes fallback link text", async () => {
      const html = await render(PasswordResetEmail({}));

      // HTML entities encode apostrophes, check for plain words
      expect(html).toContain("copy and paste this link");
    });
  });
});
