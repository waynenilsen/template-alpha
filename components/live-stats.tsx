"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Building2,
  CheckCircle,
  ListTodo,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTRPC } from "@/trpc/client";

/**
 * Live stats component demonstrating tRPC + TanStack Query integration
 * Uses the new v11 queryOptions pattern
 */
export function LiveStats() {
  const trpc = useTRPC();

  // Using the new TanStack Query integration pattern
  const { data: stats, isLoading, error } = useQuery(trpc.stats.queryOptions());
  const { data: health } = useQuery(trpc.health.queryOptions());

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
        <CardContent className="p-4 text-center text-red-600 dark:text-red-400">
          Failed to load stats. Make sure the server is running.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <CardContent className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
            Live Platform Stats
          </h3>
          <Badge
            variant={health?.status === "ok" ? "default" : "secondary"}
            className="gap-1"
          >
            <Activity className="h-3 w-3" />
            {health?.status === "ok" ? "Connected via tRPC" : "Connecting..."}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatItem
            icon={Users}
            label="Users"
            value={stats?.totalUsers}
            isLoading={isLoading}
          />
          <StatItem
            icon={Building2}
            label="Tenants"
            value={stats?.totalTenants}
            isLoading={isLoading}
          />
          <StatItem
            icon={ListTodo}
            label="Todos"
            value={stats?.totalTodos}
            isLoading={isLoading}
          />
          <StatItem
            icon={CheckCircle}
            label="Completed"
            value={stats?.completedTodos}
            isLoading={isLoading}
          />
        </div>

        {stats?.timestamp && (
          <p className="mt-4 text-center text-xs text-zinc-500">
            Last updated: {new Date(stats.timestamp).toLocaleTimeString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function StatItem({
  icon: Icon,
  label,
  value,
  isLoading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: number;
  isLoading: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
      <Icon className="h-5 w-5 text-zinc-500" />
      {isLoading ? (
        <Skeleton className="h-7 w-12" />
      ) : (
        <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          {value ?? 0}
        </span>
      )}
      <span className="text-xs text-zinc-500">{label}</span>
    </div>
  );
}
