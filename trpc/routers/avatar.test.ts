import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { TRPCError } from "@trpc/server";
import {
  createMockSession,
  createTestContext,
  disconnectTestPrisma,
  runWithSession,
  type TestContext,
} from "../../lib/test/harness";
import { createTestTRPCContext } from "../init";
import { appRouter } from "../router";

describe("avatar router", () => {
  let ctx: TestContext;

  // Simple PNG image (1x1 transparent pixel) as base64
  const testImageBase64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

  beforeAll(() => {
    ctx = createTestContext();
  });

  afterAll(async () => {
    await ctx.cleanup();
    await disconnectTestPrisma();
  });

  describe("getConfig", () => {
    test("returns avatar configuration", async () => {
      const trpcCtx = createTestTRPCContext({ prisma: ctx.prisma });
      const caller = appRouter.createCaller(trpcCtx);

      const config = await caller.avatar.getConfig();

      expect(config.supportedTypes).toContain("image/jpeg");
      expect(config.supportedTypes).toContain("image/png");
      expect(config.maxSize).toBe(5 * 1024 * 1024);
      expect(config.maxSizeFormatted).toBe("5MB");
    });
  });

  describe("user avatar", () => {
    describe("uploadUserAvatar", () => {
      test("uploads user avatar", async () => {
        const user = await ctx.createUser();
        const session = await ctx.createSession({ userId: user.id });

        const trpcCtx = createTestTRPCContext({
          prisma: ctx.prisma,
          sessionId: session.id,
          session,
          user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
        });
        const caller = appRouter.createCaller(trpcCtx);

        const mockSession = createMockSession(session, {
          id: user.id,
          email: user.email,
          isAdmin: user.isAdmin,
        });

        const result = await runWithSession(mockSession, async () => {
          return caller.avatar.uploadUserAvatar({
            data: testImageBase64,
            contentType: "image/png",
          });
        });

        expect(result.avatarId).toBeDefined();
        expect(result.avatarId).toMatch(/^av/);
        expect(result.avatarUrl).toContain("X-Amz-Signature");

        // Verify user was updated
        const updatedUser = await ctx.prisma.user.findUnique({
          where: { id: user.id },
        });
        expect(updatedUser?.avatarId).toBe(result.avatarId);
      });

      test("replaces existing avatar", async () => {
        const user = await ctx.createUser();
        const session = await ctx.createSession({ userId: user.id });

        const trpcCtx = createTestTRPCContext({
          prisma: ctx.prisma,
          sessionId: session.id,
          session,
          user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
        });
        const caller = appRouter.createCaller(trpcCtx);

        const mockSession = createMockSession(session, {
          id: user.id,
          email: user.email,
          isAdmin: user.isAdmin,
        });

        // Upload first avatar
        const first = await runWithSession(mockSession, async () => {
          return caller.avatar.uploadUserAvatar({
            data: testImageBase64,
            contentType: "image/png",
          });
        });

        // Upload second avatar
        const second = await runWithSession(mockSession, async () => {
          return caller.avatar.uploadUserAvatar({
            data: testImageBase64,
            contentType: "image/png",
          });
        });

        expect(second.avatarId).not.toBe(first.avatarId);

        // Verify user has new avatar
        const updatedUser = await ctx.prisma.user.findUnique({
          where: { id: user.id },
        });
        expect(updatedUser?.avatarId).toBe(second.avatarId);
      });

      test("requires authentication", async () => {
        const trpcCtx = createTestTRPCContext({ prisma: ctx.prisma });
        const caller = appRouter.createCaller(trpcCtx);

        try {
          await caller.avatar.uploadUserAvatar({
            data: testImageBase64,
            contentType: "image/png",
          });
          expect(true).toBe(false);
        } catch (error) {
          expect(error).toBeInstanceOf(TRPCError);
          expect((error as TRPCError).code).toBe("UNAUTHORIZED");
        }
      });

      test("rejects invalid content type", async () => {
        const user = await ctx.createUser();
        const session = await ctx.createSession({ userId: user.id });

        const trpcCtx = createTestTRPCContext({
          prisma: ctx.prisma,
          sessionId: session.id,
          session,
          user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
        });
        const caller = appRouter.createCaller(trpcCtx);

        const mockSession = createMockSession(session, {
          id: user.id,
          email: user.email,
          isAdmin: user.isAdmin,
        });

        try {
          await runWithSession(mockSession, async () => {
            return caller.avatar.uploadUserAvatar({
              data: testImageBase64,
              // @ts-expect-error - testing invalid type
              contentType: "application/pdf",
            });
          });
          expect(true).toBe(false);
        } catch (error) {
          expect(error).toBeInstanceOf(TRPCError);
          expect((error as TRPCError).code).toBe("BAD_REQUEST");
        }
      });
    });

    describe("getUserAvatarUrl", () => {
      test("returns avatar URL when avatar exists", async () => {
        const user = await ctx.createUser();
        const session = await ctx.createSession({ userId: user.id });

        const trpcCtx = createTestTRPCContext({
          prisma: ctx.prisma,
          sessionId: session.id,
          session,
          user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
        });
        const caller = appRouter.createCaller(trpcCtx);

        const mockSession = createMockSession(session, {
          id: user.id,
          email: user.email,
          isAdmin: user.isAdmin,
        });

        // Upload avatar first
        await runWithSession(mockSession, async () => {
          return caller.avatar.uploadUserAvatar({
            data: testImageBase64,
            contentType: "image/png",
          });
        });

        const result = await runWithSession(mockSession, async () => {
          return caller.avatar.getUserAvatarUrl();
        });

        expect(result.avatarUrl).not.toBeNull();
        expect(result.avatarUrl).toContain("X-Amz-Signature");
      });

      test("returns null when no avatar exists", async () => {
        const user = await ctx.createUser();
        const session = await ctx.createSession({ userId: user.id });

        const trpcCtx = createTestTRPCContext({
          prisma: ctx.prisma,
          sessionId: session.id,
          session,
          user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
        });
        const caller = appRouter.createCaller(trpcCtx);

        const mockSession = createMockSession(session, {
          id: user.id,
          email: user.email,
          isAdmin: user.isAdmin,
        });

        const result = await runWithSession(mockSession, async () => {
          return caller.avatar.getUserAvatarUrl();
        });

        expect(result.avatarUrl).toBeNull();
      });
    });

    describe("deleteUserAvatar", () => {
      test("deletes user avatar", async () => {
        const user = await ctx.createUser();
        const session = await ctx.createSession({ userId: user.id });

        const trpcCtx = createTestTRPCContext({
          prisma: ctx.prisma,
          sessionId: session.id,
          session,
          user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
        });
        const caller = appRouter.createCaller(trpcCtx);

        const mockSession = createMockSession(session, {
          id: user.id,
          email: user.email,
          isAdmin: user.isAdmin,
        });

        // Upload avatar first
        await runWithSession(mockSession, async () => {
          return caller.avatar.uploadUserAvatar({
            data: testImageBase64,
            contentType: "image/png",
          });
        });

        // Delete avatar
        const result = await runWithSession(mockSession, async () => {
          return caller.avatar.deleteUserAvatar();
        });

        expect(result.success).toBe(true);

        // Verify user avatar is null
        const updatedUser = await ctx.prisma.user.findUnique({
          where: { id: user.id },
        });
        expect(updatedUser?.avatarId).toBeNull();
      });

      test("succeeds when no avatar exists", async () => {
        const user = await ctx.createUser();
        const session = await ctx.createSession({ userId: user.id });

        const trpcCtx = createTestTRPCContext({
          prisma: ctx.prisma,
          sessionId: session.id,
          session,
          user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
        });
        const caller = appRouter.createCaller(trpcCtx);

        const mockSession = createMockSession(session, {
          id: user.id,
          email: user.email,
          isAdmin: user.isAdmin,
        });

        const result = await runWithSession(mockSession, async () => {
          return caller.avatar.deleteUserAvatar();
        });

        expect(result.success).toBe(true);
      });
    });

    describe("getUserUploadUrl", () => {
      test("returns presigned upload URL", async () => {
        const user = await ctx.createUser();
        const session = await ctx.createSession({ userId: user.id });

        const trpcCtx = createTestTRPCContext({
          prisma: ctx.prisma,
          sessionId: session.id,
          session,
          user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
        });
        const caller = appRouter.createCaller(trpcCtx);

        const mockSession = createMockSession(session, {
          id: user.id,
          email: user.email,
          isAdmin: user.isAdmin,
        });

        const result = await runWithSession(mockSession, async () => {
          return caller.avatar.getUserUploadUrl({
            contentType: "image/png",
            size: 1024,
          });
        });

        expect(result.uploadUrl).toContain("X-Amz-Signature");
        expect(result.avatarId).toMatch(/^av/);
        expect(result.key).toContain(user.id);
      });

      test("rejects files too large", async () => {
        const user = await ctx.createUser();
        const session = await ctx.createSession({ userId: user.id });

        const trpcCtx = createTestTRPCContext({
          prisma: ctx.prisma,
          sessionId: session.id,
          session,
          user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
        });
        const caller = appRouter.createCaller(trpcCtx);

        const mockSession = createMockSession(session, {
          id: user.id,
          email: user.email,
          isAdmin: user.isAdmin,
        });

        try {
          await runWithSession(mockSession, async () => {
            return caller.avatar.getUserUploadUrl({
              contentType: "image/png",
              size: 10 * 1024 * 1024, // 10MB
            });
          });
          expect(true).toBe(false);
        } catch (error) {
          expect(error).toBeInstanceOf(TRPCError);
          expect((error as TRPCError).code).toBe("BAD_REQUEST");
        }
      });
    });

    describe("confirmUserAvatar", () => {
      test("confirms uploaded avatar", async () => {
        const user = await ctx.createUser();
        const session = await ctx.createSession({ userId: user.id });

        const trpcCtx = createTestTRPCContext({
          prisma: ctx.prisma,
          sessionId: session.id,
          session,
          user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
        });
        const caller = appRouter.createCaller(trpcCtx);

        const mockSession = createMockSession(session, {
          id: user.id,
          email: user.email,
          isAdmin: user.isAdmin,
        });

        const avatarId = "av123456test";

        const result = await runWithSession(mockSession, async () => {
          return caller.avatar.confirmUserAvatar({ avatarId });
        });

        expect(result.avatarId).toBe(avatarId);
        expect(result.avatarUrl).toContain("X-Amz-Signature");

        // Verify user was updated
        const updatedUser = await ctx.prisma.user.findUnique({
          where: { id: user.id },
        });
        expect(updatedUser?.avatarId).toBe(avatarId);
      });
    });
  });

  describe("organization avatar", () => {
    describe("uploadOrgAvatar", () => {
      test("owner can upload org avatar", async () => {
        const { user, organization } = await ctx.createUserWithOrg({
          role: "owner",
        });
        const session = await ctx.signIn(user, organization.id);

        const trpcCtx = createTestTRPCContext({
          prisma: ctx.prisma,
          sessionId: session.id,
          session,
          user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
        });
        const caller = appRouter.createCaller(trpcCtx);

        const mockSession = createMockSession(session, {
          id: user.id,
          email: user.email,
          isAdmin: user.isAdmin,
        });

        const result = await runWithSession(mockSession, async () => {
          return caller.avatar.uploadOrgAvatar({
            data: testImageBase64,
            contentType: "image/png",
          });
        });

        expect(result.avatarId).toBeDefined();
        expect(result.avatarId).toMatch(/^av/);
        expect(result.avatarUrl).toContain("X-Amz-Signature");

        // Verify org was updated
        const updatedOrg = await ctx.prisma.organization.findUnique({
          where: { id: organization.id },
        });
        expect(updatedOrg?.avatarId).toBe(result.avatarId);
      });

      test("admin can upload org avatar", async () => {
        const { user, organization } = await ctx.createUserWithOrg({
          role: "admin",
        });
        const session = await ctx.signIn(user, organization.id);

        const trpcCtx = createTestTRPCContext({
          prisma: ctx.prisma,
          sessionId: session.id,
          session,
          user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
        });
        const caller = appRouter.createCaller(trpcCtx);

        const mockSession = createMockSession(session, {
          id: user.id,
          email: user.email,
          isAdmin: user.isAdmin,
        });

        const result = await runWithSession(mockSession, async () => {
          return caller.avatar.uploadOrgAvatar({
            data: testImageBase64,
            contentType: "image/png",
          });
        });

        expect(result.avatarId).toBeDefined();
      });

      test("member cannot upload org avatar", async () => {
        const { user, organization } = await ctx.createUserWithOrg({
          role: "member",
        });
        const session = await ctx.signIn(user, organization.id);

        const trpcCtx = createTestTRPCContext({
          prisma: ctx.prisma,
          sessionId: session.id,
          session,
          user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
        });
        const caller = appRouter.createCaller(trpcCtx);

        const mockSession = createMockSession(session, {
          id: user.id,
          email: user.email,
          isAdmin: user.isAdmin,
        });

        try {
          await runWithSession(mockSession, async () => {
            return caller.avatar.uploadOrgAvatar({
              data: testImageBase64,
              contentType: "image/png",
            });
          });
          expect(true).toBe(false);
        } catch (error) {
          expect(error).toBeInstanceOf(TRPCError);
          expect((error as TRPCError).code).toBe("FORBIDDEN");
        }
      });

      test("requires organization context", async () => {
        const user = await ctx.createUser();
        const session = await ctx.createSession({ userId: user.id });

        const trpcCtx = createTestTRPCContext({
          prisma: ctx.prisma,
          sessionId: session.id,
          session,
          user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
        });
        const caller = appRouter.createCaller(trpcCtx);

        const mockSession = createMockSession(session, {
          id: user.id,
          email: user.email,
          isAdmin: user.isAdmin,
        });

        try {
          await runWithSession(mockSession, async () => {
            return caller.avatar.uploadOrgAvatar({
              data: testImageBase64,
              contentType: "image/png",
            });
          });
          expect(true).toBe(false);
        } catch (error) {
          expect(error).toBeInstanceOf(TRPCError);
          expect((error as TRPCError).code).toBe("FORBIDDEN");
        }
      });
    });

    describe("getOrgAvatarUrl", () => {
      test("returns avatar URL when avatar exists", async () => {
        const { user, organization } = await ctx.createUserWithOrg({
          role: "owner",
        });
        const session = await ctx.signIn(user, organization.id);

        const trpcCtx = createTestTRPCContext({
          prisma: ctx.prisma,
          sessionId: session.id,
          session,
          user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
        });
        const caller = appRouter.createCaller(trpcCtx);

        const mockSession = createMockSession(session, {
          id: user.id,
          email: user.email,
          isAdmin: user.isAdmin,
        });

        // Upload avatar first
        await runWithSession(mockSession, async () => {
          return caller.avatar.uploadOrgAvatar({
            data: testImageBase64,
            contentType: "image/png",
          });
        });

        const result = await runWithSession(mockSession, async () => {
          return caller.avatar.getOrgAvatarUrl();
        });

        expect(result.avatarUrl).not.toBeNull();
        expect(result.avatarUrl).toContain("X-Amz-Signature");
      });

      test("returns null when no avatar exists", async () => {
        const { user, organization } = await ctx.createUserWithOrg({
          role: "member",
        });
        const session = await ctx.signIn(user, organization.id);

        const trpcCtx = createTestTRPCContext({
          prisma: ctx.prisma,
          sessionId: session.id,
          session,
          user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
        });
        const caller = appRouter.createCaller(trpcCtx);

        const mockSession = createMockSession(session, {
          id: user.id,
          email: user.email,
          isAdmin: user.isAdmin,
        });

        const result = await runWithSession(mockSession, async () => {
          return caller.avatar.getOrgAvatarUrl();
        });

        expect(result.avatarUrl).toBeNull();
      });
    });

    describe("deleteOrgAvatar", () => {
      test("owner can delete org avatar", async () => {
        const { user, organization } = await ctx.createUserWithOrg({
          role: "owner",
        });
        const session = await ctx.signIn(user, organization.id);

        const trpcCtx = createTestTRPCContext({
          prisma: ctx.prisma,
          sessionId: session.id,
          session,
          user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
        });
        const caller = appRouter.createCaller(trpcCtx);

        const mockSession = createMockSession(session, {
          id: user.id,
          email: user.email,
          isAdmin: user.isAdmin,
        });

        // Upload avatar first
        await runWithSession(mockSession, async () => {
          return caller.avatar.uploadOrgAvatar({
            data: testImageBase64,
            contentType: "image/png",
          });
        });

        // Delete avatar
        const result = await runWithSession(mockSession, async () => {
          return caller.avatar.deleteOrgAvatar();
        });

        expect(result.success).toBe(true);

        // Verify org avatar is null
        const updatedOrg = await ctx.prisma.organization.findUnique({
          where: { id: organization.id },
        });
        expect(updatedOrg?.avatarId).toBeNull();
      });

      test("member cannot delete org avatar", async () => {
        const { user, organization } = await ctx.createUserWithOrg({
          role: "member",
        });
        const session = await ctx.signIn(user, organization.id);

        const trpcCtx = createTestTRPCContext({
          prisma: ctx.prisma,
          sessionId: session.id,
          session,
          user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
        });
        const caller = appRouter.createCaller(trpcCtx);

        const mockSession = createMockSession(session, {
          id: user.id,
          email: user.email,
          isAdmin: user.isAdmin,
        });

        try {
          await runWithSession(mockSession, async () => {
            return caller.avatar.deleteOrgAvatar();
          });
          expect(true).toBe(false);
        } catch (error) {
          expect(error).toBeInstanceOf(TRPCError);
          expect((error as TRPCError).code).toBe("FORBIDDEN");
        }
      });
    });

    describe("getOrgUploadUrl", () => {
      test("owner can get upload URL", async () => {
        const { user, organization } = await ctx.createUserWithOrg({
          role: "owner",
        });
        const session = await ctx.signIn(user, organization.id);

        const trpcCtx = createTestTRPCContext({
          prisma: ctx.prisma,
          sessionId: session.id,
          session,
          user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
        });
        const caller = appRouter.createCaller(trpcCtx);

        const mockSession = createMockSession(session, {
          id: user.id,
          email: user.email,
          isAdmin: user.isAdmin,
        });

        const result = await runWithSession(mockSession, async () => {
          return caller.avatar.getOrgUploadUrl({
            contentType: "image/png",
            size: 1024,
          });
        });

        expect(result.uploadUrl).toContain("X-Amz-Signature");
        expect(result.avatarId).toMatch(/^av/);
        expect(result.key).toContain(organization.id);
      });

      test("member cannot get upload URL", async () => {
        const { user, organization } = await ctx.createUserWithOrg({
          role: "member",
        });
        const session = await ctx.signIn(user, organization.id);

        const trpcCtx = createTestTRPCContext({
          prisma: ctx.prisma,
          sessionId: session.id,
          session,
          user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
        });
        const caller = appRouter.createCaller(trpcCtx);

        const mockSession = createMockSession(session, {
          id: user.id,
          email: user.email,
          isAdmin: user.isAdmin,
        });

        try {
          await runWithSession(mockSession, async () => {
            return caller.avatar.getOrgUploadUrl({
              contentType: "image/png",
              size: 1024,
            });
          });
          expect(true).toBe(false);
        } catch (error) {
          expect(error).toBeInstanceOf(TRPCError);
          expect((error as TRPCError).code).toBe("FORBIDDEN");
        }
      });
    });

    describe("confirmOrgAvatar", () => {
      test("owner can confirm org avatar", async () => {
        const { user, organization } = await ctx.createUserWithOrg({
          role: "owner",
        });
        const session = await ctx.signIn(user, organization.id);

        const trpcCtx = createTestTRPCContext({
          prisma: ctx.prisma,
          sessionId: session.id,
          session,
          user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
        });
        const caller = appRouter.createCaller(trpcCtx);

        const mockSession = createMockSession(session, {
          id: user.id,
          email: user.email,
          isAdmin: user.isAdmin,
        });

        const avatarId = "av123456orgtest";

        const result = await runWithSession(mockSession, async () => {
          return caller.avatar.confirmOrgAvatar({ avatarId });
        });

        expect(result.avatarId).toBe(avatarId);
        expect(result.avatarUrl).toContain("X-Amz-Signature");

        // Verify org was updated
        const updatedOrg = await ctx.prisma.organization.findUnique({
          where: { id: organization.id },
        });
        expect(updatedOrg?.avatarId).toBe(avatarId);
      });

      test("member cannot confirm org avatar", async () => {
        const { user, organization } = await ctx.createUserWithOrg({
          role: "member",
        });
        const session = await ctx.signIn(user, organization.id);

        const trpcCtx = createTestTRPCContext({
          prisma: ctx.prisma,
          sessionId: session.id,
          session,
          user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
        });
        const caller = appRouter.createCaller(trpcCtx);

        const mockSession = createMockSession(session, {
          id: user.id,
          email: user.email,
          isAdmin: user.isAdmin,
        });

        try {
          await runWithSession(mockSession, async () => {
            return caller.avatar.confirmOrgAvatar({ avatarId: "av123456" });
          });
          expect(true).toBe(false);
        } catch (error) {
          expect(error).toBeInstanceOf(TRPCError);
          expect((error as TRPCError).code).toBe("FORBIDDEN");
        }
      });
    });
  });
});
