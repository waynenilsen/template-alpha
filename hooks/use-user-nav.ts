"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { signOut } from "@/lib/auth/actions";

export interface UseUserNavReturn {
  isPending: boolean;
  handleSignOut: () => void;
  handleNavigate: (path: string) => void;
}

/**
 * Hook for user navigation logic
 * Handles sign out and navigation with transition states
 */
export function useUserNav(): UseUserNavReturn {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleSignOut = () => {
    startTransition(async () => {
      const result = await signOut();
      if (result.success) {
        router.push(result.redirectTo);
        router.refresh();
      }
    });
  };

  const handleNavigate = (path: string) => {
    router.push(path);
  };

  return {
    isPending,
    handleSignOut,
    handleNavigate,
  };
}
