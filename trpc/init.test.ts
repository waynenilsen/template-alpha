import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { TRPCError } from "@trpc/server";
import { SESSION_COOKIE_OPTIONS } from "../lib/auth/session";
import {
  createTestContext,
  disconnectTestPrisma,
  type TestContext,
} from "../lib/test/harness";
import {
  createServerSideContext,
  createTestTRPCContext,
  createTRPCContext,
} from "./init";
import { appRouter } from "./router";

describe("tRPC init", () => {
  let ctx: TestContext;

  beforeAll(() => {
    ctx = createTestContext();
  });

  afterAll(async () => {
    await ctx.cleanup();
    await disconnectTestPrisma();
  });

  describe("createTestTRPCContext", () => {
    test("creates context with minimal options", () => {
      const trpcCtx = createTestTRPCContext({ prisma: ctx.prisma });

      expect(trpcCtx.prisma).toBe(ctx.prisma);
      expect(trpcCtx.sessionId).toBeNull();
      expect(trpcCtx.session).toBeNull();
      expect(trpcCtx.user).toBeNull();
    });

    test("creates context with all options", async () => {
      const user = await ctx.createUser();
      const session = await ctx.createSession({ userId: user.id });

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
      });

      expect(trpcCtx.sessionId).toBe(session.id);
      expect(trpcCtx.session).toEqual(session);
      expect(trpcCtx.user?.id).toBe(user.id);
    });
  });

  describe("createTRPCContext", () => {
    // Mock info object required by FetchCreateContextFnOptions
    const mockInfo = {
      calls: [],
      isBatchCall: false,
      accept: null,
      type: "query" as const,
      connectionParams: null,
      signal: new AbortController().signal,
      url: new URL("http://localhost/api/trpc"),
    };

    test("creates context without cookies", async () => {
      const req = new Request("http://localhost/api/trpc");
      const resHeaders = new Headers();

      const trpcCtx = await createTRPCContext({
        req,
        resHeaders,
        info: mockInfo,
      });

      expect(trpcCtx.sessionId).toBeNull();
      expect(trpcCtx.session).toBeNull();
      expect(trpcCtx.user).toBeNull();
    });

    test("creates context with invalid session cookie", async () => {
      const req = new Request("http://localhost/api/trpc", {
        headers: {
          cookie: `${SESSION_COOKIE_OPTIONS.name}=invalid-session-id`,
        },
      });
      const resHeaders = new Headers();

      const trpcCtx = await createTRPCContext({
        req,
        resHeaders,
        info: mockInfo,
      });

      expect(trpcCtx.sessionId).toBeNull();
      expect(trpcCtx.session).toBeNull();
      expect(trpcCtx.user).toBeNull();
    });

    test("creates context with valid session cookie", async () => {
      const user = await ctx.createUser();
      const org = await ctx.createOrganization();
      await ctx.createMembership({
        userId: user.id,
        organizationId: org.id,
        role: "owner",
      });
      const session = await ctx.createSession({
        userId: user.id,
        currentOrgId: org.id,
      });

      const req = new Request("http://localhost/api/trpc", {
        headers: {
          cookie: `${SESSION_COOKIE_OPTIONS.name}=${session.id}`,
        },
      });
      const resHeaders = new Headers();

      const trpcCtx = await createTRPCContext({
        req,
        resHeaders,
        info: mockInfo,
      });

      expect(trpcCtx.sessionId).toBe(session.id);
      expect(trpcCtx.session).not.toBeNull();
      expect(trpcCtx.session?.id).toBe(session.id);
      expect(trpcCtx.user?.id).toBe(user.id);
      expect(trpcCtx.user?.email).toBe(user.email);
    });

    test("parses cookie with multiple values", async () => {
      const user = await ctx.createUser();
      const session = await ctx.createSession({ userId: user.id });

      const req = new Request("http://localhost/api/trpc", {
        headers: {
          cookie: `other_cookie=value; ${SESSION_COOKIE_OPTIONS.name}=${session.id}; another=test`,
        },
      });
      const resHeaders = new Headers();

      const trpcCtx = await createTRPCContext({
        req,
        resHeaders,
        info: mockInfo,
      });

      expect(trpcCtx.sessionId).toBe(session.id);
      expect(trpcCtx.user?.id).toBe(user.id);
    });

    test("handles cookie with empty key-value pairs", async () => {
      const req = new Request("http://localhost/api/trpc", {
        headers: {
          cookie: `; ${SESSION_COOKIE_OPTIONS.name}=; empty=`,
        },
      });
      const resHeaders = new Headers();

      const trpcCtx = await createTRPCContext({
        req,
        resHeaders,
        info: mockInfo,
      });

      expect(trpcCtx.sessionId).toBeNull();
    });
  });

  describe("createServerSideContext", () => {
    test("handles missing cookies context gracefully", async () => {
      // In non-Next.js environments (like tests), cookies() may fail
      // The function should handle this gracefully and return unauthenticated context
      const trpcCtx = await createServerSideContext();

      // Should return unauthenticated context since cookies() fails in test env
      expect(trpcCtx.sessionId).toBeNull();
      expect(trpcCtx.session).toBeNull();
      expect(trpcCtx.user).toBeNull();
    });
  });

  describe("protectedProcedure middleware", () => {
    test("rejects unauthenticated requests", async () => {
      const trpcCtx = createTestTRPCContext({ prisma: ctx.prisma });
      const caller = appRouter.createCaller(trpcCtx);

      try {
        await caller.auth.me();
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("UNAUTHORIZED");
        expect((error as TRPCError).message).toBe(
          "You must be logged in to access this resource",
        );
      }
    });

    test("allows authenticated requests", async () => {
      const { user, organization } = await ctx.createUserWithOrg();
      const session = await ctx.createSession({
        userId: user.id,
        currentOrgId: organization.id,
      });

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
      });
      const caller = appRouter.createCaller(trpcCtx);

      const result = await caller.auth.me();
      expect(result.user.id).toBe(user.id);
    });
  });

  describe("orgProcedure middleware", () => {
    test("rejects when user is not authenticated", async () => {
      const trpcCtx = createTestTRPCContext({ prisma: ctx.prisma });
      const caller = appRouter.createCaller(trpcCtx);

      try {
        await caller.todo.list({});
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("UNAUTHORIZED");
      }
    });

    test("rejects when no organization context", async () => {
      const user = await ctx.createUser();
      const session = await ctx.createSession({ userId: user.id });

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
      });
      const caller = appRouter.createCaller(trpcCtx);

      try {
        await caller.todo.list({});
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("FORBIDDEN");
        expect((error as TRPCError).message).toBe(
          "You must select an organization to access this resource",
        );
      }
    });

    test("rejects non-member accessing organization", async () => {
      const user = await ctx.createUser();
      const org = await ctx.createOrganization();
      // No membership created
      const session = await ctx.createSession({
        userId: user.id,
        currentOrgId: org.id,
      });

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
      });
      const caller = appRouter.createCaller(trpcCtx);

      try {
        await caller.todo.list({});
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("FORBIDDEN");
        expect((error as TRPCError).message).toBe(
          "You are not a member of this organization",
        );
      }
    });

    test("allows internal admin to access any organization", async () => {
      const admin = await ctx.createUser({ isAdmin: true });
      const org = await ctx.createOrganization();
      // Admin has no membership but is internal admin
      const session = await ctx.createSession({
        userId: admin.id,
        currentOrgId: org.id,
      });

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: { id: admin.id, email: admin.email, isAdmin: admin.isAdmin },
      });
      const caller = appRouter.createCaller(trpcCtx);

      const result = await caller.todo.list({});
      expect(result.items).toBeDefined();
    });

    test("allows member to access their organization", async () => {
      const { user, organization } = await ctx.createUserWithOrg();
      const session = await ctx.createSession({
        userId: user.id,
        currentOrgId: organization.id,
      });

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
      });
      const caller = appRouter.createCaller(trpcCtx);

      const result = await caller.todo.list({});
      expect(result.items).toBeDefined();
    });
  });
});
