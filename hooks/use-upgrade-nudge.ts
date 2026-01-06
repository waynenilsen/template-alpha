"use client";

import { useState } from "react";

export function useUpgradeNudge() {
  const [isDismissed, setIsDismissed] = useState(false);

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  return {
    isDismissed,
    handleDismiss,
  };
}
