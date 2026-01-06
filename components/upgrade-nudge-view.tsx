import { AlertTriangle, ArrowRight, Sparkles, X, Zap } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export interface UpgradeNudgeViewProps {
  current: number;
  limit: number;
  planName: string;
  isDismissed: boolean;
  onDismiss: () => void;
}

/**
 * Calculate the usage percentage and determine nudge level
 */
export function getUsageLevel(current: number, limit: number) {
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
 * Stateless upgrade nudge banner view
 */
export function UpgradeNudgeView({
  current,
  limit,
  planName,
  isDismissed,
  onDismiss,
}: UpgradeNudgeViewProps) {
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
          onClick={onDismiss}
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
