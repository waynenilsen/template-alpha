import type { Meta, StoryObj } from "@storybook/react";
import { DashboardView } from "./dashboard-view";

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
  },
} satisfies Meta<typeof DashboardView>;

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

export const WithOrganizationSelected: Story = {
  args: {
    currentOrgId: "org-1",
    organizations: mockOrganizations,
    userRole: "owner",
  },
};

export const WithOrganizationSelectedAsAdmin: Story = {
  args: {
    currentOrgId: "org-2",
    organizations: mockOrganizations,
    userRole: "admin",
  },
};

export const WithOrganizationSelectedAsMember: Story = {
  args: {
    currentOrgId: "org-3",
    organizations: mockOrganizations,
    userRole: "member",
  },
};

export const NoOrganizations: Story = {
  args: {
    currentOrgId: null,
    organizations: [],
    userRole: "member",
  },
};

export const OrganizationsButNoneSelected: Story = {
  args: {
    currentOrgId: null,
    organizations: mockOrganizations,
    userRole: "member",
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
  },
};

export const SingleOrganization: Story = {
  args: {
    currentOrgId: "org-1",
    organizations: [mockOrganizations[0]],
    userRole: "owner",
  },
};
