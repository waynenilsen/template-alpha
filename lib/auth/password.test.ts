import { describe, expect, test } from "bun:test";
import { hashPassword, validatePassword, verifyPassword } from "./password";

describe("password validation", () => {
  test("accepts valid password with all requirements", () => {
    const result = validatePassword("ValidPass123");
    expect(result).toEqual({ valid: true });
  });

  test("rejects password shorter than 8 characters", () => {
    const result = validatePassword("Short1A");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain("8 characters");
    }
  });

  test("rejects password without uppercase letter", () => {
    const result = validatePassword("lowercase123");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain("uppercase");
    }
  });

  test("rejects password without lowercase letter", () => {
    const result = validatePassword("UPPERCASE123");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain("lowercase");
    }
  });

  test("rejects password without number", () => {
    const result = validatePassword("NoNumbersHere");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain("number");
    }
  });

  test("accepts password with exactly 8 characters", () => {
    const result = validatePassword("Abcdefg1");
    expect(result).toEqual({ valid: true });
  });

  test("accepts long complex passwords", () => {
    const result = validatePassword("ThisIsAVeryLongAndSecurePassword123!");
    expect(result).toEqual({ valid: true });
  });
});

describe("password hashing", () => {
  test("hashes a password", async () => {
    const password = "SecurePass123";
    const hash = await hashPassword(password);

    expect(hash).toBeDefined();
    expect(hash).not.toBe(password);
    expect(hash.length).toBeGreaterThan(0);
  });

  test("produces different hashes for same password (salt)", async () => {
    const password = "SecurePass123";
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);

    expect(hash1).not.toBe(hash2);
  });

  test("produces different hashes for different passwords", async () => {
    const hash1 = await hashPassword("Password1");
    const hash2 = await hashPassword("Password2");

    expect(hash1).not.toBe(hash2);
  });
});

describe("password verification", () => {
  test("verifies correct password", async () => {
    const password = "SecurePass123";
    const hash = await hashPassword(password);

    const isValid = await verifyPassword(password, hash);
    expect(isValid).toBe(true);
  });

  test("rejects incorrect password", async () => {
    const password = "SecurePass123";
    const hash = await hashPassword(password);

    const isValid = await verifyPassword("WrongPassword1", hash);
    expect(isValid).toBe(false);
  });

  test("rejects password with different case", async () => {
    const password = "SecurePass123";
    const hash = await hashPassword(password);

    const isValid = await verifyPassword("securepass123", hash);
    expect(isValid).toBe(false);
  });

  test("handles empty password verification", async () => {
    const password = "SecurePass123";
    const hash = await hashPassword(password);

    const isValid = await verifyPassword("", hash);
    expect(isValid).toBe(false);
  });
});
