"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useTRPC } from "@/trpc/client";

export interface UseUpgradeLimitDialogOptions {
  onSuccess?: () => void;
}

export function useUpgradeLimitDialog(options?: UseUpgradeLimitDialogOptions) {
  const trpc = useTRPC();
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");

  const createCheckout = useMutation(
    trpc.subscription.createCheckout.mutationOptions({
      onSuccess: (data) => {
        window.location.href = data.url;
        options?.onSuccess?.();
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

  return {
    interval,
    setInterval,
    handleUpgrade,
    isLoading: createCheckout.isPending,
    error: createCheckout.error?.message ?? null,
  };
}
