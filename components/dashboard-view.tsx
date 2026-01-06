import { Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  role: string;
}

export interface DashboardViewProps {
  user: {
    id: string;
    email: string;
    isAdmin: boolean;
  };
  currentOrgId: string | null;
  organizations: Organization[];
  userRole: "owner" | "admin" | "member";
  /** Render prop for the organization picker */
  renderOrgPicker: () => React.ReactNode;
  /** Render prop for the user navigation */
  renderUserNav: () => React.ReactNode;
  /** Render prop for the todo list (shown when org selected) */
  renderTodoList: () => React.ReactNode;
  /** Render prop for the create organization dialog trigger */
  renderCreateOrgButton: () => React.ReactNode;
}

export function DashboardView({
  currentOrgId,
  organizations,
  renderOrgPicker,
  renderUserNav,
  renderTodoList,
  renderCreateOrgButton,
}: DashboardViewProps) {
  const currentOrg = organizations.find((org) => org.id === currentOrgId);

  return (
    <div
      className="min-h-screen bg-zinc-50 dark:bg-zinc-950"
      data-testid="dashboard"
    >
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-white dark:bg-zinc-900">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold" data-testid="dashboard-title">
              Todo App
            </h1>
            {renderOrgPicker()}
          </div>
          {renderUserNav()}
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-8">
        {currentOrgId && currentOrg ? (
          renderTodoList()
        ) : organizations.length === 0 ? (
          <NoOrganizations renderCreateOrgButton={renderCreateOrgButton} />
        ) : (
          <SelectOrganization />
        )}
      </main>
    </div>
  );
}

interface NoOrganizationsProps {
  renderCreateOrgButton: () => React.ReactNode;
}

function NoOrganizations({ renderCreateOrgButton }: NoOrganizationsProps) {
  return (
    <div
      className="flex min-h-[400px] items-center justify-center"
      data-testid="no-organizations"
    >
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
          {renderCreateOrgButton()}
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
