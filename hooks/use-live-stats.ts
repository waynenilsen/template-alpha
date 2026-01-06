"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

export interface UseLiveStatsReturn {
  stats:
    | {
        totalUsers: number;
        totalTenants: number;
        totalTodos: number;
        completedTodos: number;
        timestamp: Date;
      }
    | undefined;
  health:
    | {
        status: string;
      }
    | undefined;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook for fetching live stats data
 * Uses tRPC + TanStack Query integration
 */
export function useLiveStats(): UseLiveStatsReturn {
  const trpc = useTRPC();

  // Using the new TanStack Query integration pattern
  const { data: stats, isLoading, error } = useQuery(trpc.stats.queryOptions());
  const { data: health } = useQuery(trpc.health.queryOptions());

  return {
    stats,
    health,
    isLoading,
    error: error as Error | null,
  };
}
