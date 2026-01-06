import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { UpgradeLimitDialogContent } from "./upgrade-limit-dialog";

const meta = {
  title: "Components/UpgradeLimitDialogContent",
  component: UpgradeLimitDialogContent,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    // Default values for all stories
    current: 10,
    limit: 10,
    planName: "Free",
    onIntervalChange: fn(),
    onUpgrade: fn(),
    onClose: fn(),
  },
} satisfies Meta<typeof UpgradeLimitDialogContent>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default state with monthly billing selected
 */
export const MonthlyBilling: Story = {
  args: {
    interval: "monthly",
    isLoading: false,
    error: null,
  },
};

/**
 * Yearly billing selected (with savings indicator)
 */
export const YearlyBilling: Story = {
  args: {
    interval: "yearly",
    isLoading: false,
    error: null,
  },
};

/**
 * Loading state when processing the upgrade
 */
export const Loading: Story = {
  args: {
    interval: "monthly",
    isLoading: true,
    error: null,
  },
};

/**
 * Error state when upgrade fails
 */
export const WithError: Story = {
  args: {
    interval: "monthly",
    isLoading: false,
    error: "Failed to create checkout session. Please try again.",
  },
};

/**
 * Dialog with different usage count
 */
export const HigherLimit: Story = {
  args: {
    current: 50,
    limit: 50,
    planName: "Starter",
    interval: "monthly",
    isLoading: false,
    error: null,
  },
};

/**
 * Dialog showing user exceeded by 1 todo
 */
export const ExceededByOne: Story = {
  args: {
    current: 11,
    limit: 10,
    planName: "Free",
    interval: "yearly",
    isLoading: false,
    error: null,
  },
};
