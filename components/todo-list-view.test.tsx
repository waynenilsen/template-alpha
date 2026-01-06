import { describe, expect, mock, test } from "bun:test";
import type {
  TodoItem,
  TodoListViewProps,
  TodoStats,
  TodoSubscription,
} from "./todo-list-view";

describe("TodoListView", () => {
  test("exports TodoItem type with required properties", () => {
    const todo: TodoItem = {
      id: "1",
      title: "Test Todo",
      description: null,
      completed: false,
    };

    expect(todo.id).toBe("1");
    expect(todo.title).toBe("Test Todo");
    expect(todo.description).toBeNull();
    expect(todo.completed).toBe(false);
  });

  test("exports TodoStats type with required properties", () => {
    const stats: TodoStats = {
      total: 5,
      completed: 2,
      pending: 3,
      completionRate: 40,
    };

    expect(stats.total).toBe(5);
    expect(stats.completed).toBe(2);
    expect(stats.pending).toBe(3);
    expect(stats.completionRate).toBe(40);
  });

  test("exports TodoSubscription type with required properties", () => {
    const subscription: TodoSubscription = {
      usage: {
        todos: {
          current: 5,
          limit: 10,
        },
      },
      plan: {
        name: "Free",
      },
    };

    expect(subscription.usage.todos.current).toBe(5);
    expect(subscription.usage.todos.limit).toBe(10);
    expect(subscription.plan.name).toBe("Free");
  });

  test("exports TodoListViewProps type with all required properties", () => {
    const props: TodoListViewProps = {
      todos: [],
      stats: null,
      subscription: null,
      isLoadingTodos: false,
      isCreatingTodo: false,
      isTogglingTodo: false,
      isDeletingTodo: false,
      newTodoTitle: "",
      isCreating: false,
      showLimitDialog: false,
      onNewTodoTitleChange: mock(() => {}),
      onCreateTodo: mock(() => {}),
      onAddButtonClick: mock(() => {}),
      onCancelCreate: mock(() => {}),
      onToggleTodo: mock(() => {}),
      onDeleteTodo: mock(() => {}),
      onCloseLimitDialog: mock(() => {}),
      canDelete: false,
    };

    expect(props).toHaveProperty("todos");
    expect(props).toHaveProperty("stats");
    expect(props).toHaveProperty("subscription");
    expect(props).toHaveProperty("isLoadingTodos");
    expect(props).toHaveProperty("isCreatingTodo");
    expect(props).toHaveProperty("newTodoTitle");
    expect(props).toHaveProperty("isCreating");
    expect(props).toHaveProperty("showLimitDialog");
    expect(props).toHaveProperty("onNewTodoTitleChange");
    expect(props).toHaveProperty("onCreateTodo");
    expect(props).toHaveProperty("canDelete");
  });

  test("TodoItem allows description to be null or string", () => {
    const todoWithDescription: TodoItem = {
      id: "1",
      title: "Test",
      description: "Description",
      completed: false,
    };

    const todoWithoutDescription: TodoItem = {
      id: "2",
      title: "Test 2",
      description: null,
      completed: true,
    };

    expect(todoWithDescription.description).toBe("Description");
    expect(todoWithoutDescription.description).toBeNull();
  });

  test("TodoStats allows null", () => {
    const stats: TodoStats | null = null;
    expect(stats).toBeNull();

    const actualStats: TodoStats | null = {
      total: 1,
      completed: 1,
      pending: 0,
      completionRate: 100,
    };
    expect(actualStats?.total).toBe(1);
  });

  test("TodoSubscription allows null", () => {
    const subscription: TodoSubscription | null = null;
    expect(subscription).toBeNull();

    const actualSubscription: TodoSubscription | null = {
      usage: {
        todos: {
          current: 0,
          limit: 10,
        },
      },
      plan: {
        name: "Free",
      },
    };
    expect(actualSubscription?.plan.name).toBe("Free");
  });

  test("props includes all handler functions", () => {
    const handlers = {
      onNewTodoTitleChange: mock(() => {}),
      onCreateTodo: mock(() => {}),
      onAddButtonClick: mock(() => {}),
      onCancelCreate: mock(() => {}),
      onToggleTodo: mock(() => {}),
      onDeleteTodo: mock(() => {}),
      onCloseLimitDialog: mock(() => {}),
    };

    const props: TodoListViewProps = {
      todos: [],
      stats: null,
      subscription: null,
      isLoadingTodos: false,
      isCreatingTodo: false,
      isTogglingTodo: false,
      isDeletingTodo: false,
      newTodoTitle: "",
      isCreating: false,
      showLimitDialog: false,
      ...handlers,
      canDelete: false,
    };

    expect(typeof props.onNewTodoTitleChange).toBe("function");
    expect(typeof props.onCreateTodo).toBe("function");
    expect(typeof props.onAddButtonClick).toBe("function");
    expect(typeof props.onCancelCreate).toBe("function");
    expect(typeof props.onToggleTodo).toBe("function");
    expect(typeof props.onDeleteTodo).toBe("function");
    expect(typeof props.onCloseLimitDialog).toBe("function");
  });
});
