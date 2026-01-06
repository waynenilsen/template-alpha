import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { AvatarUploadView } from "./avatar-upload-view";

const meta = {
  title: "Components/AvatarUploadView",
  component: AvatarUploadView,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    onUpload: fn(),
    onDelete: fn(),
    onClearError: fn(),
    fallbackText: "John Doe",
    size: "lg",
  },
} satisfies Meta<typeof AvatarUploadView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    avatarUrl: null,
    isLoading: false,
    isUploading: false,
    isDeleting: false,
    error: null,
  },
};

export const WithAvatar: Story = {
  args: {
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=John",
    isLoading: false,
    isUploading: false,
    isDeleting: false,
    error: null,
  },
};

export const Loading: Story = {
  args: {
    avatarUrl: null,
    isLoading: true,
    isUploading: false,
    isDeleting: false,
    error: null,
  },
};

export const Uploading: Story = {
  args: {
    avatarUrl: null,
    isLoading: false,
    isUploading: true,
    isDeleting: false,
    error: null,
  },
};

export const Deleting: Story = {
  args: {
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=John",
    isLoading: false,
    isUploading: false,
    isDeleting: true,
    error: null,
  },
};

export const WithError: Story = {
  args: {
    avatarUrl: null,
    isLoading: false,
    isUploading: false,
    isDeleting: false,
    error: "File is too large. Maximum size is 5MB.",
  },
};

export const SmallSize: Story = {
  args: {
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=John",
    isLoading: false,
    isUploading: false,
    isDeleting: false,
    error: null,
    size: "sm",
  },
};

export const MediumSize: Story = {
  args: {
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=John",
    isLoading: false,
    isUploading: false,
    isDeleting: false,
    error: null,
    size: "md",
  },
};

export const OrganizationFallback: Story = {
  args: {
    avatarUrl: null,
    fallbackText: "Acme Corp",
    isLoading: false,
    isUploading: false,
    isDeleting: false,
    error: null,
  },
};
