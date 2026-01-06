"use client";

import Link from "next/link";
import { type Organization, OrgPicker } from "@/components/org-picker";
import { Skeleton } from "@/components/ui/skeleton";
import { UserNav } from "@/components/user-nav";

export interface AppShellViewProps {
  children: React.ReactNode;
  isLoading: boolean;
  user?: {
    id: string;
    email: string;
    isAdmin: boolean;
  };
  organizations: Organization[];
  currentOrgId: string | null;
}

export function AppShellView({
  children,
  isLoading,
  user,
  organizations,
  currentOrgId,
}: AppShellViewProps) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-white dark:bg-zinc-900">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <h1 className="text-lg font-semibold">Todo App</h1>
            </Link>
            {isLoading ? (
              <Skeleton className="h-9 w-[200px]" />
            ) : (
              <OrgPicker
                organizations={organizations}
                currentOrgId={currentOrgId}
              />
            )}
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-8 rounded-full" />
          ) : user ? (
            <UserNav email={user.email} isAdmin={user.isAdmin} />
          ) : null}
        </div>
      </header>

      {/* Main content */}
      <main>{children}</main>
    </div>
  );
}
