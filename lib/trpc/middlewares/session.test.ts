import { describe, expect, test } from "bun:test";
import { getSession, runWithSession, type SessionData } from "./session";

describe("session provider with AsyncLocalStorage", () => {
  test("getSession returns null when not in runWithSession context", async () => {
    // Outside of runWithSession, and without Next.js cookies available,
    // getSession should return null
    const result = await getSession();
    expect(result).toBeNull();
  });

  test("runWithSession provides session to getSession", async () => {
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

    const result = await runWithSession(mockSession, async () => {
      return await getSession();
    });

    expect(result).toEqual(mockSession);
  });

  test("runWithSession can provide null session", async () => {
    const result = await runWithSession(null, async () => {
      return await getSession();
    });

    expect(result).toBeNull();
  });

  test("runWithSession isolates session between nested calls", async () => {
    const outerSession: SessionData = {
      id: "outer-session",
      userId: "outer-user",
      currentOrgId: "outer-org",
      expiresAt: new Date(Date.now() + 3600000),
      user: { id: "outer-user", email: "outer@test.com", isAdmin: false },
    };

    const innerSession: SessionData = {
      id: "inner-session",
      userId: "inner-user",
      currentOrgId: "inner-org",
      expiresAt: new Date(Date.now() + 3600000),
      user: { id: "inner-user", email: "inner@test.com", isAdmin: true },
    };

    const results = await runWithSession(outerSession, async () => {
      const beforeInner = await getSession();

      const innerResult = await runWithSession(innerSession, async () => {
        return await getSession();
      });

      const afterInner = await getSession();

      return { beforeInner, innerResult, afterInner };
    });

    expect(results.beforeInner).toEqual(outerSession);
    expect(results.innerResult).toEqual(innerSession);
    expect(results.afterInner).toEqual(outerSession);
  });

  test("runWithSession supports synchronous functions", () => {
    const mockSession: SessionData = {
      id: "sync-session",
      userId: "sync-user",
      currentOrgId: null,
      expiresAt: new Date(),
      user: { id: "sync-user", email: "sync@test.com", isAdmin: false },
    };

    // runWithSession returns the function's return value synchronously
    const result = runWithSession(mockSession, () => {
      return "sync-result";
    });

    expect(result).toBe("sync-result");
  });

  test("parallel runWithSession calls are isolated", async () => {
    const session1: SessionData = {
      id: "session-1",
      userId: "user-1",
      currentOrgId: "org-1",
      expiresAt: new Date(Date.now() + 3600000),
      user: { id: "user-1", email: "user1@test.com", isAdmin: false },
    };

    const session2: SessionData = {
      id: "session-2",
      userId: "user-2",
      currentOrgId: "org-2",
      expiresAt: new Date(Date.now() + 3600000),
      user: { id: "user-2", email: "user2@test.com", isAdmin: true },
    };

    // Run both in parallel
    const [result1, result2] = await Promise.all([
      runWithSession(session1, async () => {
        // Add a small delay to ensure overlap
        await new Promise((resolve) => setTimeout(resolve, 10));
        return await getSession();
      }),
      runWithSession(session2, async () => {
        // Add a small delay to ensure overlap
        await new Promise((resolve) => setTimeout(resolve, 10));
        return await getSession();
      }),
    ]);

    // Each should have its own session despite running in parallel
    expect(result1).toEqual(session1);
    expect(result2).toEqual(session2);
  });
});
