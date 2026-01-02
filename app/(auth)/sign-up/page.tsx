"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AuthLayout } from "@/components/auth-layout";
import { SignUpForm } from "@/components/sign-up-form";
import { SocialAuthButtons } from "@/components/social-auth-buttons";
import { Separator } from "@/components/ui/separator";
import { signUp } from "@/lib/auth/actions";

export default function SignUpPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();

  const handleSignUp = (data: {
    name: string;
    email: string;
    password: string;
  }) => {
    setError(undefined);
    startTransition(async () => {
      const result = await signUp({
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

  const handleGoogleSignUp = () => {
    // TODO: Implement Google OAuth
    console.log("Google sign up clicked");
  };

  const handleGitHubSignUp = () => {
    // TODO: Implement GitHub OAuth
    console.log("GitHub sign up clicked");
  };

  const handleSignIn = () => {
    router.push("/sign-in");
  };

  return (
    <AuthLayout>
      <div className="w-full max-w-sm space-y-4">
        <SocialAuthButtons
          mode="signup"
          onGoogleClick={handleGoogleSignUp}
          onGitHubClick={handleGitHubSignUp}
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
          onSubmit={handleSignUp}
          onSignIn={handleSignIn}
          isLoading={isPending}
          error={error}
        />
      </div>
    </AuthLayout>
  );
}
