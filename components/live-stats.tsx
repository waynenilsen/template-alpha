"use client";

import { useLiveStats } from "@/hooks/use-live-stats";
import { LiveStatsView } from "./live-stats-view";

/**
 * Connected live stats component
 * Wrapper that connects the useLiveStats hook with LiveStatsView
 * Demonstrates tRPC + TanStack Query integration using the new v11 queryOptions pattern
 */
export function LiveStats() {
  const { stats, health, isLoading, error } = useLiveStats();

  return (
    <LiveStatsView
      stats={stats}
      health={health}
      isLoading={isLoading}
      error={error}
    />
  );
}
