import type { Meta, StoryObj } from "@storybook/react";
import { LiveStatsView } from "./live-stats-view";

const meta = {
  title: "Components/LiveStatsView",
  component: LiveStatsView,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    stats: {
      totalUsers: 42,
      totalTenants: 12,
      totalTodos: 156,
      completedTodos: 89,
      timestamp: new Date().toISOString(),
    },
    health: {
      status: "ok",
    },
    isLoading: false,
    error: null,
  },
} satisfies Meta<typeof LiveStatsView>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default live stats view with connected status
 */
export const Connected: Story = {};

/**
 * Loading state while fetching stats
 */
export const Loading: Story = {
  args: {
    stats: undefined,
    isLoading: true,
  },
};

/**
 * Error state when server is disconnected
 */
export const ErrorState: Story = {
  args: {
    stats: undefined,
    health: undefined,
    isLoading: false,
    error: new globalThis.Error("Failed to fetch stats"),
  },
};

/**
 * Disconnected state (health check failing)
 */
export const Disconnected: Story = {
  args: {
    health: {
      status: "error",
    },
  },
};

/**
 * Empty stats (no data yet)
 */
export const EmptyStats: Story = {
  args: {
    stats: {
      totalUsers: 0,
      totalTenants: 0,
      totalTodos: 0,
      completedTodos: 0,
      timestamp: new Date().toISOString(),
    },
  },
};

/**
 * Large numbers to test layout
 */
export const LargeNumbers: Story = {
  args: {
    stats: {
      totalUsers: 1234,
      totalTenants: 567,
      totalTodos: 9876,
      completedTodos: 5432,
      timestamp: new Date().toISOString(),
    },
  },
};

/**
 * Connecting state (no health data yet)
 */
export const Connecting: Story = {
  args: {
    health: undefined,
    isLoading: true,
  },
};
