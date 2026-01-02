"use client";

import { Building2, Plus } from "lucide-react";
import { type Organization, OrgPicker } from "@/components/org-picker";
import { TodoList } from "@/components/todo-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const userRole = currentOrg?.role ?? "member";

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-white dark:bg-zinc-900">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold">Todo App</h1>
            <OrgPicker
              organizations={organizations}
              currentOrgId={currentOrgId}
            />
          </div>
          <UserNav email={user.email} />
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-8">
        {currentOrgId && currentOrg ? (
          <TodoList userRole={userRole} />
        ) : organizations.length === 0 ? (
          <NoOrganizations />
        ) : (
          <SelectOrganization />
        )}
      </main>
    </div>
  );
}

function NoOrganizations() {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
            <Building2 className="h-6 w-6 text-zinc-600 dark:text-zinc-400" />
          </div>
          <CardTitle>No Organizations Yet</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="mb-6 text-muted-foreground">
            You're not a member of any organization yet. Create one to get
            started with your todos.
          </p>
          <Button className="gap-2" disabled>
            <Plus className="h-4 w-4" />
            Create Organization
          </Button>
          <p className="mt-4 text-xs text-muted-foreground">
            Organization creation coming soon
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function SelectOrganization() {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
            <Building2 className="h-6 w-6 text-zinc-600 dark:text-zinc-400" />
          </div>
          <CardTitle>Select an Organization</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-muted-foreground">
            Use the organization picker above to select which workspace you want
            to view.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
