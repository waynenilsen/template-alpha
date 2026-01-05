"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTRPC } from "@/trpc/client";

interface UpgradeButtonProps {
  planSlug: string;
  planName: string;
  isHighlighted?: boolean;
}

export function UpgradeButton({
  planSlug,
  planName,
  isHighlighted,
}: UpgradeButtonProps) {
  const trpc = useTRPC();
  const [isOpen, setIsOpen] = useState(false);
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
      planSlug,
      interval,
      successUrl: `${window.location.origin}/pricing?success=true`,
      cancelUrl: `${window.location.origin}/pricing?canceled=true`,
    });
  };

  return (
    <>
      <Button
        className="w-full"
        variant={isHighlighted ? "default" : "outline"}
        onClick={() => setIsOpen(true)}
      >
        Upgrade to {planName}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upgrade to {planName}</DialogTitle>
            <DialogDescription>Choose your billing frequency</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <label className="flex cursor-pointer items-center gap-4 rounded-lg border p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800">
              <input
                type="radio"
                name="interval"
                value="monthly"
                checked={interval === "monthly"}
                onChange={() => setInterval("monthly")}
                className="h-4 w-4"
              />
              <div className="flex-1">
                <p className="font-medium">Monthly billing</p>
                <p className="text-sm text-zinc-500">
                  Flexible, cancel anytime
                </p>
              </div>
            </label>

            <label className="flex cursor-pointer items-center gap-4 rounded-lg border p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800">
              <input
                type="radio"
                name="interval"
                value="yearly"
                checked={interval === "yearly"}
                onChange={() => setInterval("yearly")}
                className="h-4 w-4"
              />
              <div className="flex-1">
                <p className="font-medium">
                  Yearly billing{" "}
                  <span className="text-green-600 dark:text-green-400">
                    (Save up to 33%)
                  </span>
                </p>
                <p className="text-sm text-zinc-500">
                  Best value for committed users
                </p>
              </div>
            </label>
          </div>

          {createCheckout.error && (
            <p className="text-sm text-red-600">
              {createCheckout.error.message}
            </p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpgrade} disabled={createCheckout.isPending}>
              {createCheckout.isPending
                ? "Processing..."
                : "Continue to payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
