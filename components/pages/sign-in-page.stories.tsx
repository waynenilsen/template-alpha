import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { AuthLayout } from "@/components/auth-layout";
import { LoginForm } from "@/components/login-form";
import { SocialAuthButtons } from "@/components/social-auth-buttons";
import { Separator } from "@/components/ui/separator";

function SignInPageStory({
  onSubmit,
  onGoogleClick,
  onGitHubClick,
  onSignUp,
  onForgotPassword,
  isLoading,
  error,
}: {
  onSubmit?: (data: { email: string; password: string }) => void;
  onGoogleClick?: () => void;
  onGitHubClick?: () => void;
  onSignUp?: () => void;
  onForgotPassword?: () => void;
  isLoading?: boolean;
  error?: string;
}) {
  return (
    <AuthLayout>
      <div className="w-full max-w-sm space-y-6">
        <SocialAuthButtons
          onGoogleClick={onGoogleClick}
          onGitHubClick={onGitHubClick}
          mode="signin"
        />

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <Separator />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">or</span>
          </div>
        </div>

        <LoginForm
          onSubmit={onSubmit}
          onSignUp={onSignUp}
          onForgotPassword={onForgotPassword}
          isLoading={isLoading}
          error={error}
        />
      </div>
    </AuthLayout>
  );
}

const meta = {
  title: "Pages/SignIn",
  component: SignInPageStory,
  parameters: {
    layout: "fullscreen",
  },
  args: {
    onSubmit: fn(),
    onGoogleClick: fn(),
    onGitHubClick: fn(),
    onSignUp: fn(),
    onForgotPassword: fn(),
  },
} satisfies Meta<typeof SignInPageStory>;

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
    error: "Invalid email or password. Please try again.",
  },
};
