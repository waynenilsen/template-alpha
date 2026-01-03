import { expect, test } from "@playwright/test";
import {
  completeSignup,
  createTodo,
  deleteTodo,
  getTodoCount,
  getTodoIds,
  getTodoStats,
  getTodoTitle,
  isTodoCompleted,
  todoLocators,
  toggleTodo,
  waitForTodoListLoaded,
  waitForTodoStats,
} from "./helpers";
import { deleteAllMessages } from "./helpers/mailhog";

test.describe("Todo Operations", () => {
  test.beforeEach(async ({ page }) => {
    // Clear all emails before each test
    await deleteAllMessages();

    // Sign up a new user to get a fresh dashboard with an organization
    await page.goto("/sign-up");
    await completeSignup(page);

    // Wait for the todo list to be visible
    await waitForTodoListLoaded(page);
    await waitForTodoStats(page);
  });

  test("displays empty todo list after signup", async ({ page }) => {
    // New users should see the empty state
    await expect(page.getByTestId(todoLocators.listEmpty)).toBeVisible();
    await expect(page.getByTestId(todoLocators.listEmpty)).toHaveText(
      "No todos yet. Create one to get started!",
    );

    // Stats should show zeros
    const stats = await getTodoStats(page);
    expect(stats.total).toBe(0);
    expect(stats.completed).toBe(0);
    expect(stats.pending).toBe(0);
    expect(stats.progress).toBe(0);
  });

  test("shows add todo button", async ({ page }) => {
    await expect(page.getByTestId(todoLocators.addButton)).toBeVisible();
    await expect(page.getByTestId(todoLocators.addButton)).toHaveText(
      "Add a todo",
    );
  });

  test("opens and closes create todo form", async ({ page }) => {
    // Click add button to open form
    await page.getByTestId(todoLocators.addButton).click();

    // Form should be visible
    await expect(page.getByTestId(todoLocators.createForm)).toBeVisible();
    await expect(page.getByTestId(todoLocators.createInput)).toBeVisible();
    await expect(page.getByTestId(todoLocators.createSubmit)).toBeVisible();
    await expect(page.getByTestId(todoLocators.createCancel)).toBeVisible();

    // Add button should be hidden
    await expect(page.getByTestId(todoLocators.addButton)).not.toBeVisible();

    // Click cancel to close form
    await page.getByTestId(todoLocators.createCancel).click();

    // Form should be hidden, add button visible again
    await expect(page.getByTestId(todoLocators.createForm)).not.toBeVisible();
    await expect(page.getByTestId(todoLocators.addButton)).toBeVisible();
  });

  test("creates a new todo", async ({ page }) => {
    const todoTitle = "Buy groceries";

    // Create the todo
    await createTodo(page, todoTitle);

    // Wait for the list to update
    await expect(page.getByTestId(todoLocators.list)).toBeVisible();

    // Verify the todo appears in the list
    const todoIds = await getTodoIds(page);
    expect(todoIds).toHaveLength(1);

    // Verify the title
    const title = await getTodoTitle(page, todoIds[0]);
    expect(title).toBe(todoTitle);

    // Verify it's not completed by default
    const completed = await isTodoCompleted(page, todoIds[0]);
    expect(completed).toBe(false);

    // Stats should update
    const stats = await getTodoStats(page);
    expect(stats.total).toBe(1);
    expect(stats.pending).toBe(1);
    expect(stats.completed).toBe(0);
  });

  test("creates multiple todos", async ({ page }) => {
    const titles = ["First todo", "Second todo", "Third todo"];

    // Create all todos
    for (const title of titles) {
      await createTodo(page, title);
    }

    // Wait for list to be visible
    await expect(page.getByTestId(todoLocators.list)).toBeVisible();

    // Verify count
    const count = await getTodoCount(page);
    expect(count).toBe(3);

    // Stats should show 3 pending
    const stats = await getTodoStats(page);
    expect(stats.total).toBe(3);
    expect(stats.pending).toBe(3);
    expect(stats.completed).toBe(0);
    expect(stats.progress).toBe(0);
  });

  test("toggles todo completion", async ({ page }) => {
    // Create a todo
    await createTodo(page, "Task to complete");

    // Get the todo ID
    const todoIds = await getTodoIds(page);
    expect(todoIds).toHaveLength(1);
    const todoId = todoIds[0];

    // Verify it starts as not completed
    expect(await isTodoCompleted(page, todoId)).toBe(false);

    // Toggle completion
    await toggleTodo(page, todoId);

    // Wait for the update
    await page.waitForTimeout(500);

    // Verify it's now completed
    expect(await isTodoCompleted(page, todoId)).toBe(true);

    // Stats should update
    const stats = await getTodoStats(page);
    expect(stats.completed).toBe(1);
    expect(stats.pending).toBe(0);
    expect(stats.progress).toBe(100);

    // Toggle back
    await toggleTodo(page, todoId);
    await page.waitForTimeout(500);

    // Should be uncompleted again
    expect(await isTodoCompleted(page, todoId)).toBe(false);

    // Stats should update again
    const statsAfter = await getTodoStats(page);
    expect(statsAfter.completed).toBe(0);
    expect(statsAfter.pending).toBe(1);
  });

  test("deletes a todo", async ({ page }) => {
    // Create a todo
    await createTodo(page, "Todo to delete");

    // Get the todo ID
    const todoIds = await getTodoIds(page);
    expect(todoIds).toHaveLength(1);
    const todoId = todoIds[0];

    // Delete the todo (user is owner of their org, so they can delete)
    await deleteTodo(page, todoId);

    // Wait for the delete to complete
    await expect(page.getByTestId(todoLocators.listEmpty)).toBeVisible({
      timeout: 5000,
    });

    // Verify it's gone
    const remainingTodoIds = await getTodoIds(page);
    expect(remainingTodoIds).toHaveLength(0);

    // Stats should update
    const stats = await getTodoStats(page);
    expect(stats.total).toBe(0);
  });

  test("updates stats correctly with mixed completion states", async ({
    page,
  }) => {
    // Create 4 todos
    await createTodo(page, "Todo 1");
    await createTodo(page, "Todo 2");
    await createTodo(page, "Todo 3");
    await createTodo(page, "Todo 4");

    // Get all todo IDs
    const todoIds = await getTodoIds(page);
    expect(todoIds).toHaveLength(4);

    // Complete 2 of them
    await toggleTodo(page, todoIds[0]);
    await page.waitForTimeout(300);
    await toggleTodo(page, todoIds[1]);
    await page.waitForTimeout(300);

    // Verify stats
    const stats = await getTodoStats(page);
    expect(stats.total).toBe(4);
    expect(stats.completed).toBe(2);
    expect(stats.pending).toBe(2);
    expect(stats.progress).toBe(50);
  });

  test("persists todos after page reload", async ({ page }) => {
    // Create a todo
    const todoTitle = "Persistent todo";
    await createTodo(page, todoTitle);

    // Wait for it to appear
    const todoIds = await getTodoIds(page);
    expect(todoIds).toHaveLength(1);

    // Toggle it to completed
    await toggleTodo(page, todoIds[0]);
    await page.waitForTimeout(500);

    // Reload the page
    await page.reload();
    await waitForTodoListLoaded(page);
    await waitForTodoStats(page);

    // Verify the todo is still there and completed
    const reloadedTodoIds = await getTodoIds(page);
    expect(reloadedTodoIds).toHaveLength(1);

    const title = await getTodoTitle(page, reloadedTodoIds[0]);
    expect(title).toBe(todoTitle);

    const completed = await isTodoCompleted(page, reloadedTodoIds[0]);
    expect(completed).toBe(true);

    // Stats should be correct
    const stats = await getTodoStats(page);
    expect(stats.total).toBe(1);
    expect(stats.completed).toBe(1);
  });

  test("shows todo title with line-through when completed", async ({
    page,
  }) => {
    // Create a todo
    await createTodo(page, "Strikethrough todo");

    // Get the todo ID
    const todoIds = await getTodoIds(page);
    const todoId = todoIds[0];

    // Verify the title doesn't have line-through initially
    const titleElement = page.getByTestId(`todo-title-${todoId}`);
    await expect(titleElement).not.toHaveClass(/line-through/);

    // Toggle completion
    await toggleTodo(page, todoId);
    await page.waitForTimeout(500);

    // Verify the title now has line-through class
    await expect(titleElement).toHaveClass(/line-through/);
  });
});
