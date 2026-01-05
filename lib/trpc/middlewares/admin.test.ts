import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { TRPCError } from "@trpc/server";
import {
  createMockSessionFromUserWithOrg,
  createTestContext,
  disconnectTestPrisma,
  runWithSession,
  type TestContext,
} from "../../test/harness";
import { tmid } from "../tmid";
import { adminOnly } from "./admin";

describe("adminOnly middleware", () => {
  let ctx: TestContext;

  beforeAll(() => {
    ctx = createTestContext();
  });

  afterAll(async () => {
    await ctx.cleanup();
    await disconnectTestPrisma();
  });

  test("allows internal admin users", async () => {
    const admin = await ctx.createUser({ isAdmin: true });
    const session = await ctx.createSession({ userId: admin.id });
    const mockSession = createMockSessionFromUserWithOrg(session, admin);

    const result = await runWithSession(mockSession, async () => {
      return await tmid()
        .use(adminOnly())
        .build(async (context) => {
          return {
            userId: context.session.user.id,
            isAdmin: context.session.user.isAdmin,
          };
        });
    });

    expect(result.userId).toBe(admin.id);
    expect(result.isAdmin).toBe(true);
  });

  test("throws UNAUTHORIZED when session is null", async () => {
    await runWithSession(null, async () => {
      try {
        await tmid()
          .use(adminOnly())
          .build(async () => {
            return "should not reach";
          });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("UNAUTHORIZED");
        expect((error as TRPCError).message).toBe("Not authenticated");
      }
    });
  });

  test("throws FORBIDDEN for non-admin users", async () => {
    const user = await ctx.createUser({ isAdmin: false });
    const session = await ctx.createSession({ userId: user.id });
    const mockSession = createMockSessionFromUserWithOrg(session, user);

    await runWithSession(mockSession, async () => {
      try {
        await tmid()
          .use(adminOnly())
          .build(async () => {
            return "should not reach";
          });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("FORBIDDEN");
        expect((error as TRPCError).message).toBe("Admin access required");
      }
    });
  });

  test("adds session to context", async () => {
    const admin = await ctx.createUser({ isAdmin: true });
    const session = await ctx.createSession({ userId: admin.id });
    const mockSession = createMockSessionFromUserWithOrg(session, admin);

    const result = await runWithSession(mockSession, async () => {
      return await tmid()
        .use(adminOnly())
        .build(async (context) => {
          return {
            sessionId: context.session.id,
            userId: context.session.user.id,
            email: context.session.user.email,
          };
        });
    });

    expect(result.sessionId).toBe(session.id);
    expect(result.userId).toBe(admin.id);
    expect(result.email).toBe(admin.email);
  });
});
