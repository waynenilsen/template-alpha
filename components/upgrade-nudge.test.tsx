import { describe, expect, mock, test } from "bun:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

// Mock the tRPC client before importing the component
mock.module("@/trpc/client", () => ({
  useTRPC: () => ({
    subscription: {
      createCheckout: {
        mutationOptions: () => ({}),
      },
    },
  }),
}));

// Mock React Query's useMutation
mock.module("@tanstack/react-query", () => ({
  useMutation: (_options: unknown) => ({
    mutate: mock(() => {}),
    isPending: false,
    error: null,
  }),
}));

// Mock the custom hooks
mock.module("@/hooks/use-upgrade-nudge", () => ({
  useUpgradeNudge: () => ({
    isDismissed: false,
    handleDismiss: mock(() => {}),
  }),
}));

mock.module("@/hooks/use-upgrade-limit-dialog", () => ({
  useUpgradeLimitDialog: () => ({
    interval: "monthly" as const,
    setInterval: mock(() => {}),
    handleUpgrade: mock(() => {}),
    isLoading: false,
    error: null,
  }),
}));

import {
  UpgradeLimitDialog,
  UpgradeLimitDialogContent,
} from "./upgrade-limit-dialog";
// Import after mocking
import { getUsageLevel, UpgradeNudge } from "./upgrade-nudge";

describe("getUsageLevel", () => {
  test("returns none for unlimited plans", () => {
    const result = getUsageLevel(100, -1);
    expect(result.level).toBe("none");
    expect(result.percentage).toBe(0);
  });

  test("returns none for usage below 70%", () => {
    const result = getUsageLevel(5, 10);
    expect(result.level).toBe("none");
    expect(result.percentage).toBe(50);
  });

  test("returns warning for usage between 70-89%", () => {
    const result = getUsageLevel(7, 10);
    expect(result.level).toBe("warning");
    expect(result.percentage).toBe(70);

    const result2 = getUsageLevel(8, 10);
    expect(result2.level).toBe("warning");
    expect(result2.percentage).toBe(80);
  });

  test("returns critical for usage between 90-99%", () => {
    const result = getUsageLevel(9, 10);
    expect(result.level).toBe("critical");
    expect(result.percentage).toBe(90);
  });

  test("returns limit for usage at or above 100%", () => {
    const result = getUsageLevel(10, 10);
    expect(result.level).toBe("limit");
    expect(result.percentage).toBe(100);

    // Over limit case
    const result2 = getUsageLevel(11, 10);
    expect(result2.level).toBe("limit");
    expect(result2.percentage).toBe(100); // Capped at 100
  });

  test("handles edge case of 0 usage", () => {
    const result = getUsageLevel(0, 10);
    expect(result.level).toBe("none");
    expect(result.percentage).toBe(0);
  });

  test("handles edge case of 0 limit", () => {
    // Edge case: 0 limit means can't create any
    const result = getUsageLevel(0, 0);
    expect(result.level).toBe("limit");
    expect(result.percentage).toBe(100);
  });
});

describe("UpgradeNudge", () => {
  test("renders nothing for unlimited plans", () => {
    const html = renderToString(
      createElement(UpgradeNudge, {
        current: 100,
        limit: -1,
        planName: "Team",
      }),
    );

    // Should render empty (React renderToString returns empty comment for null)
    expect(html).toBe("");
  });

  test("renders nothing when below 70% usage", () => {
    const html = renderToString(
      createElement(UpgradeNudge, {
        current: 5,
        limit: 10,
        planName: "Free",
      }),
    );

    expect(html).toBe("");
  });

  test("renders warning nudge at 70% usage", () => {
    const html = renderToString(
      createElement(UpgradeNudge, {
        current: 7,
        limit: 10,
        planName: "Free",
      }),
    );

    expect(html).toContain("upgrade-nudge");
    expect(html).toContain("Running low on todos");
    // React renders numbers with comments, so check for the values individually
    expect(html).toContain(">7<");
    expect(html).toContain(">10<");
    expect(html).toContain("3");
    expect(html).toContain("todos");
    expect(html).toContain("remaining");
    expect(html).toContain("Free");
    expect(html).toContain("Upgrade for more");
  });

  test("renders critical nudge at 90% usage", () => {
    const html = renderToString(
      createElement(UpgradeNudge, {
        current: 9,
        limit: 10,
        planName: "Free",
      }),
    );

    expect(html).toContain("upgrade-nudge");
    expect(html).toContain("Almost at your limit");
    expect(html).toContain(">9<");
    expect(html).toContain(">10<");
    expect(html).toContain("1");
    expect(html).toContain("todo");
    expect(html).toContain("remaining");
  });

  test("renders limit reached nudge at 100% usage", () => {
    const html = renderToString(
      createElement(UpgradeNudge, {
        current: 10,
        limit: 10,
        planName: "Free",
      }),
    );

    expect(html).toContain("upgrade-nudge");
    expect(html).toContain("Todo limit reached");
    expect(html).toContain(">10<");
    expect(html).toContain("maximum of");
    expect(html).toContain("todos on the");
  });

  test("includes dismiss button", () => {
    const html = renderToString(
      createElement(UpgradeNudge, {
        current: 8,
        limit: 10,
        planName: "Free",
      }),
    );

    expect(html).toContain("upgrade-nudge-dismiss");
  });

  test("links to pricing page", () => {
    const html = renderToString(
      createElement(UpgradeNudge, {
        current: 8,
        limit: 10,
        planName: "Free",
      }),
    );

    expect(html).toContain('href="/pricing"');
  });

  test("handles singular todo correctly", () => {
    const html = renderToString(
      createElement(UpgradeNudge, {
        current: 9,
        limit: 10,
        planName: "Free",
      }),
    );

    // At 9/10, there's 1 todo remaining
    expect(html).toContain("1");
    expect(html).toContain("todo");
    // Should not have "todos" plural for 1 remaining
    expect(html).not.toContain("todos remaining");
  });

  test("handles plural todos correctly", () => {
    const html = renderToString(
      createElement(UpgradeNudge, {
        current: 7,
        limit: 10,
        planName: "Free",
      }),
    );

    // At 7/10, there are 3 todos remaining
    expect(html).toContain("3");
    expect(html).toContain("todos");
    expect(html).toContain("remaining");
  });
});

