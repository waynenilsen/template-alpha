/**
 * Todo helpers for e2e tests
 * Provides utilities for todo list interactions
 */

import type { Page } from "@playwright/test";

/**
 * Todo list locators
 */
export const todoLocators = {
  // Stats
  stats: "todo-stats",
  statsTotal: "todo-stats-total",
  statsCompleted: "todo-stats-completed",
  statsPending: "todo-stats-pending",
  statsProgress: "todo-stats-progress",

  // Create form
  createCard: "todo-create-card",
  addButton: "todo-add-button",
  createForm: "todo-create-form",
  createInput: "todo-create-input",
  createSubmit: "todo-create-submit",
  createCancel: "todo-create-cancel",

  // List
  listCard: "todo-list-card",
  list: "todo-list",
  listEmpty: "todo-list-empty",
  listLoading: "todo-list-loading",

  // Dynamic item locators (use with getTodoItemLocator)
  itemPrefix: "todo-item-",
  checkboxPrefix: "todo-checkbox-",
  titlePrefix: "todo-title-",
  descriptionPrefix: "todo-description-",
  deletePrefix: "todo-delete-",
} as const;

/**
 * Get locator for a specific todo item by its ID
 */
export function getTodoItemLocator(todoId: string) {
  return `${todoLocators.itemPrefix}${todoId}`;
}

/**
 * Get locator for a todo's checkbox by its ID
 */
export function getTodoCheckboxLocator(todoId: string) {
  return `${todoLocators.checkboxPrefix}${todoId}`;
}

/**
 * Get locator for a todo's title by its ID
 */
export function getTodoTitleLocator(todoId: string) {
  return `${todoLocators.titlePrefix}${todoId}`;
}

/**
 * Get locator for a todo's delete button by its ID
 */
export function getTodoDeleteLocator(todoId: string) {
  return `${todoLocators.deletePrefix}${todoId}`;
}

/**
 * Open the create todo form
 */
export async function openCreateTodoForm(page: Page): Promise<void> {
  await page.getByTestId(todoLocators.addButton).click();
}

/**
 * Create a new todo with the given title
 * Returns after the todo is created and the form is closed
 */
export async function createTodo(page: Page, title: string): Promise<void> {
  // Open form if not already open
  const createForm = page.getByTestId(todoLocators.createForm);
  if (!(await createForm.isVisible())) {
    await openCreateTodoForm(page);
  }

  // Fill in the title and submit
  await page.getByTestId(todoLocators.createInput).fill(title);
  await page.getByTestId(todoLocators.createSubmit).click();

  // Wait for the form to close (indicates success)
  await page.getByTestId(todoLocators.addButton).waitFor({ state: "visible" });
}

/**
 * Cancel creating a todo
 */
export async function cancelCreateTodo(page: Page): Promise<void> {
  await page.getByTestId(todoLocators.createCancel).click();
}

/**
 * Get the count of todo items in the list
 */
export async function getTodoCount(page: Page): Promise<number> {
  const list = page.getByTestId(todoLocators.list);
  if (!(await list.isVisible())) {
    return 0;
  }
  const items = list.locator('[data-testid^="todo-item-"]');
  return await items.count();
}

/**
 * Get all todo items' IDs from the list
 */
export async function getTodoIds(page: Page): Promise<string[]> {
  const list = page.getByTestId(todoLocators.list);
  if (!(await list.isVisible())) {
    return [];
  }
  const items = list.locator('[data-testid^="todo-item-"]');
  const count = await items.count();
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const todoId = await items.nth(i).getAttribute("data-todo-id");
    if (todoId) {
      ids.push(todoId);
    }
  }
  return ids;
}

/**
 * Toggle the completion status of a todo by its ID
 */
export async function toggleTodo(page: Page, todoId: string): Promise<void> {
  const checkbox = page.getByTestId(getTodoCheckboxLocator(todoId));
  await checkbox.click();
}

/**
 * Delete a todo by its ID
 */
export async function deleteTodo(page: Page, todoId: string): Promise<void> {
  const deleteButton = page.getByTestId(getTodoDeleteLocator(todoId));
  await deleteButton.click();
}

/**
 * Check if a todo is completed
 */
export async function isTodoCompleted(
  page: Page,
  todoId: string,
): Promise<boolean> {
  const item = page.getByTestId(getTodoItemLocator(todoId));
  const completed = await item.getAttribute("data-todo-completed");
  return completed === "true";
}

/**
 * Get the title of a todo by its ID
 */
export async function getTodoTitle(
  page: Page,
  todoId: string,
): Promise<string> {
  const title = page.getByTestId(getTodoTitleLocator(todoId));
  return (await title.textContent()) ?? "";
}

/**
 * Get stats from the todo stats section
 */
export async function getTodoStats(page: Page): Promise<{
  total: number;
  completed: number;
  pending: number;
  progress: number;
}> {
  const total = await page.getByTestId(todoLocators.statsTotal).textContent();
  const completed = await page
    .getByTestId(todoLocators.statsCompleted)
    .textContent();
  const pending = await page
    .getByTestId(todoLocators.statsPending)
    .textContent();
  const progress = await page
    .getByTestId(todoLocators.statsProgress)
    .textContent();

  return {
    total: Number.parseInt(total ?? "0", 10),
    completed: Number.parseInt(completed ?? "0", 10),
    pending: Number.parseInt(pending ?? "0", 10),
    progress: Number.parseInt(progress?.replace("%", "") ?? "0", 10),
  };
}

/**
 * Wait for the todo list to finish loading
 */
export async function waitForTodoListLoaded(page: Page): Promise<void> {
  // Wait for either the list or the empty state to be visible
  await Promise.race([
    page.getByTestId(todoLocators.list).waitFor({ state: "visible" }),
    page.getByTestId(todoLocators.listEmpty).waitFor({ state: "visible" }),
  ]);
}

/**
 * Wait for todo stats to be visible
 */
export async function waitForTodoStats(page: Page): Promise<void> {
  await page.getByTestId(todoLocators.stats).waitFor({ state: "visible" });
}
