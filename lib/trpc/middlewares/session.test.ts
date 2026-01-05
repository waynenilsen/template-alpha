import { afterEach, describe, expect, test } from "bun:test";
import {
  createMockSessionProvider,
  getSession,
  resetSessionProvider,
  type SessionData,
  setSessionProvider,
} from "./session";

describe("session provider", () => {
  afterEach(() => {
    resetSessionProvider();
  });

  test("setSessionProvider allows setting custom provider", async () => {
    const mockSession: SessionData = {
      id: "test-session-id",
      userId: "test-user-id",
      currentOrgId: "test-org-id",
      expiresAt: new Date(Date.now() + 3600000),
      user: {
        id: "test-user-id",
        email: "test@example.com",
        isAdmin: false,
      },
    };

    setSessionProvider({
      getSession: async () => mockSession,
    });

    const result = await getSession();
    expect(result).toEqual(mockSession);
  });

  test("setSessionProvider can return null", async () => {
    setSessionProvider({
      getSession: async () => null,
    });

    const result = await getSession();
    expect(result).toBeNull();
  });

  test("resetSessionProvider restores default behavior", async () => {
    const mockSession: SessionData = {
      id: "mock-id",
      userId: "mock-user",
      currentOrgId: null,
      expiresAt: new Date(),
      user: { id: "mock-user", email: "mock@test.com", isAdmin: false },
    };

    setSessionProvider({
      getSession: async () => mockSession,
    });

    // Verify mock is active
    expect(await getSession()).toEqual(mockSession);

    // Reset to default
    resetSessionProvider();

    // Default provider will try to read cookies which won't work in tests
    // So it should return null (cookies() throws in test environment)
    const result = await getSession();
    expect(result).toBeNull();
  });

  test("createMockSessionProvider creates provider with given session", async () => {
    const mockSession: SessionData = {
      id: "provider-test-id",
      userId: "provider-user-id",
      currentOrgId: "provider-org-id",
      expiresAt: new Date(Date.now() + 7200000),
      user: {
        id: "provider-user-id",
        email: "provider@example.com",
        isAdmin: true,
      },
    };

    const provider = createMockSessionProvider(mockSession);
    setSessionProvider(provider);

    const result = await getSession();
    expect(result).toEqual(mockSession);
  });

  test("createMockSessionProvider can create null provider", async () => {
    const provider = createMockSessionProvider(null);
    setSessionProvider(provider);

    const result = await getSession();
    expect(result).toBeNull();
  });
});
