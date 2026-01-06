"use client";

import { Plus } from "lucide-react";
import { CreateOrganizationDialog } from "@/components/create-organization-dialog";
import type { Organization } from "@/components/dashboard-view";
import { DashboardView } from "@/components/dashboard-view";
import { OrgPicker } from "@/components/org-picker";
import { TodoList } from "@/components/todo-list";
import { Button } from "@/components/ui/button";
import { UserNav } from "@/components/user-nav";

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
      renderOrgPicker={() => (
        <OrgPicker organizations={organizations} currentOrgId={currentOrgId} />
      )}
      renderUserNav={() => (
        <UserNav email={user.email} isAdmin={user.isAdmin} />
      )}
      renderTodoList={() => <TodoList userRole={userRole} />}
      renderCreateOrgButton={() => (
        <CreateOrganizationDialog
          trigger={
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create Organization
            </Button>
          }
        />
      )}
    />
  );
}
