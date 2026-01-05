import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { ChangePasswordForm } from "./change-password-form";

const meta = {
  title: "Components/ChangePasswordForm",
  component: ChangePasswordForm,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    onSubmit: fn(),
  },
} satisfies Meta<typeof ChangePasswordForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Loading: Story = {
  args: {
    isLoading: true,
  },
};

export const WithError: Story = {
  args: {
    error: "Current password is incorrect",
  },
};

export const WithSuccess: Story = {
  args: {
    success: true,
  },
};

export const WithServerError: Story = {
  args: {
    error: "Failed to change password. Please try again later.",
  },
};
