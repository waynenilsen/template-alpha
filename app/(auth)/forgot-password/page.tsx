"use client";

import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/auth-layout";
import { ForgotPasswordForm } from "@/components/forgot-password-form";

export default function ForgotPasswordPage() {
  const router = useRouter();

  const handleSubmit = (data: { email: string }) => {
    console.log("Password reset requested for:", data.email);
  };

  const handleBackToLogin = () => {
    router.push("/sign-in");
  };

  return (
    <AuthLayout>
      <ForgotPasswordForm
        onSubmit={handleSubmit}
        onBackToLogin={handleBackToLogin}
      />
    </AuthLayout>
  );
}
