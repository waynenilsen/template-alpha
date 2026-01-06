"use client";

import { AlertTriangle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useUpgradeLimitDialog } from "@/hooks/use-upgrade-limit-dialog";

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
 * Connected wrapper component that manages state via hook
 */
export function UpgradeLimitDialog({
  open,
  onOpenChange,
  current,
  limit,
  planName,
}: UpgradeLimitDialogProps) {
  const { interval, setInterval, handleUpgrade, isLoading, error } =
    useUpgradeLimitDialog();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="upgrade-limit-dialog">
        <UpgradeLimitDialogContent
          current={current}
          limit={limit}
          planName={planName}
          interval={interval}
          onIntervalChange={setInterval}
          onUpgrade={handleUpgrade}
          onClose={() => onOpenChange(false)}
          isLoading={isLoading}
          error={error}
        />
      </DialogContent>
    </Dialog>
  );
}
