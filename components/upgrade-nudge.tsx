"use client";

import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Sparkles, X, Zap } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useTRPC } from "@/trpc/client";

export interface UpgradeNudgeProps {
  current: number;
  limit: number;
  planName: string;
}

/**
 * Calculate the usage percentage and determine nudge level
 */
function getUsageLevel(current: number, limit: number) {
  if (limit === -1) return { percentage: 0, level: "none" as const };
  // Handle edge case where limit is 0 (should never happen, but be safe)
  if (limit === 0) return { percentage: 100, level: "limit" as const };
  const percentage = Math.round((current / limit) * 100);

  if (percentage >= 100) return { percentage: 100, level: "limit" as const };
  if (percentage >= 90) return { percentage, level: "critical" as const };
  if (percentage >= 70) return { percentage, level: "warning" as const };
  return { percentage, level: "none" as const };
}

/**
 * Upgrade nudge banner that shows when users are close to their todo limit
 */
export function UpgradeNudge({ current, limit, planName }: UpgradeNudgeProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const { percentage, level } = getUsageLevel(current, limit);

  // Don't show if unlimited, below threshold, or dismissed
  if (level === "none" || isDismissed) return null;

  const remaining = limit - current;

  return (
    <Alert
      variant={
        level === "critical" || level === "limit" ? "warning" : "default"
      }
      className="relative"
      data-testid="upgrade-nudge"
    >
      {level === "critical" || level === "limit" ? (
        <AlertTriangle className="h-4 w-4" />
      ) : (
        <Zap className="h-4 w-4" />
      )}
      <AlertTitle className="flex items-center justify-between">
        <span>
          {level === "limit"
            ? "Todo limit reached"
            : level === "critical"
              ? "Almost at your limit"
              : "Running low on todos"}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 h-6 w-6"
          onClick={() => setIsDismissed(true)}
          data-testid="upgrade-nudge-dismiss"
        >
          <X className="h-3 w-3" />
        </Button>
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-3">
        <div className="flex items-center gap-2">
          <Progress value={percentage} className="flex-1" />
          <span className="text-sm font-medium whitespace-nowrap">
            {current}/{limit}
          </span>
        </div>
        <p className="text-sm">
          {level === "limit" ? (
            <>
              You've reached the maximum of {limit} todos on the{" "}
              <strong>{planName}</strong> plan.
            </>
          ) : (
            <>
              You have {remaining} todo{remaining !== 1 ? "s" : ""} remaining on
              the <strong>{planName}</strong> plan.
            </>
          )}
        </p>
        <Button variant="default" size="sm" className="gap-1" asChild>
          <a href="/pricing">
            <Sparkles className="h-3 w-3" />
            Upgrade for more
            <ArrowRight className="h-3 w-3" />
          </a>
        </Button>
      </AlertDescription>
    </Alert>
  );
}

/**
 * Props for the dialog content component (for testing)
 */
export interface UpgradeLimitDialogContentProps {
  current: number;
  limit: number;
  planName: string;
  interval: "monthly" | "yearly";
  onIntervalChange: (interval: "monthly" | "yearly") => void;
  onUpgrade: () => void;
  onClose: () => void;
  isLoading: boolean;
  error: string | null;
}

/**
 * The inner content of the upgrade limit dialog
 * Separated for unit testing (Dialog portals don't work with SSR)
 */
