"use client";

import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/auth-layout";
import { LoginForm } from "@/components/login-form";
import { SocialAuthButtons } from "@/components/social-auth-buttons";
import { Separator } from "@/components/ui/separator";

export default function SignInPage() {
  const router = useRouter();

  const handleSubmit = (data: { email: string; password: string }) => {
    console.log("Sign in submitted:", data);
  };

  const handleGoogleClick = () => {
    console.log("Google sign in clicked");
  };

  const handleGitHubClick = () => {
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
        />
      </div>
    </AuthLayout>
  );
}
