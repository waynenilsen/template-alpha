import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { OrgPickerView } from "@/components/org-picker-view";
import { UserNavView } from "@/components/user-nav-view";
import type { Organization } from "./app-shell-view";
import { AppShellView } from "./app-shell-view";

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

const meta = {
  title: "Components/AppShellView",
  component: AppShellView,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
  args: {
    children: (
      <div className="container mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold">Page Content</h2>
        <p className="mt-4 text-muted-foreground">
          This is where the page content would go. The AppShell provides the
          header with navigation and user menu.
        </p>
      </div>
    ),
    renderOrgPicker: createRenderOrgPicker([], null),
    renderUserNav: createRenderUserNav("user@example.com", false),
  },
} satisfies Meta<typeof AppShellView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  args: {
    isLoading: true,
    organizations: [],
    currentOrgId: null,
    renderOrgPicker: createRenderOrgPicker([], null),
    renderUserNav: createRenderUserNav("user@example.com", false),
  },
};

export const WithUser: Story = {
  args: {
    isLoading: false,
    user: {
      id: "user-1",
      email: "user@example.com",
      isAdmin: false,
    },
    organizations: mockOrganizations,
    currentOrgId: "org-1",
    renderOrgPicker: createRenderOrgPicker(mockOrganizations, "org-1"),
    renderUserNav: createRenderUserNav("user@example.com", false),
  },
};

export const WithAdminUser: Story = {
  args: {
    isLoading: false,
    user: {
      id: "admin-1",
      email: "admin@example.com",
      isAdmin: true,
    },
    organizations: mockOrganizations,
    currentOrgId: "org-1",
    renderOrgPicker: createRenderOrgPicker(mockOrganizations, "org-1"),
    renderUserNav: createRenderUserNav("admin@example.com", true),
  },
};

export const WithoutUser: Story = {
  args: {
    isLoading: false,
    user: undefined,
    organizations: [],
    currentOrgId: null,
    renderOrgPicker: createRenderOrgPicker([], null),
    renderUserNav: () => <></>,
  },
};

export const NoOrganizations: Story = {
  args: {
    isLoading: false,
    user: {
      id: "user-1",
      email: "user@example.com",
      isAdmin: false,
    },
    organizations: [],
    currentOrgId: null,
    renderOrgPicker: createRenderOrgPicker([], null),
    renderUserNav: createRenderUserNav("user@example.com", false),
  },
};

export const NoOrganizationSelected: Story = {
  args: {
    isLoading: false,
    user: {
      id: "user-1",
      email: "user@example.com",
      isAdmin: false,
    },
    organizations: mockOrganizations,
    currentOrgId: null,
    renderOrgPicker: createRenderOrgPicker(mockOrganizations, null),
    renderUserNav: createRenderUserNav("user@example.com", false),
  },
};

export const SingleOrganization: Story = {
  args: {
    isLoading: false,
    user: {
      id: "user-1",
      email: "user@example.com",
      isAdmin: false,
    },
    organizations: [mockOrganizations[0]],
    currentOrgId: "org-1",
    renderOrgPicker: createRenderOrgPicker([mockOrganizations[0]], "org-1"),
    renderUserNav: createRenderUserNav("user@example.com", false),
  },
};
