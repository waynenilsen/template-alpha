import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { AuthLayout } from "@/components/auth-layout";
import { SignUpForm } from "@/components/sign-up-form";
import { SocialAuthButtons } from "@/components/social-auth-buttons";
import { Separator } from "@/components/ui/separator";

function SignUpPageStory({
  onSubmit,
  onGoogleClick,
  onGitHubClick,
  onSignIn,
  isLoading,
  error,
}: {
  onSubmit?: (data: { name: string; email: string; password: string }) => void;
  onGoogleClick?: () => void;
  onGitHubClick?: () => void;
  onSignIn?: () => void;
  isLoading?: boolean;
  error?: string;
}) {
  return (
    <AuthLayout>
      <div className="w-full max-w-sm space-y-4">
        <SocialAuthButtons
          mode="signup"
          onGoogleClick={onGoogleClick}
          onGitHubClick={onGitHubClick}
        />

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <Separator />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-zinc-50 dark:bg-zinc-950 px-2 text-muted-foreground">
              or
            </span>
          </div>
        </div>

        <SignUpForm
          onSubmit={onSubmit}
          onSignIn={onSignIn}
          isLoading={isLoading}
          error={error}
        />
      </div>
    </AuthLayout>
  );
}

const meta = {
  title: "Pages/SignUp",
  component: SignUpPageStory,
  parameters: {
    layout: "fullscreen",
  },
  args: {
    onSubmit: fn(),
    onGoogleClick: fn(),
    onGitHubClick: fn(),
    onSignIn: fn(),
  },
} satisfies Meta<typeof SignUpPageStory>;

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
    error: "An account with this email already exists.",
  },
};
