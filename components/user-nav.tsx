"use client";

import { useUserNav } from "@/hooks/use-user-nav";
import { UserNavView } from "./user-nav-view";

export interface UserNavProps {
  email: string;
  isAdmin?: boolean;
}

/**
 * Connected user navigation component
 * Wrapper that connects the useUserNav hook with UserNavView
 */
export function UserNav({ email, isAdmin }: UserNavProps) {
  const { isPending, handleSignOut, handleNavigate } = useUserNav();

  return (
    <UserNavView
      email={email}
      isAdmin={isAdmin}
      isPending={isPending}
      onSignOut={handleSignOut}
      onNavigate={handleNavigate}
    />
  );
}
