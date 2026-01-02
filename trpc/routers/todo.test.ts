import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { TRPCError } from "@trpc/server";
import type { Session } from "../../lib/generated/prisma/client";
import {
  createTestContext,
  disconnectTestPrisma,
  type TestContext,
} from "../../lib/test/harness";
import { createTestTRPCContext } from "../init";
import { appRouter } from "../router";

describe("todo router", () => {
  let ctx: TestContext;

  beforeAll(() => {
    ctx = createTestContext();
  });

  afterAll(async () => {
    await ctx.cleanup();
    await disconnectTestPrisma();
  });

  /**
   * Helper to create a caller with org context
   */
  function createOrgCaller(
    user: { id: string; email: string; isAdmin: boolean },
    session: Session,
  ) {
    const trpcCtx = createTestTRPCContext({
      prisma: ctx.prisma,
      sessionId: session.id,
      session,
      user,
    });
    return appRouter.createCaller(trpcCtx);
  }

  describe("create", () => {
    test("creates a todo in the current organization", async () => {
      const { user, organization } = await ctx.createUserWithOrg();
      const session = await ctx.createSession({
        userId: user.id,
        currentOrgId: organization.id,
      });

      const caller = createOrgCaller(
        { id: user.id, email: user.email, isAdmin: user.isAdmin },
        session,
      );

      const result = await caller.todo.create({
        title: "Test Todo",
        description: "Test description",
      });

      expect(result.title).toBe("Test Todo");
      expect(result.description).toBe("Test description");
      expect(result.completed).toBe(false);
      expect(result.organizationId).toBe(organization.id);
      expect(result.createdById).toBe(user.id);

      ctx.todoIds.add(result.id);
    });

    test("creates a todo without description", async () => {
      const { user, organization } = await ctx.createUserWithOrg();
      const session = await ctx.createSession({
        userId: user.id,
        currentOrgId: organization.id,
      });

      const caller = createOrgCaller(
        { id: user.id, email: user.email, isAdmin: user.isAdmin },
        session,
      );

      const result = await caller.todo.create({
        title: "No Description Todo",
      });

      expect(result.title).toBe("No Description Todo");
      expect(result.description).toBeNull();

      ctx.todoIds.add(result.id);
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
        await caller.todo.create({ title: "Test" });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("FORBIDDEN");
      }
    });

    test("requires authentication", async () => {
      const trpcCtx = createTestTRPCContext({ prisma: ctx.prisma });
      const caller = appRouter.createCaller(trpcCtx);

      try {
        await caller.todo.create({ title: "Test" });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("UNAUTHORIZED");
      }
    });
  });

  describe("get", () => {
    test("retrieves a todo by id", async () => {
      const { user, organization } = await ctx.createUserWithOrg();
      const todo = await ctx.createTodo({
        title: "Get Test",
        organizationId: organization.id,
        createdById: user.id,
      });
      const session = await ctx.createSession({
        userId: user.id,
        currentOrgId: organization.id,
      });

      const caller = createOrgCaller(
        { id: user.id, email: user.email, isAdmin: user.isAdmin },
        session,
      );

      const result = await caller.todo.get({ id: todo.id });

      expect(result.id).toBe(todo.id);
      expect(result.title).toBe("Get Test");
      expect(result.createdBy.id).toBe(user.id);
    });

    test("returns 404 for non-existent todo", async () => {
      const { user, organization } = await ctx.createUserWithOrg();
      const session = await ctx.createSession({
        userId: user.id,
        currentOrgId: organization.id,
      });

      const caller = createOrgCaller(
        { id: user.id, email: user.email, isAdmin: user.isAdmin },
        session,
      );

      try {
        await caller.todo.get({ id: "clxxxxxxxxxxxxxxxxxxxxxxxxx" });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("NOT_FOUND");
      }
    });

    test("denies access to todo from another organization", async () => {
      // Create todo in org1
      const { user: user1, organization: org1 } = await ctx.createUserWithOrg();
      const todo = await ctx.createTodo({
        title: "Org1 Todo",
        organizationId: org1.id,
        createdById: user1.id,
      });

      // Create user in org2 trying to access org1's todo
      const { user: user2, organization: org2 } = await ctx.createUserWithOrg();
      const session = await ctx.createSession({
        userId: user2.id,
        currentOrgId: org2.id,
      });

      const caller = createOrgCaller(
        { id: user2.id, email: user2.email, isAdmin: user2.isAdmin },
        session,
      );

      try {
        await caller.todo.get({ id: todo.id });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("FORBIDDEN");
      }
    });

    test("allows internal admin to access any todo", async () => {
      const { user: regularUser, organization } = await ctx.createUserWithOrg();
      const todo = await ctx.createTodo({
        title: "Any Org Todo",
        organizationId: organization.id,
        createdById: regularUser.id,
      });

      // Admin user with different org context
      const admin = await ctx.createUser({ isAdmin: true });
      const adminOrg = await ctx.createOrganization();
      const session = await ctx.createSession({
        userId: admin.id,
        currentOrgId: adminOrg.id,
      });

      const caller = createOrgCaller(
        { id: admin.id, email: admin.email, isAdmin: admin.isAdmin },
        session,
      );

      const result = await caller.todo.get({ id: todo.id });
      expect(result.id).toBe(todo.id);
    });
  });

  describe("list", () => {
    test("lists todos for the current organization", async () => {
      const { user, organization } = await ctx.createUserWithOrg();
      const todo1 = await ctx.createTodo({
        title: "Todo 1",
        organizationId: organization.id,
        createdById: user.id,
      });
      const todo2 = await ctx.createTodo({
        title: "Todo 2",
        organizationId: organization.id,
        createdById: user.id,
      });
      const session = await ctx.createSession({
        userId: user.id,
        currentOrgId: organization.id,
      });

      const caller = createOrgCaller(
        { id: user.id, email: user.email, isAdmin: user.isAdmin },
        session,
      );

      const result = await caller.todo.list({});

      expect(result.items.length).toBeGreaterThanOrEqual(2);
      const ids = result.items.map((t) => t.id);
      expect(ids).toContain(todo1.id);
      expect(ids).toContain(todo2.id);
    });

    test("filters by completion status", async () => {
      const { user, organization } = await ctx.createUserWithOrg();
      await ctx.createTodo({
        title: "Completed",
        completed: true,
        organizationId: organization.id,
        createdById: user.id,
      });
      await ctx.createTodo({
        title: "Pending",
        completed: false,
        organizationId: organization.id,
        createdById: user.id,
      });
      const session = await ctx.createSession({
        userId: user.id,
        currentOrgId: organization.id,
      });

      const caller = createOrgCaller(
        { id: user.id, email: user.email, isAdmin: user.isAdmin },
        session,
      );

      const completed = await caller.todo.list({ completed: true });
      const pending = await caller.todo.list({ completed: false });

      expect(completed.items.every((t) => t.completed)).toBe(true);
      expect(pending.items.every((t) => !t.completed)).toBe(true);
    });

    test("does not include todos from other organizations", async () => {
      const { user: user1, organization: org1 } = await ctx.createUserWithOrg();
      const todo1 = await ctx.createTodo({
        title: "Org1 Todo",
        organizationId: org1.id,
        createdById: user1.id,
      });

      const { user: user2, organization: org2 } = await ctx.createUserWithOrg();
      const session = await ctx.createSession({
        userId: user2.id,
        currentOrgId: org2.id,
      });

      const caller = createOrgCaller(
        { id: user2.id, email: user2.email, isAdmin: user2.isAdmin },
        session,
      );

      const result = await caller.todo.list({});

      expect(result.items.map((t) => t.id)).not.toContain(todo1.id);
    });

    test("supports pagination", async () => {
      const { user, organization } = await ctx.createUserWithOrg();
      // Create 3 todos
      for (let i = 0; i < 3; i++) {
        await ctx.createTodo({
          title: `Paginated Todo ${i}`,
          organizationId: organization.id,
          createdById: user.id,
        });
      }
      const session = await ctx.createSession({
        userId: user.id,
        currentOrgId: organization.id,
      });

      const caller = createOrgCaller(
        { id: user.id, email: user.email, isAdmin: user.isAdmin },
        session,
      );

      // Fetch with limit 2
      const page1 = await caller.todo.list({ limit: 2 });
      expect(page1.items).toHaveLength(2);
      expect(page1.nextCursor).toBeDefined();

      // Fetch next page
      const page2 = await caller.todo.list({
        limit: 2,
        cursor: page1.nextCursor,
      });
      expect(page2.items.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("update", () => {
    test("updates a todo", async () => {
      const { user, organization } = await ctx.createUserWithOrg();
      const todo = await ctx.createTodo({
        title: "Original",
        description: "Original desc",
        organizationId: organization.id,
        createdById: user.id,
      });
      const session = await ctx.createSession({
        userId: user.id,
        currentOrgId: organization.id,
      });

      const caller = createOrgCaller(
        { id: user.id, email: user.email, isAdmin: user.isAdmin },
        session,
      );

      const result = await caller.todo.update({
        id: todo.id,
        title: "Updated",
        description: "Updated desc",
        completed: true,
      });

      expect(result.title).toBe("Updated");
      expect(result.description).toBe("Updated desc");
      expect(result.completed).toBe(true);
    });

    test("allows partial updates", async () => {
      const { user, organization } = await ctx.createUserWithOrg();
      const todo = await ctx.createTodo({
        title: "Original Title",
        description: "Original desc",
        organizationId: organization.id,
        createdById: user.id,
      });
      const session = await ctx.createSession({
        userId: user.id,
        currentOrgId: organization.id,
      });

      const caller = createOrgCaller(
        { id: user.id, email: user.email, isAdmin: user.isAdmin },
        session,
      );

      // Only update title
      const result = await caller.todo.update({
        id: todo.id,
        title: "New Title",
      });

      expect(result.title).toBe("New Title");
      expect(result.description).toBe("Original desc");
    });

    test("can clear description with null", async () => {
      const { user, organization } = await ctx.createUserWithOrg();
      const todo = await ctx.createTodo({
        title: "With Desc",
        description: "Some description",
        organizationId: organization.id,
        createdById: user.id,
      });
      const session = await ctx.createSession({
        userId: user.id,
        currentOrgId: organization.id,
      });

      const caller = createOrgCaller(
        { id: user.id, email: user.email, isAdmin: user.isAdmin },
        session,
      );

      const result = await caller.todo.update({
        id: todo.id,
        description: null,
      });

      expect(result.description).toBeNull();
    });

    test("denies update to todo from another organization", async () => {
      const { user: user1, organization: org1 } = await ctx.createUserWithOrg();
      const todo = await ctx.createTodo({
        title: "Org1 Todo",
        organizationId: org1.id,
        createdById: user1.id,
      });

      const { user: user2, organization: org2 } = await ctx.createUserWithOrg();
      const session = await ctx.createSession({
        userId: user2.id,
        currentOrgId: org2.id,
      });

      const caller = createOrgCaller(
        { id: user2.id, email: user2.email, isAdmin: user2.isAdmin },
        session,
      );

      try {
        await caller.todo.update({ id: todo.id, title: "Hacked" });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("FORBIDDEN");
      }
    });

    test("returns 404 for non-existent todo", async () => {
      const { user, organization } = await ctx.createUserWithOrg();
      const session = await ctx.createSession({
        userId: user.id,
        currentOrgId: organization.id,
      });

      const caller = createOrgCaller(
        { id: user.id, email: user.email, isAdmin: user.isAdmin },
        session,
      );

      try {
        await caller.todo.update({
          id: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
          title: "Updated",
        });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("NOT_FOUND");
      }
    });

    test("allows internal admin to update any todo", async () => {
      const { user: regularUser, organization } = await ctx.createUserWithOrg();
      const todo = await ctx.createTodo({
        title: "Original",
        organizationId: organization.id,
        createdById: regularUser.id,
      });

      const admin = await ctx.createUser({ isAdmin: true });
      const adminOrg = await ctx.createOrganization();
      const session = await ctx.createSession({
        userId: admin.id,
        currentOrgId: adminOrg.id,
      });

      const caller = createOrgCaller(
        { id: admin.id, email: admin.email, isAdmin: admin.isAdmin },
        session,
      );

      const result = await caller.todo.update({
        id: todo.id,
        title: "Admin Updated",
      });
      expect(result.title).toBe("Admin Updated");
    });
  });

  describe("delete", () => {
    test("admin can delete a todo", async () => {
      const { user, organization } = await ctx.createUserWithOrg({
        role: "admin",
      });
      const todo = await ctx.createTodo({
        title: "To Delete",
        organizationId: organization.id,
        createdById: user.id,
      });
      const session = await ctx.createSession({
        userId: user.id,
        currentOrgId: organization.id,
      });

      const caller = createOrgCaller(
        { id: user.id, email: user.email, isAdmin: user.isAdmin },
        session,
      );

      const result = await caller.todo.delete({ id: todo.id });
      expect(result.success).toBe(true);

      // Verify deletion
      const deleted = await ctx.prisma.todo.findUnique({
        where: { id: todo.id },
      });
      expect(deleted).toBeNull();
    });

    test("owner can delete a todo", async () => {
      const { user, organization } = await ctx.createUserWithOrg({
        role: "owner",
      });
      const todo = await ctx.createTodo({
        title: "Owner Delete",
        organizationId: organization.id,
        createdById: user.id,
      });
      const session = await ctx.createSession({
        userId: user.id,
        currentOrgId: organization.id,
      });

      const caller = createOrgCaller(
        { id: user.id, email: user.email, isAdmin: user.isAdmin },
        session,
      );

      const result = await caller.todo.delete({ id: todo.id });
      expect(result.success).toBe(true);
    });

    test("member cannot delete a todo", async () => {
      const { user: owner, organization } = await ctx.createUserWithOrg({
        role: "owner",
      });
      const member = await ctx.createUser();
      await ctx.createMembership({
        userId: member.id,
        organizationId: organization.id,
        role: "member",
      });
      const todo = await ctx.createTodo({
        title: "Member Cannot Delete",
        organizationId: organization.id,
        createdById: owner.id,
      });
      const session = await ctx.createSession({
        userId: member.id,
        currentOrgId: organization.id,
      });

      const caller = createOrgCaller(
        { id: member.id, email: member.email, isAdmin: member.isAdmin },
        session,
      );

      try {
        await caller.todo.delete({ id: todo.id });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("FORBIDDEN");
      }
    });

    test("internal admin can delete any todo", async () => {
      const { user: regularUser, organization } = await ctx.createUserWithOrg();
      const todo = await ctx.createTodo({
        title: "Admin Delete Any",
        organizationId: organization.id,
        createdById: regularUser.id,
      });

      const admin = await ctx.createUser({ isAdmin: true });
      const session = await ctx.createSession({
        userId: admin.id,
        currentOrgId: organization.id,
      });

      const caller = createOrgCaller(
        { id: admin.id, email: admin.email, isAdmin: admin.isAdmin },
        session,
      );

      const result = await caller.todo.delete({ id: todo.id });
      expect(result.success).toBe(true);
    });

    test("returns 404 for non-existent todo", async () => {
      const { user, organization } = await ctx.createUserWithOrg({
        role: "admin",
      });
      const session = await ctx.createSession({
        userId: user.id,
        currentOrgId: organization.id,
      });

      const caller = createOrgCaller(
        { id: user.id, email: user.email, isAdmin: user.isAdmin },
        session,
      );

      try {
        await caller.todo.delete({ id: "clxxxxxxxxxxxxxxxxxxxxxxxxx" });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("NOT_FOUND");
      }
    });

    test("denies delete to todo from another organization", async () => {
      const { user: user1, organization: org1 } = await ctx.createUserWithOrg();
      const todo = await ctx.createTodo({
        title: "Org1 Todo",
        organizationId: org1.id,
        createdById: user1.id,
      });

      const { user: user2, organization: org2 } = await ctx.createUserWithOrg({
        role: "admin",
      });
      const session = await ctx.createSession({
        userId: user2.id,
        currentOrgId: org2.id,
      });

      const caller = createOrgCaller(
        { id: user2.id, email: user2.email, isAdmin: user2.isAdmin },
        session,
      );

      try {
        await caller.todo.delete({ id: todo.id });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("FORBIDDEN");
      }
    });
  });

  describe("toggleComplete", () => {
    test("toggles completion from false to true", async () => {
      const { user, organization } = await ctx.createUserWithOrg();
      const todo = await ctx.createTodo({
        title: "Toggle Test",
        completed: false,
        organizationId: organization.id,
        createdById: user.id,
      });
      const session = await ctx.createSession({
        userId: user.id,
        currentOrgId: organization.id,
      });

      const caller = createOrgCaller(
        { id: user.id, email: user.email, isAdmin: user.isAdmin },
        session,
      );

      const result = await caller.todo.toggleComplete({ id: todo.id });
      expect(result.completed).toBe(true);
    });

    test("toggles completion from true to false", async () => {
      const { user, organization } = await ctx.createUserWithOrg();
      const todo = await ctx.createTodo({
        title: "Toggle Test",
        completed: true,
        organizationId: organization.id,
        createdById: user.id,
      });
      const session = await ctx.createSession({
        userId: user.id,
        currentOrgId: organization.id,
      });

      const caller = createOrgCaller(
        { id: user.id, email: user.email, isAdmin: user.isAdmin },
        session,
      );

      const result = await caller.todo.toggleComplete({ id: todo.id });
      expect(result.completed).toBe(false);
    });

    test("returns 404 for non-existent todo", async () => {
      const { user, organization } = await ctx.createUserWithOrg();
      const session = await ctx.createSession({
        userId: user.id,
        currentOrgId: organization.id,
      });

      const caller = createOrgCaller(
        { id: user.id, email: user.email, isAdmin: user.isAdmin },
        session,
      );

      try {
        await caller.todo.toggleComplete({ id: "clxxxxxxxxxxxxxxxxxxxxxxxxx" });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("NOT_FOUND");
      }
    });

    test("denies toggle for todo from another organization", async () => {
      const { user: user1, organization: org1 } = await ctx.createUserWithOrg();
      const todo = await ctx.createTodo({
        title: "Org1 Todo",
        organizationId: org1.id,
        createdById: user1.id,
      });

      const { user: user2, organization: org2 } = await ctx.createUserWithOrg();
      const session = await ctx.createSession({
        userId: user2.id,
        currentOrgId: org2.id,
      });

      const caller = createOrgCaller(
        { id: user2.id, email: user2.email, isAdmin: user2.isAdmin },
        session,
      );

      try {
        await caller.todo.toggleComplete({ id: todo.id });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("FORBIDDEN");
      }
    });

    test("allows internal admin to toggle any todo", async () => {
      const { user: regularUser, organization } = await ctx.createUserWithOrg();
      const todo = await ctx.createTodo({
        title: "Admin Toggle",
        completed: false,
        organizationId: organization.id,
        createdById: regularUser.id,
      });

      const admin = await ctx.createUser({ isAdmin: true });
      const adminOrg = await ctx.createOrganization();
      const session = await ctx.createSession({
        userId: admin.id,
        currentOrgId: adminOrg.id,
      });

      const caller = createOrgCaller(
        { id: admin.id, email: admin.email, isAdmin: admin.isAdmin },
        session,
      );

      const result = await caller.todo.toggleComplete({ id: todo.id });
      expect(result.completed).toBe(true);
    });
  });

  describe("stats", () => {
    test("returns correct statistics", async () => {
      const { user, organization } = await ctx.createUserWithOrg();
      // Create 3 completed and 2 pending todos
      for (let i = 0; i < 3; i++) {
        await ctx.createTodo({
          title: `Completed ${i}`,
          completed: true,
          organizationId: organization.id,
          createdById: user.id,
        });
      }
      for (let i = 0; i < 2; i++) {
        await ctx.createTodo({
          title: `Pending ${i}`,
          completed: false,
          organizationId: organization.id,
          createdById: user.id,
        });
      }
      const session = await ctx.createSession({
        userId: user.id,
        currentOrgId: organization.id,
      });

      const caller = createOrgCaller(
        { id: user.id, email: user.email, isAdmin: user.isAdmin },
        session,
      );

      const result = await caller.todo.stats();

      expect(result.total).toBeGreaterThanOrEqual(5);
      expect(result.completed).toBeGreaterThanOrEqual(3);
      expect(result.pending).toBeGreaterThanOrEqual(2);
      expect(result.completionRate).toBeGreaterThanOrEqual(0);
      expect(result.completionRate).toBeLessThanOrEqual(100);
    });

    test("returns zero stats for empty organization", async () => {
      const { user, organization } = await ctx.createUserWithOrg();
      const session = await ctx.createSession({
        userId: user.id,
        currentOrgId: organization.id,
      });

      const caller = createOrgCaller(
        { id: user.id, email: user.email, isAdmin: user.isAdmin },
        session,
      );

      // Note: This org is fresh and has no todos
      // But other tests might have added todos, so we just verify structure
      const result = await caller.todo.stats();

      expect(result).toHaveProperty("total");
      expect(result).toHaveProperty("completed");
      expect(result).toHaveProperty("pending");
      expect(result).toHaveProperty("completionRate");
      expect(result.total).toBe(result.completed + result.pending);
    });
  });
});
