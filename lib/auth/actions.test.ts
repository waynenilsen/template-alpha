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
import { getUserOrganizations } from "./authorization";
import { hashPassword, verifyPassword } from "./password";
import {
  createSession,
  getSessionWithUser,
  SESSION_COOKIE_OPTIONS,
} from "./session";

/**
 * These tests verify the auth action logic without the Next.js cookies layer.
 * The server actions in actions.ts wrap these lower-level functions with cookie handling.
 * We test the core logic here since cookies require Next.js context.
 */
describe("auth action logic", () => {
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

  describe("signUp flow", () => {
    test("creates a new user with hashed password", async () => {
      const email = `signup-test-${Date.now()}@test.local`;
      const password = "Password123";

      // Hash password as the action would
      const passwordHash = await hashPassword(password);

      // Create user as the action would
      const user = await ctx.prisma.user.create({
        data: {
          email,
          passwordHash,
        },
      });
      ctx.userIds.add(user.id);

      expect(user.email).toBe(email);
      expect(user.passwordHash).not.toBe(password);

      // Verify password works
      const isValid = await verifyPassword(password, user.passwordHash);
      expect(isValid).toBe(true);
    });

    test("creates a session for the new user", async () => {
      const email = `signup-session-${Date.now()}@test.local`;
      const password = "Password123";
      const passwordHash = await hashPassword(password);

      const user = await ctx.prisma.user.create({
        data: { email, passwordHash },
      });
      ctx.userIds.add(user.id);

      // Create session as the action would
      const session = await createSession(ctx.prisma, user.id);
      ctx.sessionIds.add(session.id);

      expect(session.userId).toBe(user.id);
      expect(session.currentOrgId).toBeNull();
      expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    test("rejects duplicate email", async () => {
      const email = `duplicate-${Date.now()}@test.local`;
      const password = "Password123";
      const passwordHash = await hashPassword(password);

      // Create first user
      const user = await ctx.prisma.user.create({
        data: { email, passwordHash },
      });
      ctx.userIds.add(user.id);

      // Try to create duplicate
      let error: Error | null = null;
      try {
        await ctx.prisma.user.create({
          data: { email, passwordHash },
        });
      } catch (e) {
        error = e as Error;
      }

      expect(error).not.toBeNull();
      expect(error?.message).toContain("Unique constraint");
    });
  });

  describe("signIn flow", () => {
    test("authenticates with valid credentials", async () => {
      const email = `signin-${Date.now()}@test.local`;
      const password = "Password123";
      const passwordHash = await hashPassword(password);

      const user = await ctx.prisma.user.create({
        data: { email, passwordHash },
      });
      ctx.userIds.add(user.id);

      // Verify as the action would
      const isValid = await verifyPassword(password, user.passwordHash);
      expect(isValid).toBe(true);
    });

    test("rejects invalid password", async () => {
      const email = `signin-invalid-${Date.now()}@test.local`;
      const password = "Password123";
      const wrongPassword = "WrongPassword123";
      const passwordHash = await hashPassword(password);

      const user = await ctx.prisma.user.create({
        data: { email, passwordHash },
      });
      ctx.userIds.add(user.id);

      const isValid = await verifyPassword(wrongPassword, user.passwordHash);
      expect(isValid).toBe(false);
    });

    test("creates session with default org when user has one org", async () => {
      const { user, organization } = await ctx.createUserWithOrg();

      // Get user's orgs as the action would
      const orgs = await getUserOrganizations(ctx.prisma, user.id);
      expect(orgs).toHaveLength(1);

      const defaultOrgId = orgs.length === 1 ? orgs[0].id : null;

      // Create session with default org
      const session = await createSession(ctx.prisma, user.id, defaultOrgId);
      ctx.sessionIds.add(session.id);

      expect(session.currentOrgId).toBe(organization.id);
    });

    test("creates session without default org when user has multiple orgs", async () => {
      const { user } = await ctx.createUserWithOrg();
      const org2 = await ctx.createOrganization();
      await ctx.createMembership({
        userId: user.id,
        organizationId: org2.id,
        role: "member",
      });

      const orgs = await getUserOrganizations(ctx.prisma, user.id);
      expect(orgs.length).toBeGreaterThan(1);

      const defaultOrgId = orgs.length === 1 ? orgs[0].id : null;

      const session = await createSession(ctx.prisma, user.id, defaultOrgId);
      ctx.sessionIds.add(session.id);

      expect(session.currentOrgId).toBeNull();
    });
  });

  describe("signOut flow", () => {
    test("deletes the session", async () => {
      const user = await ctx.createUser();
      const session = await ctx.createSession({ userId: user.id });

      // Delete session as the action would
      await ctx.prisma.session.delete({ where: { id: session.id } });
      ctx.sessionIds.delete(session.id);

      const found = await ctx.prisma.session.findUnique({
        where: { id: session.id },
      });
      expect(found).toBeNull();
    });
  });

  describe("getCurrentSession flow", () => {
    test("retrieves valid session with user data", async () => {
      const user = await ctx.createUser({ isAdmin: true });
      const session = await ctx.createSession({ userId: user.id });

      // Get session as the action would
      const sessionWithUser = await getSessionWithUser(ctx.prisma, session.id);

      expect(sessionWithUser).not.toBeNull();
      expect(sessionWithUser?.user.id).toBe(user.id);
      expect(sessionWithUser?.user.email).toBe(user.email);
      expect(sessionWithUser?.user.isAdmin).toBe(true);
    });

    test("returns null for expired session", async () => {
      const user = await ctx.createUser();
      const session = await ctx.createSession({
        userId: user.id,
        expiresAt: new Date(Date.now() - 1000), // Expired
      });

      const sessionWithUser = await getSessionWithUser(ctx.prisma, session.id);
      expect(sessionWithUser).toBeNull();
      ctx.sessionIds.delete(session.id); // Session was auto-deleted
    });

    test("returns null for non-existent session", async () => {
      const sessionWithUser = await getSessionWithUser(
        ctx.prisma,
        "non-existent-id",
      );
      expect(sessionWithUser).toBeNull();
    });
  });
});

describe("SESSION_COOKIE_OPTIONS", () => {
  test("has correct cookie name", () => {
    expect(SESSION_COOKIE_OPTIONS.name).toBe("session_id");
  });

  test("is httpOnly", () => {
    expect(SESSION_COOKIE_OPTIONS.httpOnly).toBe(true);
  });

  test("has 7 day max age", () => {
    // 7 days in seconds
    expect(SESSION_COOKIE_OPTIONS.maxAge).toBe(60 * 60 * 24 * 7);
  });

  test("uses lax same-site policy", () => {
    expect(SESSION_COOKIE_OPTIONS.sameSite).toBe("lax");
  });

  test("applies to root path", () => {
    expect(SESSION_COOKIE_OPTIONS.path).toBe("/");
  });
});
