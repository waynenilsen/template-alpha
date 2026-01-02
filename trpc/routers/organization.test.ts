import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { TRPCError } from "@trpc/server";
import {
  createTestContext,
  disconnectTestPrisma,
  type TestContext,
} from "../../lib/test/harness";
import { createTestTRPCContext } from "../init";
import { appRouter } from "../router";

describe("organization router", () => {
  let ctx: TestContext;

  beforeAll(() => {
    ctx = createTestContext();
  });

  afterAll(async () => {
    await ctx.cleanup();
    await disconnectTestPrisma();
  });

  describe("create", () => {
    test("creates organization and makes user owner", async () => {
      const user = await ctx.createUser();
      const session = await ctx.createSession({ userId: user.id });

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
      });
      const caller = appRouter.createCaller(trpcCtx);

      const result = await caller.organization.create({
        name: "Test Organization",
      });

      expect(result.name).toBe("Test Organization");
      expect(result.slug).toBe("test-organization");
      expect(result.id).toBeDefined();

      // Track for cleanup
      ctx.organizationIds.add(result.id);

      // Verify membership was created
      const membership = await ctx.prisma.organizationMember.findFirst({
        where: {
          userId: user.id,
          organizationId: result.id,
        },
      });
      expect(membership).not.toBeNull();
      expect(membership?.role).toBe("owner");
      if (membership) ctx.membershipIds.add(membership.id);
    });

    test("generates unique slug for duplicate names", async () => {
      const user = await ctx.createUser();
      const session = await ctx.createSession({ userId: user.id });

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
      });
      const caller = appRouter.createCaller(trpcCtx);

      const result1 = await caller.organization.create({ name: "Duplicate" });
      ctx.organizationIds.add(result1.id);

      // Need new session for second org
      const session2 = await ctx.createSession({ userId: user.id });
      const trpcCtx2 = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session2.id,
        session: session2,
        user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
      });
      const caller2 = appRouter.createCaller(trpcCtx2);

      const result2 = await caller2.organization.create({ name: "Duplicate" });
      ctx.organizationIds.add(result2.id);

      expect(result1.slug).toBe("duplicate");
      expect(result2.slug).toBe("duplicate-1");

      // Clean up memberships
      const memberships = await ctx.prisma.organizationMember.findMany({
        where: { userId: user.id },
      });
      for (const m of memberships) {
        ctx.membershipIds.add(m.id);
      }
    });

    test("uses custom slug when provided", async () => {
      const user = await ctx.createUser();
      const session = await ctx.createSession({ userId: user.id });

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
      });
      const caller = appRouter.createCaller(trpcCtx);

      const result = await caller.organization.create({
        name: "My Org",
        slug: "custom-slug-123",
      });

      expect(result.slug).toBe("custom-slug-123");
      ctx.organizationIds.add(result.id);

      const membership = await ctx.prisma.organizationMember.findFirst({
        where: { userId: user.id, organizationId: result.id },
      });
      if (membership) ctx.membershipIds.add(membership.id);
    });

    test("requires authentication", async () => {
      const trpcCtx = createTestTRPCContext({ prisma: ctx.prisma });
      const caller = appRouter.createCaller(trpcCtx);

      try {
        await caller.organization.create({ name: "Test" });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("UNAUTHORIZED");
      }
    });
  });

  describe("get", () => {
    test("returns organization details", async () => {
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

      const result = await caller.organization.get();

      expect(result.id).toBe(organization.id);
      expect(result.name).toBe(organization.name);
      expect(result.slug).toBe(organization.slug);
      expect(result.memberCount).toBe(1);
      expect(result.userRole).toBe("owner");
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

      try {
        await caller.organization.get();
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("FORBIDDEN");
      }
    });
  });

  describe("update", () => {
    test("owner can update organization", async () => {
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

      const result = await caller.organization.update({ name: "Updated Name" });

      expect(result.name).toBe("Updated Name");
    });

    test("admin can update organization", async () => {
      const { organization } = await ctx.createUserWithOrg();
      const admin = await ctx.createUser();
      await ctx.createMembership({
        userId: admin.id,
        organizationId: organization.id,
        role: "admin",
      });
      const session = await ctx.createSession({
        userId: admin.id,
        currentOrgId: organization.id,
      });

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: { id: admin.id, email: admin.email, isAdmin: admin.isAdmin },
      });
      const caller = appRouter.createCaller(trpcCtx);

      const result = await caller.organization.update({
        name: "Admin Updated",
      });

      expect(result.name).toBe("Admin Updated");
    });

    test("member cannot update organization", async () => {
      const { organization } = await ctx.createUserWithOrg();
      const member = await ctx.createUser();
      await ctx.createMembership({
        userId: member.id,
        organizationId: organization.id,
        role: "member",
      });
      const session = await ctx.createSession({
        userId: member.id,
        currentOrgId: organization.id,
      });

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: { id: member.id, email: member.email, isAdmin: member.isAdmin },
      });
      const caller = appRouter.createCaller(trpcCtx);

      try {
        await caller.organization.update({ name: "Should Fail" });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("FORBIDDEN");
      }
    });

    test("rejects duplicate slug", async () => {
      const { user, organization } = await ctx.createUserWithOrg();
      const _otherOrg = await ctx.createOrganization({ slug: "existing-slug" });
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

      try {
        await caller.organization.update({ slug: "existing-slug" });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("CONFLICT");
      }
    });
  });

  describe("delete", () => {
    test("owner can delete organization", async () => {
      const { user, organization, membership } = await ctx.createUserWithOrg();
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

      const result = await caller.organization.delete();

      expect(result.success).toBe(true);

      // Verify deletion
      const deleted = await ctx.prisma.organization.findUnique({
        where: { id: organization.id },
      });
      expect(deleted).toBeNull();

      // Remove from cleanup since already deleted
      ctx.organizationIds.delete(organization.id);
      ctx.membershipIds.delete(membership.id);
    });

    test("admin cannot delete organization", async () => {
      const { organization } = await ctx.createUserWithOrg();
      const admin = await ctx.createUser();
      await ctx.createMembership({
        userId: admin.id,
        organizationId: organization.id,
        role: "admin",
      });
      const session = await ctx.createSession({
        userId: admin.id,
        currentOrgId: organization.id,
      });

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: { id: admin.id, email: admin.email, isAdmin: admin.isAdmin },
      });
      const caller = appRouter.createCaller(trpcCtx);

      try {
        await caller.organization.delete();
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("FORBIDDEN");
      }
    });

    test("platform admin can delete any organization", async () => {
      const { organization, membership } = await ctx.createUserWithOrg();
      const platformAdmin = await ctx.createUser({ isAdmin: true });
      const session = await ctx.createSession({
        userId: platformAdmin.id,
        currentOrgId: organization.id,
      });

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: {
          id: platformAdmin.id,
          email: platformAdmin.email,
          isAdmin: platformAdmin.isAdmin,
        },
      });
      const caller = appRouter.createCaller(trpcCtx);

      const result = await caller.organization.delete();

      expect(result.success).toBe(true);
      ctx.organizationIds.delete(organization.id);
      ctx.membershipIds.delete(membership.id);
    });
  });

  describe("listMembers", () => {
    test("returns all members", async () => {
      const { user, organization } = await ctx.createUserWithOrg();
      const member = await ctx.createUser();
      await ctx.createMembership({
        userId: member.id,
        organizationId: organization.id,
        role: "member",
      });
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

      const result = await caller.organization.listMembers();

      expect(result).toHaveLength(2);
      expect(result.find((m) => m.userId === user.id)?.role).toBe("owner");
      expect(result.find((m) => m.userId === member.id)?.role).toBe("member");
    });

    test("marks current user", async () => {
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

      const result = await caller.organization.listMembers();

      expect(result[0].isCurrentUser).toBe(true);
    });
  });

  describe("updateMemberRole", () => {
    test("owner can change member role to admin", async () => {
      const { user, organization } = await ctx.createUserWithOrg();
      const member = await ctx.createUser();
      const membership = await ctx.createMembership({
        userId: member.id,
        organizationId: organization.id,
        role: "member",
      });
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

      const result = await caller.organization.updateMemberRole({
        memberId: membership.id,
        role: "admin",
      });

      expect(result.role).toBe("admin");
    });

    test("admin cannot promote to admin", async () => {
      const { organization } = await ctx.createUserWithOrg();
      const admin = await ctx.createUser();
      await ctx.createMembership({
        userId: admin.id,
        organizationId: organization.id,
        role: "admin",
      });
      const member = await ctx.createUser();
      const membership = await ctx.createMembership({
        userId: member.id,
        organizationId: organization.id,
        role: "member",
      });
      const session = await ctx.createSession({
        userId: admin.id,
        currentOrgId: organization.id,
      });

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: { id: admin.id, email: admin.email, isAdmin: admin.isAdmin },
      });
      const caller = appRouter.createCaller(trpcCtx);

      try {
        await caller.organization.updateMemberRole({
          memberId: membership.id,
          role: "admin",
        });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("FORBIDDEN");
      }
    });

    test("cannot change owner role", async () => {
      const { organization, membership } = await ctx.createUserWithOrg();
      const admin = await ctx.createUser();
      await ctx.createMembership({
        userId: admin.id,
        organizationId: organization.id,
        role: "admin",
      });
      const session = await ctx.createSession({
        userId: admin.id,
        currentOrgId: organization.id,
      });

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: { id: admin.id, email: admin.email, isAdmin: admin.isAdmin },
      });
      const caller = appRouter.createCaller(trpcCtx);

      try {
        await caller.organization.updateMemberRole({
          memberId: membership.id,
          role: "member",
        });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("FORBIDDEN");
      }
    });

    test("rejects non-existent member", async () => {
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

      try {
        await caller.organization.updateMemberRole({
          memberId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
          role: "admin",
        });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("NOT_FOUND");
      }
    });
  });

  describe("removeMember", () => {
    test("owner can remove member", async () => {
      const { user, organization } = await ctx.createUserWithOrg();
      const member = await ctx.createUser();
      const membership = await ctx.createMembership({
        userId: member.id,
        organizationId: organization.id,
        role: "member",
      });
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

      const result = await caller.organization.removeMember({
        memberId: membership.id,
      });

      expect(result.success).toBe(true);

      // Verify removal
      const deleted = await ctx.prisma.organizationMember.findUnique({
        where: { id: membership.id },
      });
      expect(deleted).toBeNull();
      ctx.membershipIds.delete(membership.id);
    });

    test("admin can remove member", async () => {
      const { organization } = await ctx.createUserWithOrg();
      const admin = await ctx.createUser();
      await ctx.createMembership({
        userId: admin.id,
        organizationId: organization.id,
        role: "admin",
      });
      const member = await ctx.createUser();
      const membership = await ctx.createMembership({
        userId: member.id,
        organizationId: organization.id,
        role: "member",
      });
      const session = await ctx.createSession({
        userId: admin.id,
        currentOrgId: organization.id,
      });

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: { id: admin.id, email: admin.email, isAdmin: admin.isAdmin },
      });
      const caller = appRouter.createCaller(trpcCtx);

      const result = await caller.organization.removeMember({
        memberId: membership.id,
      });

      expect(result.success).toBe(true);
      ctx.membershipIds.delete(membership.id);
    });

    test("admin cannot remove other admins", async () => {
      const { organization } = await ctx.createUserWithOrg();
      const admin1 = await ctx.createUser();
      await ctx.createMembership({
        userId: admin1.id,
        organizationId: organization.id,
        role: "admin",
      });
      const admin2 = await ctx.createUser();
      const membership = await ctx.createMembership({
        userId: admin2.id,
        organizationId: organization.id,
        role: "admin",
      });
      const session = await ctx.createSession({
        userId: admin1.id,
        currentOrgId: organization.id,
      });

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: { id: admin1.id, email: admin1.email, isAdmin: admin1.isAdmin },
      });
      const caller = appRouter.createCaller(trpcCtx);

      try {
        await caller.organization.removeMember({ memberId: membership.id });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("FORBIDDEN");
      }
    });

    test("cannot remove owner", async () => {
      const { organization, membership } = await ctx.createUserWithOrg();
      const admin = await ctx.createUser();
      await ctx.createMembership({
        userId: admin.id,
        organizationId: organization.id,
        role: "admin",
      });
      const session = await ctx.createSession({
        userId: admin.id,
        currentOrgId: organization.id,
      });

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: { id: admin.id, email: admin.email, isAdmin: admin.isAdmin },
      });
      const caller = appRouter.createCaller(trpcCtx);

      try {
        await caller.organization.removeMember({ memberId: membership.id });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("FORBIDDEN");
      }
    });

    test("cannot remove yourself", async () => {
      const { user, organization, membership } = await ctx.createUserWithOrg();
      // Add another user as owner so we can test with original user as admin
      const newOwner = await ctx.createUser();
      const _newOwnerMembership = await ctx.createMembership({
        userId: newOwner.id,
        organizationId: organization.id,
        role: "owner",
      });
      // Demote original user to admin
      await ctx.prisma.organizationMember.update({
        where: { id: membership.id },
        data: { role: "admin" },
      });

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

      try {
        await caller.organization.removeMember({ memberId: membership.id });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("FORBIDDEN");
      }
    });

    test("member cannot remove anyone", async () => {
      const { organization } = await ctx.createUserWithOrg();
      const member1 = await ctx.createUser();
      await ctx.createMembership({
        userId: member1.id,
        organizationId: organization.id,
        role: "member",
      });
      const member2 = await ctx.createUser();
      const membership = await ctx.createMembership({
        userId: member2.id,
        organizationId: organization.id,
        role: "member",
      });
      const session = await ctx.createSession({
        userId: member1.id,
        currentOrgId: organization.id,
      });

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: {
          id: member1.id,
          email: member1.email,
          isAdmin: member1.isAdmin,
        },
      });
      const caller = appRouter.createCaller(trpcCtx);

      try {
        await caller.organization.removeMember({ memberId: membership.id });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("FORBIDDEN");
      }
    });
  });

  describe("leave", () => {
    test("member can leave organization", async () => {
      const { organization } = await ctx.createUserWithOrg();
      const member = await ctx.createUser();
      const membership = await ctx.createMembership({
        userId: member.id,
        organizationId: organization.id,
        role: "member",
      });
      const session = await ctx.createSession({
        userId: member.id,
        currentOrgId: organization.id,
      });

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: { id: member.id, email: member.email, isAdmin: member.isAdmin },
      });
      const caller = appRouter.createCaller(trpcCtx);

      const result = await caller.organization.leave();

      expect(result.success).toBe(true);
      ctx.membershipIds.delete(membership.id);
    });

    test("admin can leave organization", async () => {
      const { organization } = await ctx.createUserWithOrg();
      const admin = await ctx.createUser();
      const membership = await ctx.createMembership({
        userId: admin.id,
        organizationId: organization.id,
        role: "admin",
      });
      const session = await ctx.createSession({
        userId: admin.id,
        currentOrgId: organization.id,
      });

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: { id: admin.id, email: admin.email, isAdmin: admin.isAdmin },
      });
      const caller = appRouter.createCaller(trpcCtx);

      const result = await caller.organization.leave();

      expect(result.success).toBe(true);
      ctx.membershipIds.delete(membership.id);
    });

    test("owner cannot leave organization", async () => {
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

      try {
        await caller.organization.leave();
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("FORBIDDEN");
      }
    });
  });

  describe("transferOwnership", () => {
    test("owner can transfer ownership", async () => {
      const { user, organization, membership } = await ctx.createUserWithOrg();
      const member = await ctx.createUser();
      const memberMembership = await ctx.createMembership({
        userId: member.id,
        organizationId: organization.id,
        role: "member",
      });
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

      const result = await caller.organization.transferOwnership({
        memberId: memberMembership.id,
      });

      expect(result.success).toBe(true);
      expect(result.newOwnerEmail).toBe(member.email);

      // Verify roles changed
      const oldOwner = await ctx.prisma.organizationMember.findUnique({
        where: { id: membership.id },
      });
      const newOwner = await ctx.prisma.organizationMember.findUnique({
        where: { id: memberMembership.id },
      });
      expect(oldOwner?.role).toBe("admin");
      expect(newOwner?.role).toBe("owner");
    });

    test("non-owner cannot transfer ownership", async () => {
      const { organization, membership } = await ctx.createUserWithOrg();
      const admin = await ctx.createUser();
      await ctx.createMembership({
        userId: admin.id,
        organizationId: organization.id,
        role: "admin",
      });
      const session = await ctx.createSession({
        userId: admin.id,
        currentOrgId: organization.id,
      });

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: { id: admin.id, email: admin.email, isAdmin: admin.isAdmin },
      });
      const caller = appRouter.createCaller(trpcCtx);

      try {
        await caller.organization.transferOwnership({
          memberId: membership.id,
        });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("FORBIDDEN");
      }
    });

    test("cannot transfer to self", async () => {
      const { user, organization, membership } = await ctx.createUserWithOrg();
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

      try {
        await caller.organization.transferOwnership({
          memberId: membership.id,
        });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("BAD_REQUEST");
      }
    });
  });

  describe("getInvitationByToken", () => {
    test("returns invitation details for valid token", async () => {
      const { user, organization } = await ctx.createUserWithOrg();
      const _session = await ctx.createSession({
        userId: user.id,
        currentOrgId: organization.id,
      });

      // Create invitation directly in DB with known token
      const crypto = await import("node:crypto");
      const token = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const invitation = await ctx.prisma.organizationInvitation.create({
        data: {
          organizationId: organization.id,
          email: "invitee@example.com",
          role: "member",
          tokenHash,
          invitedById: user.id,
          expiresAt,
        },
      });

      const trpcCtx = createTestTRPCContext({ prisma: ctx.prisma });
      const caller = appRouter.createCaller(trpcCtx);

      const result = await caller.organization.getInvitationByToken({ token });

      expect(result.email).toBe("invitee@example.com");
      expect(result.organizationName).toBe(organization.name);
      expect(result.role).toBe("member");
      expect(result.invitedBy).toBe(user.email);

      // Cleanup
      await ctx.prisma.organizationInvitation.delete({
        where: { id: invitation.id },
      });
    });

    test("rejects invalid token", async () => {
      const trpcCtx = createTestTRPCContext({ prisma: ctx.prisma });
      const caller = appRouter.createCaller(trpcCtx);

      try {
        await caller.organization.getInvitationByToken({
          token: "invalid-token",
        });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("NOT_FOUND");
      }
    });

    test("rejects expired token", async () => {
      const { user, organization } = await ctx.createUserWithOrg();

      const crypto = await import("node:crypto");
      const token = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() - 1); // Expired yesterday

      const invitation = await ctx.prisma.organizationInvitation.create({
        data: {
          organizationId: organization.id,
          email: "expired@example.com",
          role: "member",
          tokenHash,
          invitedById: user.id,
          expiresAt,
        },
      });

      const trpcCtx = createTestTRPCContext({ prisma: ctx.prisma });
      const caller = appRouter.createCaller(trpcCtx);

      try {
        await caller.organization.getInvitationByToken({ token });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("NOT_FOUND");
      }

      // Cleanup
      await ctx.prisma.organizationInvitation.delete({
        where: { id: invitation.id },
      });
    });
  });

  describe("acceptInvitation", () => {
    test("accepts valid invitation", async () => {
      const { user: owner, organization } = await ctx.createUserWithOrg();
      const invitee = await ctx.createUser();
      const session = await ctx.createSession({ userId: invitee.id });

      // Create invitation
      const crypto = await import("node:crypto");
      const token = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const invitation = await ctx.prisma.organizationInvitation.create({
        data: {
          organizationId: organization.id,
          email: invitee.email,
          role: "member",
          tokenHash,
          invitedById: owner.id,
          expiresAt,
        },
      });

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: {
          id: invitee.id,
          email: invitee.email,
          isAdmin: invitee.isAdmin,
        },
      });
      const caller = appRouter.createCaller(trpcCtx);

      const result = await caller.organization.acceptInvitation({ token });

      expect(result.organizationId).toBe(organization.id);
      expect(result.role).toBe("member");

      // Verify membership was created
      const membership = await ctx.prisma.organizationMember.findFirst({
        where: {
          userId: invitee.id,
          organizationId: organization.id,
        },
      });
      expect(membership).not.toBeNull();
      if (membership) ctx.membershipIds.add(membership.id);

      // Cleanup invitation
      await ctx.prisma.organizationInvitation.delete({
        where: { id: invitation.id },
      });
    });

    test("rejects invitation for wrong email", async () => {
      const { user: owner, organization } = await ctx.createUserWithOrg();
      const wrongUser = await ctx.createUser();
      const session = await ctx.createSession({ userId: wrongUser.id });

      // Create invitation for different email
      const crypto = await import("node:crypto");
      const token = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const invitation = await ctx.prisma.organizationInvitation.create({
        data: {
          organizationId: organization.id,
          email: "different@example.com",
          role: "member",
          tokenHash,
          invitedById: owner.id,
          expiresAt,
        },
      });

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: {
          id: wrongUser.id,
          email: wrongUser.email,
          isAdmin: wrongUser.isAdmin,
        },
      });
      const caller = appRouter.createCaller(trpcCtx);

      try {
        await caller.organization.acceptInvitation({ token });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("FORBIDDEN");
      }

      // Cleanup
      await ctx.prisma.organizationInvitation.delete({
        where: { id: invitation.id },
      });
    });

    test("handles already member case", async () => {
      const { user: owner, organization } = await ctx.createUserWithOrg();
      const existingMember = await ctx.createUser();
      await ctx.createMembership({
        userId: existingMember.id,
        organizationId: organization.id,
        role: "member",
      });
      const session = await ctx.createSession({ userId: existingMember.id });

      // Create invitation
      const crypto = await import("node:crypto");
      const token = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const invitation = await ctx.prisma.organizationInvitation.create({
        data: {
          organizationId: organization.id,
          email: existingMember.email,
          role: "admin",
          tokenHash,
          invitedById: owner.id,
          expiresAt,
        },
      });

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: {
          id: existingMember.id,
          email: existingMember.email,
          isAdmin: existingMember.isAdmin,
        },
      });
      const caller = appRouter.createCaller(trpcCtx);

      try {
        await caller.organization.acceptInvitation({ token });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("CONFLICT");
      }

      // Cleanup - invitation should be marked as accepted
      await ctx.prisma.organizationInvitation.delete({
        where: { id: invitation.id },
      });
    });
  });

  describe("cancelInvitation", () => {
    test("owner can cancel invitation", async () => {
      const { user, organization } = await ctx.createUserWithOrg();
      const session = await ctx.createSession({
        userId: user.id,
        currentOrgId: organization.id,
      });

      // Create invitation
      const crypto = await import("node:crypto");
      const tokenHash = crypto
        .createHash("sha256")
        .update("test")
        .digest("hex");
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const invitation = await ctx.prisma.organizationInvitation.create({
        data: {
          organizationId: organization.id,
          email: "tocancel@example.com",
          role: "member",
          tokenHash,
          invitedById: user.id,
          expiresAt,
        },
      });

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
      });
      const caller = appRouter.createCaller(trpcCtx);

      const result = await caller.organization.cancelInvitation({
        invitationId: invitation.id,
      });

      expect(result.success).toBe(true);

      // Verify deletion
      const deleted = await ctx.prisma.organizationInvitation.findUnique({
        where: { id: invitation.id },
      });
      expect(deleted).toBeNull();
    });

    test("member cannot cancel invitation", async () => {
      const { user, organization } = await ctx.createUserWithOrg();
      const member = await ctx.createUser();
      await ctx.createMembership({
        userId: member.id,
        organizationId: organization.id,
        role: "member",
      });
      const session = await ctx.createSession({
        userId: member.id,
        currentOrgId: organization.id,
      });

      // Create invitation
      const crypto = await import("node:crypto");
      const tokenHash = crypto
        .createHash("sha256")
        .update("test2")
        .digest("hex");
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const invitation = await ctx.prisma.organizationInvitation.create({
        data: {
          organizationId: organization.id,
          email: "test2@example.com",
          role: "member",
          tokenHash,
          invitedById: user.id,
          expiresAt,
        },
      });

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: { id: member.id, email: member.email, isAdmin: member.isAdmin },
      });
      const caller = appRouter.createCaller(trpcCtx);

      try {
        await caller.organization.cancelInvitation({
          invitationId: invitation.id,
        });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("FORBIDDEN");
      }

      // Cleanup
      await ctx.prisma.organizationInvitation.delete({
        where: { id: invitation.id },
      });
    });
  });

  describe("listInvitations", () => {
    test("owner can list invitations", async () => {
      const { user, organization } = await ctx.createUserWithOrg();
      const session = await ctx.createSession({
        userId: user.id,
        currentOrgId: organization.id,
      });

      // Create invitations
      const crypto = await import("node:crypto");
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const inv1 = await ctx.prisma.organizationInvitation.create({
        data: {
          organizationId: organization.id,
          email: "inv1@example.com",
          role: "member",
          tokenHash: crypto.createHash("sha256").update("t1").digest("hex"),
          invitedById: user.id,
          expiresAt,
        },
      });
      const inv2 = await ctx.prisma.organizationInvitation.create({
        data: {
          organizationId: organization.id,
          email: "inv2@example.com",
          role: "admin",
          tokenHash: crypto.createHash("sha256").update("t2").digest("hex"),
          invitedById: user.id,
          expiresAt,
        },
      });

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
      });
      const caller = appRouter.createCaller(trpcCtx);

      const result = await caller.organization.listInvitations();

      expect(result).toHaveLength(2);
      expect(result.map((i) => i.email).sort()).toEqual([
        "inv1@example.com",
        "inv2@example.com",
      ]);

      // Cleanup
      await ctx.prisma.organizationInvitation.deleteMany({
        where: { id: { in: [inv1.id, inv2.id] } },
      });
    });

    test("member cannot list invitations", async () => {
      const { organization } = await ctx.createUserWithOrg();
      const member = await ctx.createUser();
      await ctx.createMembership({
        userId: member.id,
        organizationId: organization.id,
        role: "member",
      });
      const session = await ctx.createSession({
        userId: member.id,
        currentOrgId: organization.id,
      });

      const trpcCtx = createTestTRPCContext({
        prisma: ctx.prisma,
        sessionId: session.id,
        session,
        user: { id: member.id, email: member.email, isAdmin: member.isAdmin },
      });
      const caller = appRouter.createCaller(trpcCtx);

      try {
        await caller.organization.listInvitations();
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("FORBIDDEN");
      }
    });
  });
});
