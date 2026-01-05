import { describe, expect, test } from "bun:test";
import { normalizeEmail } from "./email";

describe("normalizeEmail", () => {
  test("converts email to lowercase", () => {
    expect(normalizeEmail("User@Example.com")).toBe("user@example.com");
  });

  test("handles already lowercase email", () => {
    expect(normalizeEmail("user@example.com")).toBe("user@example.com");
  });

  test("handles all uppercase email", () => {
    expect(normalizeEmail("USER@EXAMPLE.COM")).toBe("user@example.com");
  });

  test("handles mixed case email", () => {
    expect(normalizeEmail("UsEr@ExAmPlE.CoM")).toBe("user@example.com");
  });

  test("preserves special characters", () => {
    expect(normalizeEmail("User.Name+Tag@Example.com")).toBe(
      "user.name+tag@example.com",
    );
  });

  test("handles email with numbers", () => {
    expect(normalizeEmail("User123@Example456.com")).toBe(
      "user123@example456.com",
    );
  });
});
