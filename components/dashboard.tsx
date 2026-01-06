"use client";

import { DashboardView } from "@/components/dashboard-view";
import type { Organization } from "@/components/org-picker";

export interface DashboardProps {
  user: {
    id: string;
    email: string;
    isAdmin: boolean;
  };
  currentOrgId: string | null;
  organizations: Organization[];
}

export function Dashboard({
  user,
  currentOrgId,
  organizations,
}: DashboardProps) {
  const currentOrg = organizations.find((org) => org.id === currentOrgId);
  const userRole = (currentOrg?.role ?? "member") as
    | "owner"
    | "admin"
    | "member";

  return (
    <DashboardView
      user={user}
      currentOrgId={currentOrgId}
      organizations={organizations}
      userRole={userRole}
    />
  );
}