export function UpgradeLimitDialogContent({
  current,
  limit,
  planName,
  interval,
  onIntervalChange,
  onUpgrade,
  onClose,
  isLoading,
  error,
}: UpgradeLimitDialogContentProps) {
  return (
    <div data-testid="upgrade-limit-dialog-content">
      <div className="text-center mb-4">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900">
          <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
        </div>
        <h2 className="text-lg font-semibold" data-testid="dialog-title">
          Todo Limit Reached
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          You've used all {limit} todos available on the{" "}
          <strong>{planName}</strong> plan. Upgrade to continue creating todos.
        </p>
      </div>

      <div className="my-4 space-y-4">
        <div className="flex items-center justify-center gap-2">
          <Progress value={100} className="w-48" />
          <span className="text-sm font-medium" data-testid="usage-count">
            {current}/{limit}
          </span>
        </div>

        <div className="grid gap-2">
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800">
            <input
              type="radio"
              name="interval"
              value="monthly"
              checked={interval === "monthly"}
              onChange={() => onIntervalChange("monthly")}
              className="h-4 w-4"
              data-testid="interval-monthly"
            />
            <span className="text-sm">Monthly billing</span>
          </label>

          <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800">
            <input
              type="radio"
              name="interval"
              value="yearly"
              checked={interval === "yearly"}
              onChange={() => onIntervalChange("yearly")}
              className="h-4 w-4"
              data-testid="interval-yearly"
            />
            <span className="text-sm">
              Yearly billing{" "}
              <span className="text-green-600 dark:text-green-400">
                (Save 33%)
              </span>
            </span>
          </label>
        </div>

        {error && (
          <p
            className="text-sm text-red-600 text-center"
            data-testid="upgrade-error"
          >
            {error}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Button
          className="w-full gap-2"
          onClick={onUpgrade}
          disabled={isLoading}
          data-testid="upgrade-to-pro"
        >
          <Sparkles className="h-4 w-4" />
          {isLoading ? "Processing..." : "Upgrade to Pro"}
        </Button>
        <Button
          variant="outline"
          className="w-full"
          onClick={onClose}
          data-testid="upgrade-maybe-later"
        >
          Maybe later
        </Button>
      </div>
    </div>
  );
}

export interface UpgradeLimitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: number;
  limit: number;
  planName: string;
}

/**
 * Dialog shown when users try to create a todo after hitting their limit
 */
export function UpgradeLimitDialog({
  open,
  onOpenChange,
  current,
  limit,
  planName,
}: UpgradeLimitDialogProps) {
  const trpc = useTRPC();
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");

  const createCheckout = useMutation(
    trpc.subscription.createCheckout.mutationOptions({
      onSuccess: (data) => {
        window.location.href = data.url;
      },
    }),
  );

  const handleUpgrade = () => {
    createCheckout.mutate({
      planSlug: "pro",
      interval,
      successUrl: `${window.location.origin}/?upgraded=true`,
      cancelUrl: `${window.location.origin}/?upgrade_canceled=true`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="upgrade-limit-dialog">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900">
            <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <DialogTitle className="text-center">Todo Limit Reached</DialogTitle>
          <DialogDescription className="text-center">
            You've used all {limit} todos available on the{" "}
            <strong>{planName}</strong> plan. Upgrade to continue creating
            todos.
          </DialogDescription>
        </DialogHeader>

        <div className="my-4 space-y-4">
          <div className="flex items-center justify-center gap-2">
            <Progress value={100} className="w-48" />
            <span className="text-sm font-medium">
              {current}/{limit}
            </span>
          </div>

          <div className="grid gap-2">
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800">
              <input
                type="radio"
                name="interval"
                value="monthly"
                checked={interval === "monthly"}
                onChange={() => setInterval("monthly")}
                className="h-4 w-4"
              />
              <span className="text-sm">Monthly billing</span>
            </label>

            <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800">
              <input
                type="radio"
                name="interval"
                value="yearly"
                checked={interval === "yearly"}
                onChange={() => setInterval("yearly")}
                className="h-4 w-4"
              />
              <span className="text-sm">
                Yearly billing{" "}
                <span className="text-green-600 dark:text-green-400">
                  (Save 33%)
                </span>
              </span>
            </label>
          </div>

          {createCheckout.error && (
            <p className="text-sm text-red-600 text-center">
              {createCheckout.error.message}
            </p>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            className="w-full gap-2"
            onClick={handleUpgrade}
            disabled={createCheckout.isPending}
            data-testid="upgrade-to-pro"
          >
            <Sparkles className="h-4 w-4" />
            {createCheckout.isPending ? "Processing..." : "Upgrade to Pro"}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Maybe later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Export the utility function for testing
export { getUsageLevel };