describe("UpgradeLimitDialogContent", () => {
  const defaultProps = {
    current: 10,
    limit: 10,
    planName: "Free",
    interval: "monthly" as const,
    onIntervalChange: mock(() => {}),
    onUpgrade: mock(() => {}),
    onClose: mock(() => {}),
    isLoading: false,
    error: null,
  };

  test("renders dialog content", () => {
    const html = renderToString(
      createElement(UpgradeLimitDialogContent, defaultProps),
    );

    expect(html).toContain("upgrade-limit-dialog-content");
    expect(html).toContain("Todo Limit Reached");
    expect(html).toContain("Free");
    expect(html).toContain("Upgrade to continue creating todos");
  });

  test("displays usage count", () => {
    const html = renderToString(
      createElement(UpgradeLimitDialogContent, defaultProps),
    );

    expect(html).toContain("usage-count");
    expect(html).toContain(">10<");
  });

  test("includes billing interval options", () => {
    const html = renderToString(
      createElement(UpgradeLimitDialogContent, defaultProps),
    );

    expect(html).toContain("Monthly billing");
    expect(html).toContain("Yearly billing");
    expect(html).toContain("Save 33%");
    expect(html).toContain("interval-monthly");
    expect(html).toContain("interval-yearly");
  });

  test("includes upgrade to pro button", () => {
    const html = renderToString(
      createElement(UpgradeLimitDialogContent, defaultProps),
    );

    expect(html).toContain("upgrade-to-pro");
    expect(html).toContain("Upgrade to Pro");
  });

  test("includes maybe later button", () => {
    const html = renderToString(
      createElement(UpgradeLimitDialogContent, defaultProps),
    );

    expect(html).toContain("upgrade-maybe-later");
    expect(html).toContain("Maybe later");
  });

  test("monthly billing is selected by default", () => {
    const html = renderToString(
      createElement(UpgradeLimitDialogContent, defaultProps),
    );

    // The monthly radio should be checked
    expect(html).toMatch(/interval-monthly[^>]*checked/);
  });

  test("yearly billing can be selected", () => {
    const html = renderToString(
      createElement(UpgradeLimitDialogContent, {
        ...defaultProps,
        interval: "yearly",
      }),
    );

    // The yearly radio should be checked
    expect(html).toMatch(/interval-yearly[^>]*checked/);
  });

  test("shows loading state when processing", () => {
    const html = renderToString(
      createElement(UpgradeLimitDialogContent, {
        ...defaultProps,
        isLoading: true,
      }),
    );

    expect(html).toContain("Processing...");
    expect(html).toContain("disabled");
  });

  test("shows error message when error exists", () => {
    const html = renderToString(
      createElement(UpgradeLimitDialogContent, {
        ...defaultProps,
        error: "Payment failed. Please try again.",
      }),
    );

    expect(html).toContain("upgrade-error");
    expect(html).toContain("Payment failed. Please try again.");
  });

  test("does not show error when error is null", () => {
    const html = renderToString(
      createElement(UpgradeLimitDialogContent, {
        ...defaultProps,
        error: null,
      }),
    );

    expect(html).not.toContain("upgrade-error");
  });

  test("displays correct usage count with different values", () => {
    const html = renderToString(
      createElement(UpgradeLimitDialogContent, {
        ...defaultProps,
        current: 15,
        limit: 20,
      }),
    );

    expect(html).toContain(">15<");
    expect(html).toContain(">20<");
  });

  test("displays plan name in description", () => {
    const html = renderToString(
      createElement(UpgradeLimitDialogContent, {
        ...defaultProps,
        planName: "Starter",
      }),
    );

    expect(html).toContain("Starter");
  });
});

describe("UpgradeLimitDialog", () => {
  test("renders when open (with mocked hooks)", () => {
    // The dialog uses a portal, so we can't test the full rendered output
    // But we can verify the component initializes without errors
    const html = renderToString(
      createElement(UpgradeLimitDialog, {
        open: true,
        onOpenChange: mock(() => {}),
        current: 10,
        limit: 10,
        planName: "Free",
      }),
    );

    // Dialog uses portal, so content won't be in the SSR output
    // But the component should render without errors
    expect(html).toBeDefined();
  });

  test("renders when closed", () => {
    const html = renderToString(
      createElement(UpgradeLimitDialog, {
        open: false,
        onOpenChange: mock(() => {}),
        current: 10,
        limit: 10,
        planName: "Free",
      }),
    );

    expect(html).toBeDefined();
  });

  test("accepts all required props", () => {
    const onOpenChange = mock(() => {});
    const html = renderToString(
      createElement(UpgradeLimitDialog, {
        open: true,
        onOpenChange,
        current: 5,
        limit: 10,
        planName: "Pro",
      }),
    );

    expect(html).toBeDefined();
  });
});
