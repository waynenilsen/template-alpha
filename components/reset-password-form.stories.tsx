import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { ResetPasswordForm } from "./reset-password-form";

const meta = {
  title: "Components/ResetPasswordForm",
  component: ResetPasswordForm,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    onSubmit: fn(),
    onBackToLogin: fn(),
  },
} satisfies Meta<typeof ResetPasswordForm>;

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
    error:
      "Invalid or expired reset token. Please request a new password reset link.",
  },
};

export const Success: Story = {
  args: {
    success: true,
  },
};

export const WithoutBackToLogin: Story = {
  args: {
    onBackToLogin: undefined,
  },
};
