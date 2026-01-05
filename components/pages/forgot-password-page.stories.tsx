import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { AuthLayout } from "@/components/auth-layout";
import { ForgotPasswordForm } from "@/components/forgot-password-form";

function ForgotPasswordPageStory({
  onSubmit,
  onBackToLogin,
  isLoading,
  error,
  success,
}: {
  onSubmit?: (data: { email: string }) => void;
  onBackToLogin?: () => void;
  isLoading?: boolean;
  error?: string;
  success?: boolean;
}) {
  return (
    <AuthLayout>
      <ForgotPasswordForm
        onSubmit={onSubmit}
        onBackToLogin={onBackToLogin}
        isLoading={isLoading}
        error={error}
        success={success}
      />
    </AuthLayout>
  );
}

const meta = {
  title: "Pages/ForgotPassword",
  component: ForgotPasswordPageStory,
  parameters: {
    layout: "fullscreen",
  },
  args: {
    onSubmit: fn(),
    onBackToLogin: fn(),
  },
} satisfies Meta<typeof ForgotPasswordPageStory>;

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
    error: "Invalid email address.",
  },
};

export const Success: Story = {
  args: {
    success: true,
  },
};
