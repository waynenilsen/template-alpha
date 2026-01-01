import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import {
  createTestContext,
  disconnectTestPrisma,
  type TestContext,
} from "../test";
import {
  cleanupExpiredSessions,
  createSession,
  deleteSession,
  deleteUserSessions,
  getSessionById,
  getSessionWithUser,
  getUserSessions,
  refreshSession,
  switchOrganization,
} from "./session";

describe("session management", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  describe("createSession", () => {
    test("creates a session for a user", async () => {
      const user = await ctx.createUser();

      const session = await createSession(ctx.prisma, user.id);
      ctx.sessionIds.add(session.id);

      expect(session.id).toBeDefined();
      expect(session.userId).toBe(user.id);
      expect(session.currentOrgId).toBeNull();
      expect(session.expiresAt).toBeInstanceOf(Date);
      expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    test("creates a session with organization context", async () => {
      const { user, organization } = await ctx.createUserWithOrg();

      const session = await createSession(ctx.prisma, user.id, organization.id);
      ctx.sessionIds.add(session.id);

      expect(session.currentOrgId).toBe(organization.id);
    });

    test("session expires in approximately 7 days", async () => {
      const user = await ctx.createUser();

      const beforeCreate = Date.now();
      const session = await createSession(ctx.prisma, user.id);
      ctx.sessionIds.add(session.id);
      const afterCreate = Date.now();

      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      const expiresAtMs = session.expiresAt.getTime();

      expect(expiresAtMs).toBeGreaterThanOrEqual(beforeCreate + sevenDaysMs);
      expect(expiresAtMs).toBeLessThanOrEqual(afterCreate + sevenDaysMs + 1000);
    });
  });

  describe("getSessionById", () => {
    test("retrieves an existing session", async () => {
      const user = await ctx.createUser();
      const session = await ctx.createSession({ userId: user.id });

      const retrieved = await getSessionById(ctx.prisma, session.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(session.id);
      expect(retrieved?.userId).toBe(user.id);
    });

    test("returns null for non-existent session", async () => {
      const retrieved = await getSessionById(ctx.prisma, "non-existent-id");

      expect(retrieved).toBeNull();
    });

    test("returns null for expired session and cleans it up", async () => {
      const user = await ctx.createUser();
      const expiredSession = await ctx.createSession({
        userId: user.id,
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      });

      const retrieved = await getSessionById(ctx.prisma, expiredSession.id);

      expect(retrieved).toBeNull();

      // Session should be cleaned up
      const stillExists = await ctx.prisma.session.findUnique({
        where: { id: expiredSession.id },
      });
      expect(stillExists).toBeNull();
      ctx.sessionIds.delete(expiredSession.id);
    });
  });

  describe("getSessionWithUser", () => {
    test("retrieves session with user data", async () => {
      const user = await ctx.createUser({ isAdmin: true });
      const session = await ctx.createSession({ userId: user.id });

      const retrieved = await getSessionWithUser(ctx.prisma, session.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.user.id).toBe(user.id);
      expect(retrieved?.user.email).toBe(user.email);
      expect(retrieved?.user.isAdmin).toBe(true);
    });

    test("returns null for expired session", async () => {
      const user = await ctx.createUser();
      const expiredSession = await ctx.createSession({
        userId: user.id,
        expiresAt: new Date(Date.now() - 1000),
      });

      const retrieved = await getSessionWithUser(ctx.prisma, expiredSession.id);

      expect(retrieved).toBeNull();
      ctx.sessionIds.delete(expiredSession.id);
    });
  });

  describe("refreshSession", () => {
    test("updates last accessed time", async () => {
      const user = await ctx.createUser();
      const session = await ctx.createSession({ userId: user.id });

      // Wait a bit to ensure time difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      const refreshed = await refreshSession(ctx.prisma, session.id);

      expect(refreshed).not.toBeNull();
      expect(refreshed?.lastAccessedAt.getTime()).toBeGreaterThan(
        session.lastAccessedAt.getTime(),
      );
    });

    test("returns null for non-existent session", async () => {
      const refreshed = await refreshSession(ctx.prisma, "non-existent-id");

      expect(refreshed).toBeNull();
    });
  });

  describe("deleteSession", () => {
    test("deletes an existing session", async () => {
      const user = await ctx.createUser();
      const session = await ctx.createSession({ userId: user.id });

      const result = await deleteSession(ctx.prisma, session.id);
      ctx.sessionIds.delete(session.id);

      expect(result).toBe(true);

      const found = await ctx.prisma.session.findUnique({
        where: { id: session.id },
      });
      expect(found).toBeNull();
    });

    test("returns false for non-existent session", async () => {
      const result = await deleteSession(ctx.prisma, "non-existent-id");

      expect(result).toBe(false);
    });
  });

  describe("deleteUserSessions", () => {
    test("deletes all sessions for a user", async () => {
      const user = await ctx.createUser();
      const session1 = await ctx.createSession({ userId: user.id });
      const session2 = await ctx.createSession({ userId: user.id });
      const session3 = await ctx.createSession({ userId: user.id });

      const count = await deleteUserSessions(ctx.prisma, user.id);
      ctx.sessionIds.delete(session1.id);
      ctx.sessionIds.delete(session2.id);
      ctx.sessionIds.delete(session3.id);

      expect(count).toBe(3);

      const remaining = await ctx.prisma.session.findMany({
        where: { userId: user.id },
      });
      expect(remaining).toHaveLength(0);
    });

    test("only deletes sessions for specified user", async () => {
      const user1 = await ctx.createUser();
      const user2 = await ctx.createUser();
      const session1 = await ctx.createSession({ userId: user1.id });
      const session2 = await ctx.createSession({ userId: user2.id });

      await deleteUserSessions(ctx.prisma, user1.id);
      ctx.sessionIds.delete(session1.id);

      const remaining = await ctx.prisma.session.findUnique({
        where: { id: session2.id },
      });
      expect(remaining).not.toBeNull();
    });
  });

  describe("switchOrganization", () => {
    test("switches organization context", async () => {
      const { user, organization: org1 } = await ctx.createUserWithOrg();
      const org2 = await ctx.createOrganization();
      await ctx.createMembership({
        userId: user.id,
        organizationId: org2.id,
        role: "member",
      });

      const session = await ctx.createSession({
        userId: user.id,
        currentOrgId: org1.id,
      });

      const updated = await switchOrganization(ctx.prisma, session.id, org2.id);

      expect(updated).not.toBeNull();
      expect(updated?.currentOrgId).toBe(org2.id);
    });

    test("clears organization context when null", async () => {
      const { user, organization } = await ctx.createUserWithOrg();
      const session = await ctx.createSession({
        userId: user.id,
        currentOrgId: organization.id,
      });

      const updated = await switchOrganization(ctx.prisma, session.id, null);

      expect(updated).not.toBeNull();
      expect(updated?.currentOrgId).toBeNull();
    });

    test("returns null for non-existent session", async () => {
      const org = await ctx.createOrganization();
      const updated = await switchOrganization(
        ctx.prisma,
        "non-existent-id",
        org.id,
      );

      expect(updated).toBeNull();
    });
  });

  describe("cleanupExpiredSessions", () => {
    test("deletes expired sessions", async () => {
      const user = await ctx.createUser();

      // Create expired sessions
      const expired1 = await ctx.createSession({
        userId: user.id,
        expiresAt: new Date(Date.now() - 1000),
      });
      const expired2 = await ctx.createSession({
        userId: user.id,
        expiresAt: new Date(Date.now() - 2000),
      });

      // Create valid session
      const validSession = await ctx.createSession({
        userId: user.id,
        expiresAt: new Date(Date.now() + 1000000),
      });

      const count = await cleanupExpiredSessions(ctx.prisma);
      ctx.sessionIds.delete(expired1.id);
      ctx.sessionIds.delete(expired2.id);

      expect(count).toBeGreaterThanOrEqual(2);

      // Valid session should still exist
      const found = await ctx.prisma.session.findUnique({
        where: { id: validSession.id },
      });
      expect(found).not.toBeNull();
    });
  });

  describe("getUserSessions", () => {
    test("returns all active sessions for a user", async () => {
      const user = await ctx.createUser();

      await ctx.createSession({ userId: user.id });
      await ctx.createSession({ userId: user.id });
      await ctx.createSession({ userId: user.id });

      const sessions = await getUserSessions(ctx.prisma, user.id);

      expect(sessions).toHaveLength(3);
    });

    test("excludes expired sessions", async () => {
      const user = await ctx.createUser();

      await ctx.createSession({ userId: user.id });
      const expired = await ctx.createSession({
        userId: user.id,
        expiresAt: new Date(Date.now() - 1000),
      });

      const sessions = await getUserSessions(ctx.prisma, user.id);

      expect(sessions).toHaveLength(1);
      expect(sessions.some((s) => s.id === expired.id)).toBe(false);
    });

    test("returns sessions ordered by last accessed time", async () => {
      const user = await ctx.createUser();

      const session1 = await ctx.createSession({ userId: user.id });
      await new Promise((resolve) => setTimeout(resolve, 10));
      const session2 = await ctx.createSession({ userId: user.id });
      await new Promise((resolve) => setTimeout(resolve, 10));
      const session3 = await ctx.createSession({ userId: user.id });

      const sessions = await getUserSessions(ctx.prisma, user.id);

      // Most recent first
      expect(sessions[0].id).toBe(session3.id);
      expect(sessions[1].id).toBe(session2.id);
      expect(sessions[2].id).toBe(session1.id);
    });

    test("returns empty array for user with no sessions", async () => {
      const user = await ctx.createUser();

      const sessions = await getUserSessions(ctx.prisma, user.id);

      expect(sessions).toHaveLength(0);
    });
  });
});

describe("session cascade deletion", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestContext();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  test("sessions are deleted when user is deleted", async () => {
    const user = await ctx.createUser();
    const session = await ctx.createSession({ userId: user.id });

    await ctx.prisma.user.delete({ where: { id: user.id } });
    ctx.userIds.delete(user.id);
    ctx.sessionIds.delete(session.id);

    const found = await ctx.prisma.session.findUnique({
      where: { id: session.id },
    });
    expect(found).toBeNull();
  });

  test("session org reference is set to null when org is deleted", async () => {
    const { user, organization } = await ctx.createUserWithOrg();
    const session = await ctx.createSession({
      userId: user.id,
      currentOrgId: organization.id,
    });

    // Delete the org (membership will cascade delete)
    await ctx.prisma.organization.delete({ where: { id: organization.id } });
    ctx.organizationIds.delete(organization.id);
    ctx.membershipIds.clear(); // Membership was cascade deleted

    const found = await ctx.prisma.session.findUnique({
      where: { id: session.id },
    });
    expect(found).not.toBeNull();
    expect(found?.currentOrgId).toBeNull();
  });
});
