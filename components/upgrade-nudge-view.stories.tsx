import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { UpgradeNudgeView } from "./upgrade-nudge-view";

const meta = {
  title: "Components/UpgradeNudgeView",
  component: UpgradeNudgeView,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  args: {
    // Default values for all stories
    planName: "Free",
    isDismissed: false,
    onDismiss: fn(),
  },
} satisfies Meta<typeof UpgradeNudgeView>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * None - No nudge shown (under 70% usage)
 * This story demonstrates that nothing renders when usage is below threshold
 */
export const None: Story = {
  args: {
    current: 5,
    limit: 10,
  },
};

/**
 * Warning level - Shows when usage is 70-89%
 * Uses "Running low on todos" message and default variant
 */
export const Warning: Story = {
  args: {
    current: 7,
    limit: 10,
  },
};

/**
 * Critical level - Shows when usage is 90-99%
 * Uses "Almost at your limit" message and warning variant with alert icon
 */
export const Critical: Story = {
  args: {
    current: 9,
    limit: 10,
  },
};

/**
 * Limit reached - Shows when usage is 100%
 * Uses "Todo limit reached" message and warning variant with alert icon
 */
export const LimitReached: Story = {
  args: {
    current: 10,
    limit: 10,
  },
};

/**
 * Limit exceeded - Shows when usage exceeds 100%
 * Displays as limit reached with adjusted message
 */
export const LimitExceeded: Story = {
  args: {
    current: 12,
    limit: 10,
  },
};

/**
 * Dismissed state - No nudge shown after user dismisses
 */
export const Dismissed: Story = {
  args: {
    current: 9,
    limit: 10,
    isDismissed: true,
  },
};

/**
 * Unlimited plan - No nudge shown (limit is -1)
 */
export const Unlimited: Story = {
  args: {
    current: 100,
    limit: -1,
    planName: "Pro",
  },
};

/**
 * Warning with higher limits
 */
export const WarningHigherLimit: Story = {
  args: {
    current: 75,
    limit: 100,
    planName: "Starter",
  },
};

/**
 * Critical with single todo remaining
 */
export const CriticalOneRemaining: Story = {
  args: {
    current: 49,
    limit: 50,
    planName: "Starter",
  },
};

/**
 * Warning with exactly 70% usage
 */
export const WarningExact70Percent: Story = {
  args: {
    current: 70,
    limit: 100,
  },
};

/**
 * Critical with exactly 90% usage
 */
export const CriticalExact90Percent: Story = {
  args: {
    current: 90,
    limit: 100,
  },
};
