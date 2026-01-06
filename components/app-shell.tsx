"use client";

import { AppShellView } from "@/components/app-shell-view";
import { OrgPicker } from "@/components/org-picker";
import { UserNav } from "@/components/user-nav";
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
      renderOrgPicker={() => (
        <OrgPicker organizations={organizations} currentOrgId={currentOrgId} />
      )}
      renderUserNav={() =>
        user ? <UserNav email={user.email} isAdmin={user.isAdmin} /> : null
      }
    >
      {children}
    </AppShellView>
  );
}
