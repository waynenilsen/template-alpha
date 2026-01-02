"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, useTransition } from "react";
import { AuthLayout } from "@/components/auth-layout";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { checkResetToken, resetPassword } from "@/lib/auth/actions";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [isTokenValid, setIsTokenValid] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("No reset token provided");
      setIsValidating(false);
      return;
    }

    checkResetToken(token).then((result) => {
      if (!result.valid) {
        setError(result.error ?? "Invalid reset link");
      } else {
        setIsTokenValid(true);
      }
      setIsValidating(false);
    });
  }, [token]);

  const handleSubmit = (data: { password: string }) => {
    if (!token) return;

    setError(undefined);
    startTransition(async () => {
      const result = await resetPassword({ token, password: data.password });

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

  if (isValidating) {
    return (
      <AuthLayout>
        <div
          className="flex items-center justify-center"
          data-testid="reset-password-loading"
        >
          <p className="text-muted-foreground">Validating reset link...</p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <ResetPasswordForm
        onSubmit={isTokenValid ? handleSubmit : undefined}
        onBackToLogin={handleBackToLogin}
        isLoading={isPending}
        error={error}
        success={success}
      />
    </AuthLayout>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <AuthLayout>
          <div className="flex items-center justify-center">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </AuthLayout>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
