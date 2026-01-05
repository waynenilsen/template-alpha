/**
 * Cross-Organization Security Tests
 *
 * These tests verify that users cannot access or modify data belonging to other organizations.
 * This is a critical security feature for multi-tenant applications.
 */

import { expect, test } from "@playwright/test";
import {
  completeSignup,
  createTodo,
  getTodoIds,
  getTodoTitle,
  waitForTodoListLoaded,
  waitForTodoStats,
} from "./helpers";
import { deleteAllMessages } from "./helpers/mailhog";

test.describe("Cross-Organization Security", () => {
  test.beforeAll(async () => {
    // Clear all emails before tests
    await deleteAllMessages();
  });

  test("user cannot access another organization's todos via tRPC API", async ({
    browser,
  }) => {
    // Create two separate browser contexts (simulating two different users)
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    try {
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();

      // User 1: Sign up and create a todo
      await page1.goto("/sign-up");
      await completeSignup(page1);
      await waitForTodoListLoaded(page1);
      await waitForTodoStats(page1);

      const todoTitle = "Secret Todo - User 1 Only";
      await createTodo(page1, todoTitle);

      // Get the todo ID from User 1's list
      const user1TodoIds = await getTodoIds(page1);
      expect(user1TodoIds).toHaveLength(1);
      const targetTodoId = user1TodoIds[0];

      // Verify User 1 can see their todo
      const titleFromUser1 = await getTodoTitle(page1, targetTodoId);
      expect(titleFromUser1).toBe(todoTitle);

      // User 2: Sign up in a different organization
      await page2.goto("/sign-up");
      await completeSignup(page2);
      await waitForTodoListLoaded(page2);
      await waitForTodoStats(page2);

      // User 2's todo list should be empty (they're in a different org)
      const user2TodoIds = await getTodoIds(page2);
      expect(user2TodoIds).toHaveLength(0);

      // User 2 attempts to access User 1's todo via tRPC API directly
      // This simulates a malicious user trying to access another org's data
      const response = await page2.evaluate(async (todoId: string) => {
        try {
          // Make a direct tRPC call to get the todo
          const res = await fetch("/api/trpc/todo.get", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              "0": {
                json: { id: todoId },
              },
            }),
          });

          const data = await res.json();
          return {
            status: res.status,
            ok: res.ok,
            error: data?.[0]?.error?.json?.code ?? null,
            message: data?.[0]?.error?.json?.message ?? null,
          };
        } catch (error) {
          return {
            status: 500,
            ok: false,
            error: "FETCH_ERROR",
            message: String(error),
          };
        }
      }, targetTodoId);

      // The request should be forbidden
      expect(response.ok).toBe(false);
      expect(response.error).toBe("FORBIDDEN");
      expect(response.message).toBe("You do not have access to this todo");
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test("user cannot update another organization's todos via tRPC API", async ({
    browser,
  }) => {
    // Create two separate browser contexts
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    try {
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();

      // User 1: Sign up and create a todo
      await page1.goto("/sign-up");
      await completeSignup(page1);
      await waitForTodoListLoaded(page1);
      await waitForTodoStats(page1);

      await createTodo(page1, "Original Title - Do Not Modify");
      const user1TodoIds = await getTodoIds(page1);
      const targetTodoId = user1TodoIds[0];

      // User 2: Sign up in a different organization
      await page2.goto("/sign-up");
      await completeSignup(page2);
      await waitForTodoListLoaded(page2);

      // User 2 attempts to update User 1's todo
      const response = await page2.evaluate(async (todoId: string) => {
        try {
          const res = await fetch("/api/trpc/todo.update", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              "0": {
                json: {
                  id: todoId,
                  title: "HACKED - Modified by User 2",
                },
              },
            }),
          });

          const data = await res.json();
          return {
            status: res.status,
            ok: res.ok,
            error: data?.[0]?.error?.json?.code ?? null,
            message: data?.[0]?.error?.json?.message ?? null,
          };
        } catch (error) {
          return {
            status: 500,
            ok: false,
            error: "FETCH_ERROR",
            message: String(error),
          };
        }
      }, targetTodoId);

      // The request should be forbidden
      expect(response.ok).toBe(false);
      expect(response.error).toBe("FORBIDDEN");

      // Verify User 1's todo was NOT modified
      await page1.reload();
      await waitForTodoListLoaded(page1);
      const unchangedTitle = await getTodoTitle(page1, targetTodoId);
      expect(unchangedTitle).toBe("Original Title - Do Not Modify");
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test("user cannot delete another organization's todos via tRPC API", async ({
    browser,
  }) => {
    // Create two separate browser contexts
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    try {
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();

      // User 1: Sign up and create a todo (as owner, can delete their own)
      await page1.goto("/sign-up");
      await completeSignup(page1);
      await waitForTodoListLoaded(page1);
      await waitForTodoStats(page1);

      await createTodo(page1, "Protected Todo - Cannot Delete");
      const user1TodoIds = await getTodoIds(page1);
      const targetTodoId = user1TodoIds[0];

      // User 2: Sign up in a different organization (as owner of their org)
      await page2.goto("/sign-up");
      await completeSignup(page2);
      await waitForTodoListLoaded(page2);

      // User 2 attempts to delete User 1's todo
      const response = await page2.evaluate(async (todoId: string) => {
        try {
          const res = await fetch("/api/trpc/todo.delete", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              "0": {
                json: { id: todoId },
              },
            }),
          });

          const data = await res.json();
          return {
            status: res.status,
            ok: res.ok,
            error: data?.[0]?.error?.json?.code ?? null,
            message: data?.[0]?.error?.json?.message ?? null,
          };
        } catch (error) {
          return {
            status: 500,
            ok: false,
            error: "FETCH_ERROR",
            message: String(error),
          };
        }
      }, targetTodoId);

      // The request should be forbidden
      expect(response.ok).toBe(false);
      expect(response.error).toBe("FORBIDDEN");

      // Verify User 1's todo still exists
      await page1.reload();
      await waitForTodoListLoaded(page1);
      const remainingTodoIds = await getTodoIds(page1);
      expect(remainingTodoIds).toContain(targetTodoId);
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test("user cannot toggle another organization's todos via tRPC API", async ({
    browser,
  }) => {
    // Create two separate browser contexts
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    try {
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();

      // User 1: Sign up and create an incomplete todo
      await page1.goto("/sign-up");
      await completeSignup(page1);
      await waitForTodoListLoaded(page1);
      await waitForTodoStats(page1);

      await createTodo(page1, "Incomplete Todo - Stay Incomplete");
      const user1TodoIds = await getTodoIds(page1);
      const targetTodoId = user1TodoIds[0];

      // User 2: Sign up in a different organization
      await page2.goto("/sign-up");
      await completeSignup(page2);
      await waitForTodoListLoaded(page2);

      // User 2 attempts to toggle User 1's todo completion
      const response = await page2.evaluate(async (todoId: string) => {
        try {
          const res = await fetch("/api/trpc/todo.toggleComplete", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              "0": {
                json: { id: todoId },
              },
            }),
          });

          const data = await res.json();
          return {
            status: res.status,
            ok: res.ok,
            error: data?.[0]?.error?.json?.code ?? null,
            message: data?.[0]?.error?.json?.message ?? null,
          };
        } catch (error) {
          return {
            status: 500,
            ok: false,
            error: "FETCH_ERROR",
            message: String(error),
          };
        }
      }, targetTodoId);

      // The request should be forbidden
      expect(response.ok).toBe(false);
      expect(response.error).toBe("FORBIDDEN");

      // Verify User 1's todo is still incomplete
      await page1.reload();
      await waitForTodoListLoaded(page1);
      const todoItem = page1.getByTestId(`todo-item-${targetTodoId}`);
      const isCompleted = await todoItem.getAttribute("data-todo-completed");
      expect(isCompleted).toBe("false");
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test("user cannot list another organization's todos", async ({ browser }) => {
    // Create two separate browser contexts
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    try {
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();

      // User 1: Sign up and create multiple todos
      await page1.goto("/sign-up");
      await completeSignup(page1);
      await waitForTodoListLoaded(page1);
      await waitForTodoStats(page1);

      await createTodo(page1, "User 1 Todo A");
      await createTodo(page1, "User 1 Todo B");
      await createTodo(page1, "User 1 Todo C");

      const user1TodoIds = await getTodoIds(page1);
      expect(user1TodoIds).toHaveLength(3);

      // User 2: Sign up in a different organization
      await page2.goto("/sign-up");
      await completeSignup(page2);
      await waitForTodoListLoaded(page2);

      // User 2's todo list should be empty - they should NOT see User 1's todos
      const user2TodoIds = await getTodoIds(page2);
      expect(user2TodoIds).toHaveLength(0);

      // Verify via API that User 2's list query doesn't return User 1's todos
      const response = await page2.evaluate(async () => {
        try {
          const res = await fetch("/api/trpc/todo.list", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              "0": {
                json: {},
              },
            }),
          });

          const data = await res.json();
          return {
            ok: res.ok,
            items: data?.[0]?.result?.data?.json?.items ?? [],
          };
        } catch (_error) {
          return { ok: false, items: [] };
        }
      });

      // User 2 should get an empty list or their own todos (none created yet)
      expect(response.ok).toBe(true);
      expect(response.items).toHaveLength(0);

      // None of User 1's todo IDs should appear in User 2's list
      const user2ItemIds = response.items.map(
        (item: { id: string }) => item.id,
      );
      for (const todoId of user1TodoIds) {
        expect(user2ItemIds).not.toContain(todoId);
      }
    } finally {
      await context1.close();
      await context2.close();
    }
  });
});
