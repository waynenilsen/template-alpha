import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { TRPCError } from "@trpc/server";
import {
  createTestContext,
  createTestUserWithPassword,
  disconnectTestPrisma,
  type TestContext,
} from "../../lib/test/harness";
import {
  createMockSession,
  runWithSession,
} from "../../lib/test/harness/session-mock";
import { createTestTRPCContext } from "../init";
import { appRouter } from "../router";

// Track email send calls for verification
const emailSendCalls: Array<{ email: string; token: string }> = [];

// Mock the email module - must be before any imports that use it
mock.module("../../lib/email/send", () => ({
  sendPasswordResetEmail: mock((email: string, token: string) => {
    emailSendCalls.push({ email, token });
    return Promise.resolve();
  }),
  sendWelcomeEmail: mock(() => Promise.resolve()),
  sendInvitationEmail: mock(() => Promise.resolve()),
}));

describe("auth router", () => {
  let ctx: TestContext;

  beforeAll(() => {
    ctx = createTestContext();
  });

  afterAll(async () => {
    await ctx.cleanup();
    await disconnectTestPrisma();
  });

  describe("signUp", () => {
    test("creates a new user, organization, and session", async () => {
      const email = `${ctx.prefix}signup-test@example.com`;
      const password = "ValidPass123";

      const trpcCtx = createTestTRPCContext({ prisma: ctx.prisma });
      const caller = appRouter.createCaller(trpcCtx);

      // signUp is public - no session needed
      const result = await runWithSession(null, async () => {
        return caller.auth.signUp({ email, password });
      });

      expect(result.user.email).toBe(email);
      expect(result.user.isAdmin).toBe(false);
      expect(result.session.id).toBeDefined();
      expect(result.session.expiresAt).toBeDefined();

      // Verify organization was created
      expect(result.organization).toBeDefined();
      expect(result.organization.id).toBeDefined();
      expect(result.organization.name).toContain("'s Organization");
      expect(result.organization.slug).toBeDefined();

      // Verify session has currentOrgId set
      expect(result.session.currentOrgId).toBe(result.organization.id);

      // Verify user is owner of the organization
      const membership = await ctx.prisma.organizationMember.findFirst({
        where: {
          userId: result.user.id,
          organizationId: result.organization.id,
        },
      });
      expect(membership).not.toBeNull();
      expect(membership?.role).toBe("owner");

      // Track for cleanup
      ctx.userIds.add(result.user.id);
      ctx.sessionIds.add(result.session.id);
      ctx.organizationIds.add(result.organization.id);
    });

    test("rejects duplicate email", async () => {
      const email = `${ctx.prefix}duplicate-test@example.com`;
      const password = "ValidPass123";

      const trpcCtx = createTestTRPCContext({ prisma: ctx.prisma });
      const caller = appRouter.createCaller(trpcCtx);

      // Create first user
      const result = await runWithSession(null, async () => {
        return caller.auth.signUp({ email, password });
      });
      ctx.userIds.add(result.user.id);
      ctx.sessionIds.add(result.session.id);
      ctx.organizationIds.add(result.organization.id);

      // Try to create duplicate
      try {
        await runWithSession(null, async () => {
          return caller.auth.signUp({ email, password });
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("CONFLICT");
      }
    });

    test("rejects weak password", async () => {
      const email = `${ctx.prefix}weak-pass@example.com`;
      const password = "weak";

      const trpcCtx = createTestTRPCContext({ prisma: ctx.prisma });
      const caller = appRouter.createCaller(trpcCtx);

      try {
        await runWithSession(null, async () => {
          return caller.auth.signUp({ email, password });
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("BAD_REQUEST");
      }
    });

    test("normalizes email to lowercase", async () => {
      const email = `${ctx.prefix}UpperCase@Example.COM`;
      const password = "ValidPass123";

      const trpcCtx = createTestTRPCContext({ prisma: ctx.prisma });
      const caller = appRouter.createCaller(trpcCtx);

      const result = await runWithSession(null, async () => {
        return caller.auth.signUp({ email, password });
      });

      // Email should be stored as lowercase
      expect(result.user.email).toBe(email.toLowerCase());

      ctx.userIds.add(result.user.id);
      ctx.sessionIds.add(result.session.id);
      ctx.organizationIds.add(result.organization.id);
    });

    test("rejects duplicate email with different case", async () => {
      const email = `${ctx.prefix}case-test@example.com`;
      const password = "ValidPass123";

      const trpcCtx = createTestTRPCContext({ prisma: ctx.prisma });
      const caller = appRouter.createCaller(trpcCtx);

      // Create first user with lowercase email
      const result = await runWithSession(null, async () => {
        return caller.auth.signUp({ email, password });
      });
      ctx.userIds.add(result.user.id);
      ctx.sessionIds.add(result.session.id);
      ctx.organizationIds.add(result.organization.id);

      // Try to create duplicate with uppercase
      try {
        await runWithSession(null, async () => {
          return caller.auth.signUp({
            email: email.toUpperCase(),
            password,
          });
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("CONFLICT");
      }
    });
  });

  describe("signIn", () => {
    test("signs in with valid credentials", async () => {
      const { user, password } = await createTestUserWithPassword(ctx);

      const trpcCtx = createTestTRPCContext({ prisma: ctx.prisma });
      const caller = appRouter.createCaller(trpcCtx);

      const result = await runWithSession(null, async () => {
        return caller.auth.signIn({
          email: user.email,
          password,
        });
      });

      expect(result.user.id).toBe(user.id);
      expect(result.user.email).toBe(user.email);
      expect(result.session.id).toBeDefined();
      expect(result.organizations).toEqual([]);

      ctx.sessionIds.add(result.session.id);
    });

    test("sets default org when user has only one", async () => {
      const { user, password } = await createTestUserWithPassword(ctx);
      const org = await ctx.createOrganization();
      await ctx.createMembership({
        userId: user.id,
        organizationId: org.id,
        role: "owner",
      });

      const trpcCtx = createTestTRPCContext({ prisma: ctx.prisma });
      const caller = appRouter.createCaller(trpcCtx);

      const result = await runWithSession(null, async () => {
        return caller.auth.signIn({
          email: user.email,
          password,
        });
      });

      expect(result.session.currentOrgId).toBe(org.id);
      expect(result.organizations).toHaveLength(1);
      expect(result.organizations[0].id).toBe(org.id);

      ctx.sessionIds.add(result.session.id);
    });

    test("rejects invalid password", async () => {
      const { user } = await createTestUserWithPassword(ctx);

      const trpcCtx = createTestTRPCContext({ prisma: ctx.prisma });
      const caller = appRouter.createCaller(trpcCtx);

      try {
        await runWithSession(null, async () => {
          return caller.auth.signIn({
            email: user.email,
            password: "WrongPassword123",
          });
        });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("UNAUTHORIZED");
      }
    });

    test("rejects non-existent email", async () => {
      const trpcCtx = createTestTRPCContext({ prisma: ctx.prisma });
      const caller = appRouter.createCaller(trpcCtx);

      try {
        await runWithSession(null, async () => {
          return caller.auth.signIn({
            email: "nonexistent@example.com",
            password: "SomePassword123",
          });
        });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("UNAUTHORIZED");
      }
    });

    test("allows sign in with different email case", async () => {
      const { user, password } = await createTestUserWithPassword(ctx);

      const trpcCtx = createTestTRPCContext({ prisma: ctx.prisma });
      const caller = appRouter.createCaller(trpcCtx);

      // Sign in with uppercase email
      const result = await runWithSession(null, async () => {
        return caller.auth.signIn({
          email: user.email.toUpperCase(),
          password,
        });
      });

      expect(result.user.id).toBe(user.id);
      expect(result.user.email).toBe(user.email);
      expect(result.session.id).toBeDefined();

      ctx.sessionIds.add(result.session.id);
    });
  });

  describe("signOut", () => {
    test("invalidates the session", async () => {
      const user = await ctx.createUser();
      const session = await ctx.createSession({ userId: user.id });

      const mockSession = createMockSession(session, {
        id: user.id,
        email: user.email,
        isAdmin: user.isAdmin,
      });

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
      });
      const caller = appRouter.createCaller(trpcCtx);

      const result = await runWithSession(mockSession, async () => {
        return caller.auth.signOut();
      });
      expect(result.success).toBe(true);

      // Session should be deleted
      const deletedSession = await ctx.prisma.session.findUnique({
        where: { id: session.id },
      });
      expect(deletedSession).toBeNull();
    });

    test("requires authentication", async () => {
      const trpcCtx = createTestTRPCContext({ prisma: ctx.prisma });
      const caller = appRouter.createCaller(trpcCtx);

      try {
        await runWithSession(null, async () => {
          return caller.auth.signOut();
        });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("UNAUTHORIZED");
      }
    });
  });

  describe("me", () => {
    test("returns current user info", async () => {
      const { user, organization } = await ctx.createUserWithOrg();
      const session = await ctx.createSession({
        userId: user.id,
        currentOrgId: organization.id,
      });

      const mockSession = createMockSession(session, {
        id: user.id,
        email: user.email,
        isAdmin: user.isAdmin,
      });

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
      });
      const caller = appRouter.createCaller(trpcCtx);

      const result = await runWithSession(mockSession, async () => {
        return caller.auth.me();
      });

      expect(result.user.id).toBe(user.id);
      expect(result.user.email).toBe(user.email);
      expect(result.session.currentOrgId).toBe(organization.id);
      expect(result.organizations).toHaveLength(1);
      expect(result.organizations[0].id).toBe(organization.id);
    });

    test("requires authentication", async () => {
      const trpcCtx = createTestTRPCContext({ prisma: ctx.prisma });
      const caller = appRouter.createCaller(trpcCtx);

      try {
        await runWithSession(null, async () => {
          return caller.auth.me();
        });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("UNAUTHORIZED");
      }
    });
  });

  describe("switchOrg", () => {
    test("switches to a valid organization", async () => {
      const user = await ctx.createUser();
      const org1 = await ctx.createOrganization();
      const org2 = await ctx.createOrganization();
      await ctx.createMembership({
        userId: user.id,
        organizationId: org1.id,
        role: "member",
      });
      await ctx.createMembership({
        userId: user.id,
        organizationId: org2.id,
        role: "member",
      });
      const session = await ctx.createSession({
        userId: user.id,
        currentOrgId: org1.id,
      });

      const mockSession = createMockSession(session, {
        id: user.id,
        email: user.email,
        isAdmin: user.isAdmin,
      });

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
      });
      const caller = appRouter.createCaller(trpcCtx);

      const result = await runWithSession(mockSession, async () => {
        return caller.auth.switchOrg({ organizationId: org2.id });
      });

      expect(result.success).toBe(true);
      expect(result.currentOrgId).toBe(org2.id);
    });

    test("clears organization with null", async () => {
      const { user, organization } = await ctx.createUserWithOrg();
      const session = await ctx.createSession({
        userId: user.id,
        currentOrgId: organization.id,
      });

      const mockSession = createMockSession(session, {
        id: user.id,
        email: user.email,
        isAdmin: user.isAdmin,
      });

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
      });
      const caller = appRouter.createCaller(trpcCtx);

      const result = await runWithSession(mockSession, async () => {
        return caller.auth.switchOrg({ organizationId: null });
      });

      expect(result.success).toBe(true);
      expect(result.currentOrgId).toBeNull();
    });

    test("rejects non-member organization", async () => {
      const user = await ctx.createUser();
      const org = await ctx.createOrganization();
      const session = await ctx.createSession({ userId: user.id });

      const mockSession = createMockSession(session, {
        id: user.id,
        email: user.email,
        isAdmin: user.isAdmin,
      });

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
      });
      const caller = appRouter.createCaller(trpcCtx);

      try {
        await runWithSession(mockSession, async () => {
          return caller.auth.switchOrg({ organizationId: org.id });
        });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("FORBIDDEN");
      }
    });

    test("allows admin to switch to any organization", async () => {
      const user = await ctx.createUser({ isAdmin: true });
      const org = await ctx.createOrganization();
      const session = await ctx.createSession({ userId: user.id });

      const mockSession = createMockSession(session, {
        id: user.id,
        email: user.email,
        isAdmin: user.isAdmin,
      });

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
      });
      const caller = appRouter.createCaller(trpcCtx);

      const result = await runWithSession(mockSession, async () => {
        return caller.auth.switchOrg({ organizationId: org.id });
      });

      expect(result.success).toBe(true);
      expect(result.currentOrgId).toBe(org.id);
    });
  });

  describe("getOrganizations", () => {
    test("returns user organizations", async () => {
      const user = await ctx.createUser();
      const org1 = await ctx.createOrganization();
      const org2 = await ctx.createOrganization();
      await ctx.createMembership({
        userId: user.id,
        organizationId: org1.id,
        role: "owner",
      });
      await ctx.createMembership({
        userId: user.id,
        organizationId: org2.id,
        role: "member",
      });
      const session = await ctx.createSession({ userId: user.id });

      const mockSession = createMockSession(session, {
        id: user.id,
        email: user.email,
        isAdmin: user.isAdmin,
      });

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
      });
      const caller = appRouter.createCaller(trpcCtx);

      const result = await runWithSession(mockSession, async () => {
        return caller.auth.getOrganizations();
      });

      expect(result).toHaveLength(2);
      expect(result.map((o) => o.id).sort()).toEqual([org1.id, org2.id].sort());
    });

    test("returns empty array for user without orgs", async () => {
      const user = await ctx.createUser();
      const session = await ctx.createSession({ userId: user.id });

      const mockSession = createMockSession(session, {
        id: user.id,
        email: user.email,
        isAdmin: user.isAdmin,
      });

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
      });
      const caller = appRouter.createCaller(trpcCtx);

      const result = await runWithSession(mockSession, async () => {
        return caller.auth.getOrganizations();
      });

      expect(result).toHaveLength(0);
    });
  });

  describe("requestPasswordReset", () => {
    test("sends password reset email for existing user", async () => {
      const user = await ctx.createUser();
      emailSendCalls.length = 0;

      const trpcCtx = createTestTRPCContext({ prisma: ctx.prisma });
      const caller = appRouter.createCaller(trpcCtx);

      const result = await runWithSession(null, async () => {
        return caller.auth.requestPasswordReset({
          email: user.email,
        });
      });

      expect(result.success).toBe(true);
      expect(emailSendCalls).toHaveLength(1);
      expect(emailSendCalls[0].email).toBe(user.email);
      expect(emailSendCalls[0].token).toBeDefined();

      // Cleanup tokens
      const tokens = await ctx.prisma.passwordResetToken.findMany({
        where: { userId: user.id },
      });
      for (const token of tokens) {
        ctx.passwordResetTokenIds.add(token.id);
      }
    });

    test("returns success but does not send email for non-existent user", async () => {
      emailSendCalls.length = 0;

      const trpcCtx = createTestTRPCContext({ prisma: ctx.prisma });
      const caller = appRouter.createCaller(trpcCtx);

      const result = await runWithSession(null, async () => {
        return caller.auth.requestPasswordReset({
          email: "nonexistent@example.com",
        });
      });

      // Returns success to prevent email enumeration
      expect(result.success).toBe(true);
      expect(emailSendCalls).toHaveLength(0);
    });
  });

  describe("validateResetToken", () => {
    test("returns valid for valid token", async () => {
      const user = await ctx.createUser();
      const { plainToken } = await ctx.createPasswordResetToken({
        userId: user.id,
      });

      const trpcCtx = createTestTRPCContext({ prisma: ctx.prisma });
      const caller = appRouter.createCaller(trpcCtx);

      const result = await runWithSession(null, async () => {
        return caller.auth.validateResetToken({
          token: plainToken,
        });
      });

      expect(result.valid).toBe(true);
    });

    test("returns invalid for non-existent token", async () => {
      const trpcCtx = createTestTRPCContext({ prisma: ctx.prisma });
      const caller = appRouter.createCaller(trpcCtx);

      const result = await runWithSession(null, async () => {
        return caller.auth.validateResetToken({
          token: "invalid-token",
        });
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe("invalid_token");
    });

    test("returns invalid for expired token", async () => {
      const user = await ctx.createUser();
      const { plainToken } = await ctx.createPasswordResetToken({
        userId: user.id,
        expiresAt: new Date(Date.now() - 1000),
      });

      const trpcCtx = createTestTRPCContext({ prisma: ctx.prisma });
      const caller = appRouter.createCaller(trpcCtx);

      const result = await runWithSession(null, async () => {
        return caller.auth.validateResetToken({
          token: plainToken,
        });
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe("expired_token");
    });

    test("returns invalid for used token", async () => {
      const user = await ctx.createUser();
      const { plainToken } = await ctx.createPasswordResetToken({
        userId: user.id,
        usedAt: new Date(),
      });

      const trpcCtx = createTestTRPCContext({ prisma: ctx.prisma });
      const caller = appRouter.createCaller(trpcCtx);

      const result = await runWithSession(null, async () => {
        return caller.auth.validateResetToken({
          token: plainToken,
        });
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe("used_token");
    });
  });

  describe("resetPassword", () => {
    test("resets password with valid token", async () => {
      const user = await ctx.createUser({ password: "OldPassword123" });
      const { plainToken } = await ctx.createPasswordResetToken({
        userId: user.id,
      });

      const trpcCtx = createTestTRPCContext({ prisma: ctx.prisma });
      const caller = appRouter.createCaller(trpcCtx);

      const result = await runWithSession(null, async () => {
        return caller.auth.resetPassword({
          token: plainToken,
          password: "NewPassword456",
        });
      });

      expect(result.success).toBe(true);
    });

    test("throws error for invalid token", async () => {
      const trpcCtx = createTestTRPCContext({ prisma: ctx.prisma });
      const caller = appRouter.createCaller(trpcCtx);

      try {
        await runWithSession(null, async () => {
          return caller.auth.resetPassword({
            token: "invalid-token",
            password: "NewPassword456",
          });
        });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("BAD_REQUEST");
        expect((error as TRPCError).message).toContain("Invalid");
      }
    });

    test("throws error for expired token", async () => {
      const user = await ctx.createUser();
      const { plainToken } = await ctx.createPasswordResetToken({
        userId: user.id,
        expiresAt: new Date(Date.now() - 1000),
      });

      const trpcCtx = createTestTRPCContext({ prisma: ctx.prisma });
      const caller = appRouter.createCaller(trpcCtx);

      try {
        await runWithSession(null, async () => {
          return caller.auth.resetPassword({
            token: plainToken,
            password: "NewPassword456",
          });
        });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("BAD_REQUEST");
        expect((error as TRPCError).message).toContain("expired");
      }
    });

    test("throws error for already used token", async () => {
      const user = await ctx.createUser();
      const { plainToken } = await ctx.createPasswordResetToken({
        userId: user.id,
        usedAt: new Date(),
      });

      const trpcCtx = createTestTRPCContext({ prisma: ctx.prisma });
      const caller = appRouter.createCaller(trpcCtx);

      try {
        await runWithSession(null, async () => {
          return caller.auth.resetPassword({
            token: plainToken,
            password: "NewPassword456",
          });
        });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("BAD_REQUEST");
        expect((error as TRPCError).message).toContain("already been used");
      }
    });
  });
});
