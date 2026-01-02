import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { ForgotPasswordForm } from "./forgot-password-form";

const meta = {
  title: "Components/ForgotPasswordForm",
  component: ForgotPasswordForm,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    onSubmit: fn(),
    onBackToLogin: fn(),
  },
} satisfies Meta<typeof ForgotPasswordForm>;

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
    error: "Email address not found. Please check and try again.",
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
