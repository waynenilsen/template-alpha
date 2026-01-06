# Frontend Architecture Guidelines

This document describes the frontend component architecture patterns used in this codebase.

## Component Architecture: Hook + View + Wrapper Pattern

All stateful frontend components follow a three-part separation pattern to enable Storybook testing and maintain clean separation of concerns.

### Pattern Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Wrapper Component (components/my-component.tsx)            │
│  - Imports hook and view                                    │
│  - Connects them together                                   │
│  - Minimal code (~10-20 lines)                              │
├─────────────────────────────────────────────────────────────┤
│                          │                                  │
│                          ▼                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Hook (hooks/use-my-component.ts)                     │  │
│  │  - tRPC queries and mutations                         │  │
│  │  - React Query integration                            │  │
│  │  - State management (useState, useReducer)            │  │
│  │  - Side effects (router, transitions)                 │  │
│  │  - Event handlers                                     │  │
│  └───────────────────────────────────────────────────────┘  │
│                          │                                  │
│                          ▼                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  View (components/my-component-view.tsx)              │  │
│  │  - Pure presentational component                      │  │
│  │  - No hooks (except local UI state if needed)         │  │
│  │  - Receives all data and callbacks as props           │  │
│  │  - Fully testable in Storybook                        │  │
│  └───────────────────────────────────────────────────────┘  │
│                          │                                  │
│                          ▼                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Stories (components/my-component-view.stories.tsx)   │  │
│  │  - Comprehensive Storybook stories                    │  │
│  │  - All component states documented                    │  │
│  │  - No mocking required                                │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### File Structure

```
components/
├── my-component.tsx              # Wrapper (connects hook + view)
├── my-component-view.tsx         # Stateless view component
└── my-component-view.stories.tsx # Storybook stories

hooks/
└── use-my-component.ts           # Business logic hook
```

### Example Implementation

#### 1. Hook (`hooks/use-todo-list.ts`)

```typescript
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTRPC } from "@/trpc/client";

export interface UseTodoListReturn {
  todos: TodoItem[];
  isLoading: boolean;
  error: Error | null;
  // ... all state and handlers
  handleCreateTodo: (title: string) => void;
  handleToggleTodo: (id: string) => void;
}

export function useTodoList(userRole: string): UseTodoListReturn {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [newTodoTitle, setNewTodoTitle] = useState("");

  // Queries
  const todosQuery = useQuery(trpc.todo.list.queryOptions({ limit: 50 }));

  // Mutations
  const createMutation = useMutation(
    trpc.todo.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.todo.list.queryKey() });
      },
    })
  );

  // Handlers
  const handleCreateTodo = (title: string) => {
    createMutation.mutate({ title });
  };

  return {
    todos: todosQuery.data?.items ?? [],
    isLoading: todosQuery.isLoading,
    error: todosQuery.error as Error | null,
    handleCreateTodo,
    // ... rest of state and handlers
  };
}
```

#### 2. View (`components/todo-list-view.tsx`)

```typescript
// NO "use client" needed - this is a pure component

export interface TodoItem {
  id: string;
  title: string;
  completed: boolean;
}

export interface TodoListViewProps {
  todos: TodoItem[];
  isLoading: boolean;
  error: Error | null;
  onCreateTodo: (title: string) => void;
  onToggleTodo: (id: string) => void;
}

export function TodoListView({
  todos,
  isLoading,
  error,
  onCreateTodo,
  onToggleTodo,
}: TodoListViewProps) {
  // Pure presentation - no hooks except local UI state
  const [inputValue, setInputValue] = useState("");

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div data-testid="todo-list">
      {todos.map((todo) => (
        <div key={todo.id} data-testid={`todo-item-${todo.id}`}>
          <input
            type="checkbox"
            checked={todo.completed}
            onChange={() => onToggleTodo(todo.id)}
          />
          {todo.title}
        </div>
      ))}
    </div>
  );
}
```

#### 3. Wrapper (`components/todo-list.tsx`)

