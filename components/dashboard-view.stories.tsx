import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { Plus } from "lucide-react";
import { CreateOrganizationDialogView } from "@/components/create-organization-dialog-view";
import { OrgPickerView } from "@/components/org-picker-view";
import { TodoListView } from "@/components/todo-list-view";
import { Button } from "@/components/ui/button";
import { UserNavView } from "@/components/user-nav-view";
import type { Organization } from "./dashboard-view";
import { DashboardView } from "./dashboard-view";

const mockOrganizations: Organization[] = [
  {
    id: "org-1",
    name: "Acme Corp",
    slug: "acme-corp",
    role: "owner",
  },
  {
    id: "org-2",
    name: "Tech Startup",
    slug: "tech-startup",
    role: "admin",
  },
  {
    id: "org-3",
    name: "Design Agency",
    slug: "design-agency",
    role: "member",
  },
];

const mockTodos = [
  {
    id: "1",
    title: "Complete project documentation",
    description: "Write comprehensive docs for the new feature",
    completed: false,
  },
  {
    id: "2",
    title: "Review pull requests",
    description: null,
    completed: true,
  },
  {
    id: "3",
    title: "Update dependencies",
    description: null,
    completed: false,
  },
];

const mockStats = {
  total: 3,
  completed: 1,
  pending: 2,
  completionRate: 33,
};

const mockSubscription = {
  usage: {
    todos: {
      current: 3,
      limit: 10,
    },
  },
  plan: {
    name: "Free",
  },
};

// Mock handlers
const mockHandlers = {
  onNewTodoTitleChange: fn(),
  onCreateTodo: fn(),
  onAddButtonClick: fn(),
  onCancelCreate: fn(),
  onToggleTodo: fn(),
  onDeleteTodo: fn(),
  onCloseLimitDialog: fn(),
};

// Render prop factories
const createRenderOrgPicker =
  (organizations: Organization[], currentOrgId: string | null) => () => (
    <OrgPickerView
      organizations={organizations}
      currentOrgId={currentOrgId}
      currentOrgName={
        organizations.find((org) => org.id === currentOrgId)?.name
      }
      open={false}
      onOpenChange={fn()}
      onSelectOrg={fn()}
      onCreateClick={fn()}
      isPending={false}
      canManageOrg={true}
    />
  );

const createRenderUserNav = (email: string, isAdmin: boolean) => () => (
  <UserNavView
    email={email}
    isAdmin={isAdmin}
    isPending={false}
    onSignOut={fn()}
    onNavigate={fn()}
  />
);

const createRenderTodoList = () => () => (
  <TodoListView
    todos={mockTodos}
    stats={mockStats}
    subscription={mockSubscription}
    isLoadingTodos={false}
    isCreatingTodo={false}
    isTogglingTodo={false}
    isDeletingTodo={false}
    newTodoTitle=""
    isCreating={false}
    showLimitDialog={false}
    canDelete={true}
    {...mockHandlers}
  />
);

const createRenderCreateOrgButton = () => () => (
  <CreateOrganizationDialogView
    trigger={
      <Button className="gap-2">
        <Plus className="h-4 w-4" />
        Create Organization
      </Button>
    }
    open={false}
    onOpenChange={fn()}
    name=""
    onNameChange={fn()}
    error={null}
    isLoading={false}
    onSubmit={fn()}
    onCancel={fn()}
  />
);

const meta = {
  title: "Components/DashboardView",
  component: DashboardView,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
  args: {
    user: {
      id: "user-1",
      email: "user@example.com",
      isAdmin: false,
    },
    renderCreateOrgButton: createRenderCreateOrgButton(),
  },
} satisfies Meta<typeof DashboardView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithOrganizationSelected: Story = {
  args: {
    currentOrgId: "org-1",
    organizations: mockOrganizations,
    userRole: "owner",
    renderOrgPicker: createRenderOrgPicker(mockOrganizations, "org-1"),
    renderUserNav: createRenderUserNav("user@example.com", false),
    renderTodoList: createRenderTodoList(),
  },
};

export const WithOrganizationSelectedAsAdmin: Story = {
  args: {
    currentOrgId: "org-2",
    organizations: mockOrganizations,
    userRole: "admin",
    renderOrgPicker: createRenderOrgPicker(mockOrganizations, "org-2"),
    renderUserNav: createRenderUserNav("user@example.com", false),
    renderTodoList: createRenderTodoList(),
  },
};

export const WithOrganizationSelectedAsMember: Story = {
  args: {
    currentOrgId: "org-3",
    organizations: mockOrganizations,
    userRole: "member",
    renderOrgPicker: createRenderOrgPicker(mockOrganizations, "org-3"),
    renderUserNav: createRenderUserNav("user@example.com", false),
    renderTodoList: createRenderTodoList(),
  },
};

export const NoOrganizations: Story = {
  args: {
    currentOrgId: null,
    organizations: [],
    userRole: "member",
    renderOrgPicker: createRenderOrgPicker([], null),
    renderUserNav: createRenderUserNav("user@example.com", false),
    renderTodoList: createRenderTodoList(),
  },
};

export const OrganizationsButNoneSelected: Story = {
  args: {
    currentOrgId: null,
    organizations: mockOrganizations,
    userRole: "member",
    renderOrgPicker: createRenderOrgPicker(mockOrganizations, null),
    renderUserNav: createRenderUserNav("user@example.com", false),
    renderTodoList: createRenderTodoList(),
  },
};

export const AdminUser: Story = {
  args: {
    user: {
      id: "admin-1",
      email: "admin@example.com",
      isAdmin: true,
    },
    currentOrgId: "org-1",
    organizations: mockOrganizations,
    userRole: "owner",
    renderOrgPicker: createRenderOrgPicker(mockOrganizations, "org-1"),
    renderUserNav: createRenderUserNav("admin@example.com", true),
    renderTodoList: createRenderTodoList(),
  },
};

export const SingleOrganization: Story = {
  args: {
    currentOrgId: "org-1",
    organizations: [mockOrganizations[0]],
    userRole: "owner",
    renderOrgPicker: createRenderOrgPicker([mockOrganizations[0]], "org-1"),
    renderUserNav: createRenderUserNav("user@example.com", false),
    renderTodoList: createRenderTodoList(),
  },
};
