"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AuthLayout } from "@/components/auth-layout";
import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { requestPasswordReset } from "@/lib/auth/actions";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState(false);

  const handleSubmit = (data: { email: string }) => {
    setError(undefined);
    startTransition(async () => {
      const result = await requestPasswordReset({ email: data.email });

      if (result.success) {
        setSuccess(true);
      } else {
        setError(result.error);
      }
    });
  };

  const handleBackToLogin = () => {
    router.push("/sign-in");
  };

  return (
    <AuthLayout>
      <ForgotPasswordForm
        onSubmit={handleSubmit}
        onBackToLogin={handleBackToLogin}
        isLoading={isPending}
        error={error}
        success={success}
      />
    </AuthLayout>
  );
}
