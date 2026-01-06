import type { Meta, StoryObj } from "@storybook/react";
import { AppShellView } from "./app-shell-view";

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
  },
} satisfies Meta<typeof AppShellView>;

export default meta;
type Story = StoryObj<typeof meta>;

const mockOrganizations = [
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

export const Loading: Story = {
  args: {
    isLoading: true,
    organizations: [],
    currentOrgId: null,
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
  },
};

export const WithoutUser: Story = {
  args: {
    isLoading: false,
    user: undefined,
    organizations: [],
    currentOrgId: null,
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
  },
};
