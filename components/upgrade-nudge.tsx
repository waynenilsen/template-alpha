"use client";

import { useUpgradeNudge } from "@/hooks/use-upgrade-nudge";
import { getUsageLevel, UpgradeNudgeView } from "./upgrade-nudge-view";

export interface UpgradeNudgeProps {
  current: number;
  limit: number;
  planName: string;
}

/**
 * Upgrade nudge banner that shows when users are close to their todo limit
 * Connected wrapper component that manages state via hook
 */
export function UpgradeNudge({ current, limit, planName }: UpgradeNudgeProps) {
  const { isDismissed, handleDismiss } = useUpgradeNudge();

  return (
    <UpgradeNudgeView
      current={current}
      limit={limit}
      planName={planName}
      isDismissed={isDismissed}
      onDismiss={handleDismiss}
    />
  );
}

// Export the utility function for testing
export { getUsageLevel };