```typescript
"use client";

import { useTodoList } from "@/hooks/use-todo-list";
import { TodoListView } from "@/components/todo-list-view";

export interface TodoListProps {
  userRole: string;
}

export function TodoList({ userRole }: TodoListProps) {
  const {
    todos,
    isLoading,
    error,
    handleCreateTodo,
    handleToggleTodo,
  } = useTodoList(userRole);

  return (
    <TodoListView
      todos={todos}
      isLoading={isLoading}
      error={error}
      onCreateTodo={handleCreateTodo}
      onToggleTodo={handleToggleTodo}
    />
  );
}
```

#### 4. Stories (`components/todo-list-view.stories.tsx`)

```typescript
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { TodoListView } from "./todo-list-view";

const meta = {
  title: "Components/TodoListView",
  component: TodoListView,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    onCreateTodo: fn(),
    onToggleTodo: fn(),
  },
} satisfies Meta<typeof TodoListView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    todos: [
      { id: "1", title: "First todo", completed: false },
      { id: "2", title: "Second todo", completed: true },
    ],
    isLoading: false,
    error: null,
  },
};

export const Loading: Story = {
  args: {
    todos: [],
    isLoading: true,
    error: null,
  },
};

export const Empty: Story = {
  args: {
    todos: [],
    isLoading: false,
    error: null,
  },
};

export const WithError: Story = {
  args: {
    todos: [],
    isLoading: false,
    error: new Error("Failed to load todos"),
  },
};
```

## When to Use This Pattern

### Use for components that:
- Fetch data via tRPC/React Query
- Have mutations or server actions
- Use Next.js router or navigation
- Manage complex state
- Need comprehensive Storybook documentation

### Don't use for:
- Simple presentational components (buttons, cards, etc.)
- Components that only receive props and render
- shadcn/ui primitives in `components/ui/`

## Benefits

1. **Testability** - View components are pure functions that can be tested without mocking tRPC, React Query, or Next.js router

2. **Storybook Coverage** - All component states can be documented and visually tested

3. **Separation of Concerns** - Business logic is cleanly separated from presentation

4. **Reusability** - Views can be used in different contexts with different data sources

5. **Maintainability** - Changes to logic don't require UI changes and vice versa

6. **Type Safety** - All props are explicitly typed with exported interfaces

## Coverage Configuration

Hooks and wrapper components are excluded from unit test coverage because they require browser environment. They are tested via:
- Storybook interaction tests
- E2E tests
- Type definitions ensure correctness

See `bunfig.toml` for the coverage exclusion patterns.

## Components Following This Pattern

| Component | Hook | View | Stories |
|-----------|------|------|---------|
| TodoList | `use-todo-list.ts` | `todo-list-view.tsx` | 16 stories |
| OrgPicker | `use-org-picker.ts` | `org-picker-view.tsx` | 11 stories |
| CreateOrganizationDialog | `use-create-organization.ts` | `create-organization-dialog-view.tsx` | 8 stories |
| UserNav | `use-user-nav.ts` | `user-nav-view.tsx` | 6 stories |
| LiveStats | `use-live-stats.ts` | `live-stats-view.tsx` | 7 stories |
| UpgradeNudge | `use-upgrade-nudge.ts` | `upgrade-nudge-view.tsx` | 12 stories |
| UpgradeLimitDialog | `use-upgrade-limit-dialog.ts` | (inline content) | 6 stories |
| Dashboard | (no hook needed) | `dashboard-view.tsx` | 5 stories |
| AppShell | `use-app-shell.ts` | `app-shell-view.tsx` | 7 stories |

## Adding New Components

1. Create the hook in `hooks/use-my-component.ts`
2. Create the view in `components/my-component-view.tsx`
3. Create the wrapper in `components/my-component.tsx`
4. Create stories in `components/my-component-view.stories.tsx`
5. Add hook and wrapper to coverage exclusions in `bunfig.toml` if needed
