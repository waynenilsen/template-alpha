"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AuthLayout } from "@/components/auth-layout";
import { LoginForm } from "@/components/login-form";
import { SocialAuthButtons } from "@/components/social-auth-buttons";
import { Separator } from "@/components/ui/separator";
import { signIn } from "@/lib/auth/actions";

export default function SignInPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();

  const handleSubmit = (data: { email: string; password: string }) => {
    setError(undefined);
    startTransition(async () => {
      const result = await signIn({
        email: data.email,
        password: data.password,
      });

      if (result.success) {
        router.push(result.redirectTo);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  const handleGoogleClick = () => {
    // TODO: Implement Google OAuth
    console.log("Google sign in clicked");
  };

  const handleGitHubClick = () => {
    // TODO: Implement GitHub OAuth
    console.log("GitHub sign in clicked");
  };

  const handleSignUp = () => {
    router.push("/sign-up");
  };

  const handleForgotPassword = () => {
    router.push("/forgot-password");
  };

  return (
    <AuthLayout>
      <div className="w-full max-w-sm space-y-6">
        <SocialAuthButtons
          onGoogleClick={handleGoogleClick}
          onGitHubClick={handleGitHubClick}
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
          onSubmit={handleSubmit}
          onSignUp={handleSignUp}
          onForgotPassword={handleForgotPassword}
          isLoading={isPending}
          error={error}
        />
      </div>
    </AuthLayout>
  );
}
