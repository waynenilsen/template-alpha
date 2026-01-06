import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { OrgPickerView } from "./org-picker-view";

const meta = {
  title: "Components/OrgPickerView",
  component: OrgPickerView,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    onOpenChange: fn(),
    onSelectOrg: fn(),
    onCreateClick: fn(),
  },
} satisfies Meta<typeof OrgPickerView>;

export default meta;
type Story = StoryObj<typeof meta>;

const mockOrganizations = [
  { id: "1", name: "Acme Corp", slug: "acme-corp", role: "owner" },
  { id: "2", name: "Tech Startup", slug: "tech-startup", role: "admin" },
  { id: "3", name: "Design Agency", slug: "design-agency", role: "member" },
];

export const Default: Story = {
  args: {
    organizations: mockOrganizations,
    currentOrgId: "1",
    currentOrgName: "Acme Corp",
    open: false,
    isPending: false,
    canManageOrg: true,
  },
};

export const Open: Story = {
  args: {
    organizations: mockOrganizations,
    currentOrgId: "1",
    currentOrgName: "Acme Corp",
    open: true,
    isPending: false,
    canManageOrg: true,
  },
};

export const SingleOrganization: Story = {
  args: {
    organizations: [mockOrganizations[0]],
    currentOrgId: "1",
    currentOrgName: "Acme Corp",
    open: false,
    isPending: false,
    canManageOrg: true,
  },
};

export const MultipleOrganizations: Story = {
  args: {
    organizations: mockOrganizations,
    currentOrgId: "2",
    currentOrgName: "Tech Startup",
    open: false,
    isPending: false,
    canManageOrg: true,
  },
};

export const ManyOrganizations: Story = {
  args: {
    organizations: [
      ...mockOrganizations,
      {
        id: "4",
        name: "Marketing Agency",
        slug: "marketing-agency",
        role: "member",
      },
      {
        id: "5",
        name: "Consulting Firm",
        slug: "consulting-firm",
        role: "admin",
      },
      {
        id: "6",
        name: "Software Company",
        slug: "software-company",
        role: "owner",
      },
      {
        id: "7",
        name: "E-commerce Store",
        slug: "ecommerce-store",
        role: "member",
      },
      {
        id: "8",
        name: "Creative Studio",
        slug: "creative-studio",
        role: "member",
      },
    ],
    currentOrgId: "1",
    currentOrgName: "Acme Corp",
    open: true,
    isPending: false,
    canManageOrg: true,
  },
};

export const Switching: Story = {
  args: {
    organizations: mockOrganizations,
    currentOrgId: "1",
    currentOrgName: "Acme Corp",
    open: false,
    isPending: true,
    canManageOrg: true,
  },
};

export const NoSelection: Story = {
  args: {
    organizations: mockOrganizations,
    currentOrgId: null,
    currentOrgName: undefined,
    open: false,
    isPending: false,
    canManageOrg: false,
  },
};

export const MemberRole: Story = {
  args: {
    organizations: [
      { id: "1", name: "Acme Corp", slug: "acme-corp", role: "member" },
      { id: "2", name: "Tech Startup", slug: "tech-startup", role: "member" },
    ],
    currentOrgId: "1",
    currentOrgName: "Acme Corp",
    open: true,
    isPending: false,
    canManageOrg: false,
  },
};

export const AdminRole: Story = {
  args: {
    organizations: [
      { id: "1", name: "Acme Corp", slug: "acme-corp", role: "admin" },
      { id: "2", name: "Tech Startup", slug: "tech-startup", role: "member" },
    ],
    currentOrgId: "1",
    currentOrgName: "Acme Corp",
    open: true,
    isPending: false,
    canManageOrg: true,
  },
};

export const OwnerRole: Story = {
  args: {
    organizations: [
      { id: "1", name: "Acme Corp", slug: "acme-corp", role: "owner" },
      { id: "2", name: "Tech Startup", slug: "tech-startup", role: "member" },
    ],
    currentOrgId: "1",
    currentOrgName: "Acme Corp",
    open: true,
    isPending: false,
    canManageOrg: true,
  },
};

export const NoOrganizations: Story = {
  args: {
    organizations: [],
    currentOrgId: null,
    currentOrgName: undefined,
    open: false,
    isPending: false,
    canManageOrg: false,
    createOrgTrigger: <button type="button">Create Organization</button>,
  },
};

export const LongOrganizationNames: Story = {
  args: {
    organizations: [
      {
        id: "1",
        name: "Very Long Organization Name That Should Be Truncated",
        slug: "very-long-org",
        role: "owner",
      },
      {
        id: "2",
        name: "Another Really Long Organization Name Here",
        slug: "another-long-org",
        role: "admin",
      },
      {
        id: "3",
        name: "Short Org",
        slug: "short-org",
        role: "member",
      },
    ],
    currentOrgId: "1",
    currentOrgName: "Very Long Organization Name That Should Be Truncated",
    open: false,
    isPending: false,
    canManageOrg: true,
  },
};
