import { describe, expect, test } from "bun:test";
import type { UseTodoListReturn } from "./use-todo-list";

describe("useTodoList", () => {
  test("exports UseTodoListReturn type with all required properties", () => {
    // This test verifies the type structure at compile time
    const mockReturn: UseTodoListReturn = {
      // Data
      todos: [],
      stats: null,
      subscription: null,

      // Loading states
      isLoadingTodos: false,
      isLoadingStats: false,
      isLoadingSubscription: false,

      // Mutation states
      isCreatingTodo: false,
      isTogglingTodo: false,
      isDeletingTodo: false,

      // Form state
      newTodoTitle: "",
      isCreating: false,
      showLimitDialog: false,

      // Handlers
      onNewTodoTitleChange: () => {},
      onCreateTodo: () => {},
      onAddButtonClick: () => {},
      onCancelCreate: () => {},
      onToggleTodo: () => {},
      onDeleteTodo: () => {},
      onCloseLimitDialog: () => {},

      // Permissions
      canDelete: false,
    };

    // Verify all expected properties exist
    expect(mockReturn).toHaveProperty("todos");
    expect(mockReturn).toHaveProperty("stats");
    expect(mockReturn).toHaveProperty("subscription");
    expect(mockReturn).toHaveProperty("isLoadingTodos");
    expect(mockReturn).toHaveProperty("isCreatingTodo");
    expect(mockReturn).toHaveProperty("newTodoTitle");
    expect(mockReturn).toHaveProperty("isCreating");
    expect(mockReturn).toHaveProperty("showLimitDialog");
    expect(mockReturn).toHaveProperty("onNewTodoTitleChange");
    expect(mockReturn).toHaveProperty("onCreateTodo");
    expect(mockReturn).toHaveProperty("onAddButtonClick");
    expect(mockReturn).toHaveProperty("canDelete");
  });

  test("type allows todos array with proper shape", () => {
    const todos: UseTodoListReturn["todos"] = [
      {
        id: "1",
        title: "Test",
        description: null,
        completed: false,
        createdAt: new Date(),
        organizationId: "org1",
        createdById: "user1",
        createdBy: {
          id: "user1",
          email: "test@example.com",
        },
      },
    ];

    expect(todos.length).toBe(1);
    expect(todos[0].title).toBe("Test");
  });

  test("type allows stats object with proper shape", () => {
    const stats: UseTodoListReturn["stats"] = {
      total: 5,
      completed: 2,
      pending: 3,
      completionRate: 40,
    };

    expect(stats?.total).toBe(5);
    expect(stats?.completionRate).toBe(40);
  });

  test("type allows subscription object with proper shape", () => {
    const subscription: UseTodoListReturn["subscription"] = {
      id: "sub1",
      status: "active",
      interval: "monthly",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(),
      cancelAtPeriodEnd: false,
      plan: {
        slug: "free",
        name: "Free",
        limits: {
          maxTodos: 10,
          maxMembers: 5,
        },
      },
      usage: {
        todos: {
          current: 3,
          limit: 10,
        },
        members: {
          current: 1,
          limit: 5,
        },
      },
      hasStripeSubscription: false,
    };

    expect(subscription?.plan.name).toBe("Free");
    expect(subscription?.usage.todos.limit).toBe(10);
  });
});
