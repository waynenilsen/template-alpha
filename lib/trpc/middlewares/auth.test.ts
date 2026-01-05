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
import { auth } from "./auth";

describe("auth middleware", () => {
  let ctx: TestContext;

  beforeAll(() => {
    ctx = createTestContext();
  });

  afterAll(async () => {
    await ctx.cleanup();
    await disconnectTestPrisma();
  });

  test("allows authenticated requests", async () => {
    const user = await ctx.createUser();
    const session = await ctx.createSession({ userId: user.id });
    const mockSession = createMockSessionFromUserWithOrg(session, user);

    const result = await runWithSession(mockSession, async () => {
      return await tmid()
        .use(auth())
        .build(async (context) => {
          return {
            userId: context.session.user.id,
            sessionId: context.session.id,
          };
        });
    });

    expect(result.userId).toBe(user.id);
    expect(result.sessionId).toBe(session.id);
  });

  test("throws UNAUTHORIZED when session is null", async () => {
    await runWithSession(null, async () => {
      try {
        await tmid()
          .use(auth())
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

  test("adds session to context", async () => {
    const user = await ctx.createUser({ isAdmin: true });
    const session = await ctx.createSession({ userId: user.id });
    const mockSession = createMockSessionFromUserWithOrg(session, user);

    const result = await runWithSession(mockSession, async () => {
      return await tmid()
        .use(auth())
        .build(async (context) => {
          return {
            sessionId: context.session.id,
            userId: context.session.user.id,
            email: context.session.user.email,
            isAdmin: context.session.user.isAdmin,
          };
        });
    });

    expect(result.sessionId).toBe(session.id);
    expect(result.userId).toBe(user.id);
    expect(result.email).toBe(user.email);
    expect(result.isAdmin).toBe(true);
  });
});
