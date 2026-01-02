"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface ForgotPasswordFormProps {
  onSubmit?: (data: { email: string }) => void;
  onBackToLogin?: () => void;
  isLoading?: boolean;
  error?: string;
  success?: boolean;
}

export function ForgotPasswordForm({
  onSubmit,
  onBackToLogin,
  isLoading = false,
  error,
  success = false,
}: ForgotPasswordFormProps) {
  const [email, setEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit?.({ email });
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-2xl">Reset Password</CardTitle>
        <CardDescription>
          Enter your email to receive a password reset link
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="grid gap-4">
          {error && (
            <div
              data-testid="forgot-password-error"
              className="rounded-md bg-destructive/15 p-3 text-sm text-destructive"
            >
              {error}
            </div>
          )}
          {success && (
            <div
              data-testid="forgot-password-success"
              className="rounded-md bg-green-500/15 p-3 text-sm text-green-700 dark:text-green-400"
            >
              Password reset link has been sent to your email
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="m@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading || success}
              data-testid="forgot-password-email-input"
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || success}
            data-testid="forgot-password-submit-button"
          >
            {isLoading ? "Sending..." : "Send reset link"}
          </Button>
          {onBackToLogin && (
            <p className="text-center text-sm text-muted-foreground">
              Remember your password?{" "}
              <button
                type="button"
                onClick={onBackToLogin}
                className="underline underline-offset-4 hover:text-primary"
              >
                Back to login
              </button>
            </p>
          )}
        </CardFooter>
      </form>
    </Card>
  );
}
