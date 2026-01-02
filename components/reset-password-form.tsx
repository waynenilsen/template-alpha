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

export interface ResetPasswordFormProps {
  onSubmit?: (data: { password: string }) => void;
  onBackToLogin?: () => void;
  isLoading?: boolean;
  error?: string;
  success?: boolean;
}

export function ResetPasswordForm({
  onSubmit,
  onBackToLogin,
  isLoading = false,
  error,
  success = false,
}: ResetPasswordFormProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMismatch, setPasswordMismatch] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setPasswordMismatch(true);
      return;
    }

    setPasswordMismatch(false);
    onSubmit?.({ password });
  };

  if (success) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Password Reset</CardTitle>
          <CardDescription>Your password has been updated</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            data-testid="reset-password-success"
            className="rounded-md bg-green-500/15 p-3 text-sm text-green-700 dark:text-green-400"
          >
            Your password has been successfully reset. You can now sign in with
            your new password.
          </div>
        </CardContent>
        <CardFooter>
          {onBackToLogin && (
            <Button
              type="button"
              className="w-full"
              onClick={onBackToLogin}
              data-testid="reset-password-signin-button"
            >
              Sign in
            </Button>
          )}
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-2xl">Reset Password</CardTitle>
        <CardDescription>Enter your new password below</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="grid gap-4">
          {error && (
            <div
              data-testid="reset-password-error"
              className="rounded-md bg-destructive/15 p-3 text-sm text-destructive"
            >
              {error}
            </div>
          )}
          {passwordMismatch && (
            <div
              data-testid="reset-password-mismatch-error"
              className="rounded-md bg-destructive/15 p-3 text-sm text-destructive"
            >
              Passwords do not match
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="password">New Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              data-testid="reset-password-input"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setPasswordMismatch(false);
              }}
              required
              disabled={isLoading}
              data-testid="reset-password-confirm-input"
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
            data-testid="reset-password-submit-button"
          >
            {isLoading ? "Resetting..." : "Reset password"}
          </Button>
          {onBackToLogin && (
            <p className="text-center text-sm text-muted-foreground">
              Remember your password?{" "}
              <button
                type="button"
                onClick={onBackToLogin}
                className="underline underline-offset-4 hover:text-primary"
                data-testid="reset-password-login-link"
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
