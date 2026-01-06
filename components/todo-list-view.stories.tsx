import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import type { TodoItem, TodoStats, TodoSubscription } from "./todo-list-view";
import { TodoListView } from "./todo-list-view";

const meta = {
  title: "Components/TodoListView",
  component: TodoListView,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    todos: { control: "object" },
    stats: { control: "object" },
    subscription: { control: "object" },
    isLoadingTodos: { control: "boolean" },
    isCreatingTodo: { control: "boolean" },
    isTogglingTodo: { control: "boolean" },
    isDeletingTodo: { control: "boolean" },
    newTodoTitle: { control: "text" },
    isCreating: { control: "boolean" },
    showLimitDialog: { control: "boolean" },
    canDelete: { control: "boolean" },
  },
} satisfies Meta<typeof TodoListView>;

export default meta;
type Story = StoryObj<typeof meta>;

// Mock data
const mockTodos: TodoItem[] = [
  {
    id: "1",
    title: "Complete project documentation",
    description: "Write comprehensive docs for the new feature",
    completed: false,
  },
  {
    id: "2",
    title: "Review pull requests",
    description: null,
    completed: true,
  },
  {
    id: "3",
    title: "Update dependencies",
    description: "Check for security updates and breaking changes",
    completed: false,
  },
  {
    id: "4",
    title: "Refactor authentication module",
    description: "Improve code structure and add tests",
    completed: false,
  },
  {
    id: "5",
    title: "Deploy to staging",
    description: null,
    completed: true,
  },
];

const mockStats: TodoStats = {
  total: 5,
  completed: 2,
  pending: 3,
  completionRate: 40,
};

const mockSubscription: TodoSubscription = {
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

const mockSubscriptionNearLimit: TodoSubscription = {
  usage: {
    todos: {
      current: 9,
      limit: 10,
    },
  },
  plan: {
    name: "Free",
  },
};

const mockSubscriptionAtLimit: TodoSubscription = {
  usage: {
    todos: {
      current: 10,
      limit: 10,
    },
  },
  plan: {
    name: "Free",
  },
};

const mockSubscriptionPro: TodoSubscription = {
  usage: {
    todos: {
      current: 25,
      limit: -1,
    },
  },
  plan: {
    name: "Pro",
  },
};

// Default handlers
const defaultHandlers = {
  onNewTodoTitleChange: fn(),
  onCreateTodo: fn(),
  onAddButtonClick: fn(),
  onCancelCreate: fn(),
  onToggleTodo: fn(),
  onDeleteTodo: fn(),
  onCloseLimitDialog: fn(),
};

/**
 * Default state with todos loaded
 */
export const Default: Story = {
  args: {
    todos: mockTodos,
    stats: mockStats,
    subscription: mockSubscription,
    isLoadingTodos: false,
    isCreatingTodo: false,
    isTogglingTodo: false,
    isDeletingTodo: false,
    newTodoTitle: "",
    isCreating: false,
    showLimitDialog: false,
    canDelete: true,
    ...defaultHandlers,
  },
};

/**
 * Loading state - shows spinner while fetching todos
 */
export const Loading: Story = {
  args: {
    ...Default.args,
    todos: [],
    stats: null,
    subscription: null,
    isLoadingTodos: true,
  },
};

/**
 * Empty state - no todos yet
 */
export const Empty: Story = {
  args: {
    ...Default.args,
    todos: [],
    stats: null,
    subscription: mockSubscription,
  },
};

/**
 * Creating a new todo - form is visible
 */
export const CreatingTodo: Story = {
  args: {
    ...Default.args,
    isCreating: true,
    newTodoTitle: "New task to be added",
  },
};

/**
 * Submitting a new todo - shows loading spinner on submit button
 */
export const SubmittingTodo: Story = {
  args: {
    ...Default.args,
    isCreating: true,
    newTodoTitle: "New task to be added",
    isCreatingTodo: true,
  },
};

/**
 * Single todo item
 */
export const SingleTodo: Story = {
  args: {
    ...Default.args,
    todos: [mockTodos[0]],
    stats: {
      total: 1,
      completed: 0,
      pending: 1,
      completionRate: 0,
    },
  },
};

/**
 * All todos completed - 100% progress
 */
export const AllCompleted: Story = {
  args: {
    ...Default.args,
    todos: mockTodos.map((todo) => ({ ...todo, completed: true })),
    stats: {
      total: 5,
      completed: 5,
      pending: 0,
      completionRate: 100,
    },
  },
};

/**
 * No delete permission - member role
 */
export const NoDeletePermission: Story = {
  args: {
    ...Default.args,
    canDelete: false,
  },
};

/**
 * Near limit - shows upgrade nudge
 */
export const NearLimit: Story = {
  args: {
    ...Default.args,
    subscription: mockSubscriptionNearLimit,
    stats: {
      total: 9,
      completed: 4,
      pending: 5,
      completionRate: 44,
    },
  },
};

/**
 * At limit - shows upgrade dialog
 */
export const AtLimit: Story = {
  args: {
    ...Default.args,
    subscription: mockSubscriptionAtLimit,
    showLimitDialog: true,
    stats: {
      total: 10,
      completed: 5,
      pending: 5,
      completionRate: 50,
    },
  },
};

/**
 * Pro plan - unlimited todos, no nudge
 */
export const ProPlan: Story = {
  args: {
    ...Default.args,
    todos: [...mockTodos, ...mockTodos, ...mockTodos],
    subscription: mockSubscriptionPro,
    stats: {
      total: 15,
      completed: 6,
      pending: 9,
      completionRate: 40,
    },
  },
};

/**
 * Long todo list - demonstrates scrolling
 */
export const LongList: Story = {
  args: {
    ...Default.args,
    todos: Array.from({ length: 20 }, (_, i) => ({
      id: `${i + 1}`,
      title: `Task ${i + 1}: ${i % 2 === 0 ? "Important task that needs attention" : "Regular task"}`,
      description:
        i % 3 === 0
          ? "This task has a longer description with more details about what needs to be done"
          : null,
      completed: i % 4 === 0,
    })),
    stats: {
      total: 20,
      completed: 5,
      pending: 15,
      completionRate: 25,
    },
  },
};

/**
 * Very long titles and descriptions
 */
export const LongContent: Story = {
  args: {
    ...Default.args,
    todos: [
      {
        id: "1",
        title:
          "This is a very long todo title that should demonstrate how the component handles text overflow and wrapping in the user interface",
        description:
          "This is an extremely long description that contains a lot of text to demonstrate how the component truncates long descriptions and handles overflow in the layout without breaking the design",
        completed: false,
      },
      {
        id: "2",
        title: "Short title",
        description:
          "Another really long description with lots of details about what needs to be done and how to do it properly without making mistakes or missing important steps",
        completed: true,
      },
    ],
    stats: {
      total: 2,
      completed: 1,
      pending: 1,
      completionRate: 50,
    },
  },
};

/**
 * No subscription data - graceful degradation
 */
export const NoSubscription: Story = {
  args: {
    ...Default.args,
    subscription: null,
  },
};

/**
 * No stats - only todo list visible
 */
export const NoStats: Story = {
  args: {
    ...Default.args,
    stats: null,
  },
};

/**
 * Interactive demo - all features enabled
 */
export const Interactive: Story = {
  args: {
    ...Default.args,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Interactive demo with all features enabled. Try adding, toggling, and deleting todos.",
      },
    },
  },
};
