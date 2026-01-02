import { describe, expect, test } from "bun:test";
import { render } from "@react-email/render";
import { WelcomeEmail } from "./welcome";

describe("WelcomeEmail template", () => {
  const defaultProps = {
    email: "test@example.com",
    appName: "Template Alpha",
    appUrl: "http://localhost:58665",
  };

  describe("HTML rendering", () => {
    test("renders to valid HTML", async () => {
      const html = await render(WelcomeEmail(defaultProps));

      expect(html).toContain("<!DOCTYPE html");
      expect(html).toContain("<html");
      expect(html).toContain("</html>");
    });

    test("includes user email in content", async () => {
      const html = await render(WelcomeEmail(defaultProps));

      expect(html).toContain("test@example.com");
    });

    test("includes app name in header and content", async () => {
      const html = await render(WelcomeEmail(defaultProps));

      expect(html).toContain("Template Alpha");
    });

    test("includes welcome heading", async () => {
      const html = await render(WelcomeEmail(defaultProps));

      expect(html).toContain("Welcome aboard");
    });

    test("includes get started button with correct link", async () => {
      const html = await render(WelcomeEmail(defaultProps));

      expect(html).toContain("Get Started");
      expect(html).toContain("http://localhost:58665/dashboard");
    });

    test("includes feature list", async () => {
      const html = await render(WelcomeEmail(defaultProps));

      expect(html).toContain("task management");
      expect(html).toContain("Collaborate");
      expect(html).toContain("Track progress");
    });

    test("includes footer with email", async () => {
      const html = await render(WelcomeEmail(defaultProps));

      expect(html).toContain("This email was sent to");
      expect(html).toContain("mailto:test@example.com");
    });

    test("includes preview text", async () => {
      const html = await render(WelcomeEmail(defaultProps));

      expect(html).toContain("Welcome to Template Alpha");
    });
  });

  describe("plain text rendering", () => {
    test("renders to plain text", async () => {
      const text = await render(WelcomeEmail(defaultProps), {
        plainText: true,
      });

      expect(text).not.toContain("<html");
      expect(text).not.toContain("<div");
      expect(text.length).toBeGreaterThan(0);
    });

    test("includes user email in plain text", async () => {
      const text = await render(WelcomeEmail(defaultProps), {
        plainText: true,
      });

      expect(text).toContain("test@example.com");
    });

    test("includes app name in plain text", async () => {
      const text = await render(WelcomeEmail(defaultProps), {
        plainText: true,
      });

      expect(text).toContain("Template Alpha");
    });

    test("includes welcome message in plain text", async () => {
      const text = await render(WelcomeEmail(defaultProps), {
        plainText: true,
      });

      expect(text.toLowerCase()).toContain("welcome");
    });
  });

  describe("custom props", () => {
    test("uses custom email", async () => {
      const html = await render(
        WelcomeEmail({ ...defaultProps, email: "custom@domain.com" }),
      );

      expect(html).toContain("custom@domain.com");
    });

    test("uses custom app name", async () => {
      const html = await render(
        WelcomeEmail({ ...defaultProps, appName: "My Custom App" }),
      );

      expect(html).toContain("My Custom App");
    });

    test("uses custom app URL in button link", async () => {
      const html = await render(
        WelcomeEmail({ ...defaultProps, appUrl: "https://myapp.com" }),
      );

      expect(html).toContain("https://myapp.com/dashboard");
    });
  });

  describe("default props", () => {
    test("uses default values when props are not provided", async () => {
      const html = await render(WelcomeEmail({}));

      expect(html).toContain("user@example.com");
      expect(html).toContain("Template Alpha");
      expect(html).toContain("http://localhost:58665");
    });
  });

  describe("styling", () => {
    test("includes inline styles", async () => {
      const html = await render(WelcomeEmail(defaultProps));

      expect(html).toContain("style=");
      expect(html).toContain("background-color");
    });

    test("uses brand colors", async () => {
      const html = await render(WelcomeEmail(defaultProps));

      // Primary dark color
      expect(html).toContain("#171717");
      // Background gray
      expect(html).toContain("#f6f6f6");
    });

    test("includes gradient bar styling", async () => {
      const html = await render(WelcomeEmail(defaultProps));

      expect(html).toContain("linear-gradient");
    });
  });
});
