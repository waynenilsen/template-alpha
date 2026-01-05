/**
 * Todo Router Tests
 *
 * These tests use the scenario framework to provide readable, story-like tests
 * for the todo router functionality.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { TRPCError } from "@trpc/server";
import type { Plan } from "../../lib/generated/prisma/client";
import { createTestContext, type TestContext } from "../../lib/test/harness";
import { scenario } from "../../lib/test/scenario";
import { createTestTRPCContext } from "../init";
import { appRouter } from "../router";

describe("todo router", () => {
  // ===========================================================================
  // Create Operations
  // ===========================================================================

  describe("create", () => {
    scenario(
      "Alice creates a todo with title and description",
      async ({ alice, acmeCorp }) => {
        const todo = await alice.at(acmeCorp).createTodo({
          title: "Test Todo",
          description: "Test description",
        });

        expect(todo.title).toBe("Test Todo");
        expect(todo.description).toBe("Test description");
        expect(todo.completed).toBe(false);
      },
    );

    scenario(
      "Alice creates a todo without description",
      async ({ alice, acmeCorp }) => {
        const todo = await alice.at(acmeCorp).createTodo({
          title: "No Description Todo",
        });

        expect(todo.title).toBe("No Description Todo");
        expect(todo.description).toBeNull();
      },
    );

    // These tests require low-level access to test auth/org context requirements
    describe("auth requirements", () => {
      let ctx: TestContext;

      beforeAll(() => {
        ctx = createTestContext();
      });

      afterAll(async () => {
        await ctx.cleanup();
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

    // Test subscription limits
    describe("subscription limits", () => {
      let ctx: TestContext;
      let limitedPlan: Plan;

      beforeAll(async () => {
        ctx = createTestContext();
        // Create a plan with very low todo limit
        limitedPlan = await ctx.createPlan({
          slug: "limited-test",
          name: "Limited",
          description: "Limited plan for testing",
          priceMonthly: 0,
          limits: { maxTodos: 2, maxMembers: 1, maxOrganizations: 1 },
          isDefault: true,
          active: true,
        });
      });

      afterAll(async () => {
        await ctx.cleanup();
      });

      test("rejects creating todo when limit is reached", async () => {
        const { user, organization } = await ctx.createUserWithOrg();
        const session = await ctx.signIn(user, organization.id);

        // Create subscription with limited plan
        await ctx.createSubscription({
          organizationId: organization.id,
          planId: limitedPlan.id,
        });

        const trpcCtx = createTestTRPCContext({
          prisma: ctx.prisma,
          sessionId: session.id,
          session,
          user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
        });
        const caller = appRouter.createCaller(trpcCtx);

        // Create 2 todos (at limit)
        await caller.todo.create({ title: "Todo 1" });
        await caller.todo.create({ title: "Todo 2" });

        // Third should fail
        try {
          await caller.todo.create({ title: "Todo 3" });
          expect(true).toBe(false); // Should not reach here
        } catch (error) {
          expect(error).toBeInstanceOf(TRPCError);
          expect((error as TRPCError).code).toBe("FORBIDDEN");
          expect((error as TRPCError).message).toContain("Todo limit reached");
        }
      });
    });
  });

  // ===========================================================================
  // Get Operations
  // ===========================================================================

  describe("get", () => {
    scenario("Alice retrieves her todo by id", async ({ alice, acmeCorp }) => {
      const created = await alice
        .at(acmeCorp)
        .createTodo({ title: "Get Test" });

      const result = await alice.at(acmeCorp).getTodo({ id: created.id });

      expect(result.id).toBe(created.id);
      expect(result.title).toBe("Get Test");
      expect(result.createdBy.email).toContain("alice");
    });

    scenario(
      "Getting a non-existent todo returns 404",
      async ({ alice, acmeCorp }) => {
        await expect(
          alice.at(acmeCorp).getTodo({ id: "clxxxxxxxxxxxxxxxxxxxxxxxxx" }),
        ).rejects.toThrow("not found");
      },
    );

    scenario(
      "Bob cannot access Alice's todo from another org",
      async ({ alice, bob, acmeCorp, globex }) => {
        const aliceTodo = await alice
          .at(acmeCorp)
          .createTodo({ title: "Org1 Todo" });

        await expect(
          bob.at(globex).getTodo({ id: aliceTodo.id }),
        ).rejects.toThrow("do not have access");
      },
    );

    scenario(
      "Sysadmin can access any organization's todo",
      async ({ alice, sysadmin, acmeCorp, globex }) => {
        const todo = await alice
          .at(acmeCorp)
          .createTodo({ title: "Any Org Todo" });

        const result = await sysadmin.at(globex).getTodo({ id: todo.id });

        expect(result.id).toBe(todo.id);
      },
    );
  });

  // ===========================================================================
  // List Operations
  // ===========================================================================

  describe("list", () => {
    scenario(
      "Alice lists todos for her organization",
      async ({ alice, acmeCorp }) => {
        await alice.at(acmeCorp).createTodo({ title: "Todo 1" });
        await alice.at(acmeCorp).createTodo({ title: "Todo 2" });

        const result = await alice.at(acmeCorp).listTodos();

        expect(result.items.length).toBeGreaterThanOrEqual(2);
        expect(result.items.some((t) => t.title === "Todo 1")).toBe(true);
        expect(result.items.some((t) => t.title === "Todo 2")).toBe(true);
      },
    );

    scenario(
      "Alice filters todos by completion status",
      async ({ alice, acmeCorp }) => {
        await alice.at(acmeCorp).createTodo({ title: "Completed" });
        await alice.at(acmeCorp).createTodo({ title: "Pending" });

        const todos = await alice.at(acmeCorp).listTodos();
        await alice.at(acmeCorp).toggleTodo({ id: todos.items[0].id });

        const completed = await alice
          .at(acmeCorp)
          .listTodos({ completed: true });
        const pending = await alice
          .at(acmeCorp)
          .listTodos({ completed: false });

        expect(completed.items.every((t) => t.completed)).toBe(true);
        expect(pending.items.every((t) => !t.completed)).toBe(true);
      },
    );

    scenario(
      "Alice's list does not include Bob's todos from another org",
      async ({ alice, bob, acmeCorp, globex }) => {
        await alice.at(acmeCorp).createTodo({ title: "Org1 Todo" });
        await bob.at(globex).createTodo({ title: "Org2 Todo" });

        const aliceTodos = await alice.at(acmeCorp).listTodos();

        expect(aliceTodos.items.some((t) => t.title === "Org2 Todo")).toBe(
          false,
        );
      },
    );

    scenario(
      "Alice can paginate through todos",
      async ({ alice, acmeCorp }) => {
        for (let i = 0; i < 3; i++) {
          await alice.at(acmeCorp).createTodo({ title: `Paginated Todo ${i}` });
        }

        const page1 = await alice.at(acmeCorp).listTodos({ limit: 2 });
        expect(page1.items).toHaveLength(2);
        expect(page1.nextCursor).toBeDefined();

        const page2 = await alice.at(acmeCorp).listTodos({
          limit: 2,
          cursor: page1.nextCursor,
        });
        expect(page2.items.length).toBeGreaterThanOrEqual(1);
      },
    );
  });

  // ===========================================================================
  // Update Operations
  // ===========================================================================

  describe("update", () => {
    scenario("Alice updates her todo", async ({ alice, acmeCorp }) => {
      const todo = await alice.at(acmeCorp).createTodo({
        title: "Original",
        description: "Original desc",
      });

      const result = await alice.at(acmeCorp).updateTodo({
        id: todo.id,
        title: "Updated",
        description: "Updated desc",
        completed: true,
      });

      expect(result.title).toBe("Updated");
      expect(result.description).toBe("Updated desc");
      expect(result.completed).toBe(true);
    });

    scenario(
      "Alice partially updates her todo",
      async ({ alice, acmeCorp }) => {
        const todo = await alice.at(acmeCorp).createTodo({
          title: "Original Title",
          description: "Original desc",
        });

        const result = await alice.at(acmeCorp).updateTodo({
          id: todo.id,
          title: "New Title",
        });

        expect(result.title).toBe("New Title");
        expect(result.description).toBe("Original desc");
      },
    );

    scenario(
      "Alice can clear description with null",
      async ({ alice, acmeCorp }) => {
        const todo = await alice.at(acmeCorp).createTodo({
          title: "With Desc",
          description: "Some description",
        });

        const result = await alice.at(acmeCorp).updateTodo({
          id: todo.id,
          description: null,
        });

        expect(result.description).toBeNull();
      },
    );

    scenario(
      "Bob cannot update Alice's todo from another org",
      async ({ alice, bob, acmeCorp, globex }) => {
        const aliceTodo = await alice
          .at(acmeCorp)
          .createTodo({ title: "Org1 Todo" });

        await expect(
          bob.at(globex).updateTodo({ id: aliceTodo.id, title: "Hacked" }),
        ).rejects.toThrow("do not have access");
      },
    );

    scenario(
      "Updating a non-existent todo returns 404",
      async ({ alice, acmeCorp }) => {
        await expect(
          alice.at(acmeCorp).updateTodo({
            id: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
            title: "Updated",
          }),
        ).rejects.toThrow("not found");
      },
    );

    scenario(
      "Sysadmin can update any organization's todo",
      async ({ alice, sysadmin, acmeCorp, globex }) => {
        const todo = await alice.at(acmeCorp).createTodo({ title: "Original" });

        const result = await sysadmin.at(globex).updateTodo({
          id: todo.id,
          title: "Admin Updated",
        });

        expect(result.title).toBe("Admin Updated");
      },
    );
  });

  // ===========================================================================
  // Delete Operations
  // ===========================================================================

  describe("delete", () => {
    scenario("Admin can delete a todo", async ({ alice, acmeCorp }) => {
      const todo = await alice
        .administers(acmeCorp)
        .createTodo({ title: "To Delete" });

      const result = await alice.administers(acmeCorp).deleteTodo({
        id: todo.id,
      });

      expect(result.success).toBe(true);
    });

    scenario("Owner can delete a todo", async ({ alice, acmeCorp }) => {
      const todo = await alice.owns(acmeCorp).createTodo({
        title: "Owner Delete",
      });

      const result = await alice.owns(acmeCorp).deleteTodo({ id: todo.id });

      expect(result.success).toBe(true);
    });

    scenario(
      "Member cannot delete a todo",
      async ({ alice, bob, acmeCorp }) => {
        const todo = await alice.owns(acmeCorp).createTodo({
          title: "Member Cannot Delete",
        });

        await expect(
          bob.at(acmeCorp).deleteTodo({ id: todo.id }),
        ).rejects.toThrow("Only organization admins");
      },
    );

    scenario(
      "Sysadmin can delete any todo",
      async ({ alice, sysadmin, acmeCorp }) => {
        const todo = await alice.at(acmeCorp).createTodo({
          title: "Admin Delete Any",
        });

        const result = await sysadmin.at(acmeCorp).deleteTodo({ id: todo.id });

        expect(result.success).toBe(true);
      },
    );

    scenario(
      "Deleting a non-existent todo returns 404",
      async ({ alice, acmeCorp }) => {
        await expect(
          alice
            .administers(acmeCorp)
            .deleteTodo({ id: "clxxxxxxxxxxxxxxxxxxxxxxxxx" }),
        ).rejects.toThrow("not found");
      },
    );

    scenario(
      "Bob cannot delete Alice's todo from another org even as admin",
      async ({ alice, bob, acmeCorp, globex }) => {
        const aliceTodo = await alice
          .at(acmeCorp)
          .createTodo({ title: "Org1 Todo" });

        await expect(
          bob.administers(globex).deleteTodo({ id: aliceTodo.id }),
        ).rejects.toThrow("do not have access");
      },
    );
  });

  // ===========================================================================
  // Toggle Completion Operations
  // ===========================================================================

  describe("toggleComplete", () => {
    scenario(
      "Alice toggles completion from false to true",
      async ({ alice, acmeCorp }) => {
        const todo = await alice.at(acmeCorp).createTodo({
          title: "Toggle Test",
        });
        expect(todo.completed).toBe(false);

        const result = await alice.at(acmeCorp).toggleTodo({ id: todo.id });

        expect(result.completed).toBe(true);
      },
    );

    scenario(
      "Alice toggles completion from true to false",
      async ({ alice, acmeCorp }) => {
        const todo = await alice.at(acmeCorp).createTodo({
          title: "Toggle Test",
        });
        await alice.at(acmeCorp).toggleTodo({ id: todo.id });

        const result = await alice.at(acmeCorp).toggleTodo({ id: todo.id });

        expect(result.completed).toBe(false);
      },
    );

    scenario(
      "Toggling a non-existent todo returns 404",
      async ({ alice, acmeCorp }) => {
        await expect(
          alice.at(acmeCorp).toggleTodo({ id: "clxxxxxxxxxxxxxxxxxxxxxxxxx" }),
        ).rejects.toThrow("not found");
      },
    );

    scenario(
      "Bob cannot toggle Alice's todo from another org",
      async ({ alice, bob, acmeCorp, globex }) => {
        const aliceTodo = await alice
          .at(acmeCorp)
          .createTodo({ title: "Org1 Todo" });

        await expect(
          bob.at(globex).toggleTodo({ id: aliceTodo.id }),
        ).rejects.toThrow("do not have access");
      },
    );

    scenario(
      "Sysadmin can toggle any organization's todo",
      async ({ alice, sysadmin, acmeCorp, globex }) => {
        const todo = await alice.at(acmeCorp).createTodo({
          title: "Admin Toggle",
        });

        const result = await sysadmin.at(globex).toggleTodo({ id: todo.id });

        expect(result.completed).toBe(true);
      },
    );
  });

  // ===========================================================================
  // Stats Operations
  // ===========================================================================

  describe("stats", () => {
    scenario("Alice gets correct statistics", async ({ alice, acmeCorp }) => {
      // Create 3 completed and 2 pending todos
      for (let i = 0; i < 3; i++) {
        const todo = await alice.at(acmeCorp).createTodo({
          title: `Completed ${i}`,
        });
        await alice.at(acmeCorp).toggleTodo({ id: todo.id });
      }
      for (let i = 0; i < 2; i++) {
        await alice.at(acmeCorp).createTodo({ title: `Pending ${i}` });
      }

      const result = await alice.at(acmeCorp).getTodoStats();

      expect(result.total).toBeGreaterThanOrEqual(5);
      expect(result.completed).toBeGreaterThanOrEqual(3);
      expect(result.pending).toBeGreaterThanOrEqual(2);
      expect(result.completionRate).toBeGreaterThanOrEqual(0);
      expect(result.completionRate).toBeLessThanOrEqual(100);
    });

    scenario(
      "Fresh organization has zero stats",
      async ({ charlie, initech }) => {
        const result = await charlie.at(initech).getTodoStats();

        expect(result.total).toBe(0);
        expect(result.completed).toBe(0);
        expect(result.pending).toBe(0);
        expect(result.total).toBe(result.completed + result.pending);
      },
    );
  });
});
