import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { CreateOrganizationDialogView } from "./create-organization-dialog-view";

const meta = {
  title: "Components/CreateOrganizationDialogView",
  component: CreateOrganizationDialogView,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    onOpenChange: fn(),
    onNameChange: fn(),
    onSubmit: fn(),
    onCancel: fn(),
  },
} satisfies Meta<typeof CreateOrganizationDialogView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {
  args: {
    open: false,
    name: "",
    error: null,
    isLoading: false,
    trigger: <button type="button">Create Organization</button>,
  },
};

export const Open: Story = {
  args: {
    open: true,
    name: "",
    error: null,
    isLoading: false,
  },
};

export const WithName: Story = {
  args: {
    open: true,
    name: "My New Organization",
    error: null,
    isLoading: false,
  },
};

export const Loading: Story = {
  args: {
    open: true,
    name: "My New Organization",
    error: null,
    isLoading: true,
  },
};

export const WithError: Story = {
  args: {
    open: true,
    name: "",
    error: "Organization name is required",
    isLoading: false,
  },
};

export const WithErrorAndName: Story = {
  args: {
    open: true,
    name: "Existing Org",
    error: "An organization with this name already exists",
    isLoading: false,
  },
};

export const WithTrigger: Story = {
  args: {
    open: false,
    name: "",
    error: null,
    isLoading: false,
    trigger: (
      <button
        type="button"
        className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
      >
        Create New Organization
      </button>
    ),
  },
};

export const LongError: Story = {
  args: {
    open: true,
    name: "Test Organization",
    error:
      "Unable to create organization. This organization name is already in use by another account. Please choose a different name.",
    isLoading: false,
  },
};
