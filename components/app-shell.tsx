"use client";

import { AppShellView } from "@/components/app-shell-view";
import { useAppShell } from "@/hooks/use-app-shell";

export interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { user, organizations, currentOrgId, isLoading } = useAppShell();

  return (
    <AppShellView
      isLoading={isLoading}
      user={user}
      organizations={organizations}
      currentOrgId={currentOrgId}
    >
      {children}
    </AppShellView>
  );
}
