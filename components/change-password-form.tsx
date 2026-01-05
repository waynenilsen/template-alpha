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

export interface ChangePasswordFormProps {
  onSubmit?: (data: { currentPassword: string; newPassword: string }) => void;
  isLoading?: boolean;
  error?: string;
  success?: boolean;
}

export function ChangePasswordForm({
  onSubmit,
  isLoading = false,
  error,
  success = false,
}: ChangePasswordFormProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  /* c8 ignore start - client-side event handler, tested via Storybook interactions */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (newPassword !== confirmPassword) {
      setValidationError("Passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      setValidationError("Password must be at least 8 characters");
      return;
    }

    if (!/[A-Z]/.test(newPassword)) {
      setValidationError("Password must contain at least one uppercase letter");
      return;
    }

    if (!/[a-z]/.test(newPassword)) {
      setValidationError("Password must contain at least one lowercase letter");
      return;
    }

    if (!/[0-9]/.test(newPassword)) {
      setValidationError("Password must contain at least one number");
      return;
    }

    onSubmit?.({ currentPassword, newPassword });
  };
  /* c8 ignore stop */

  const displayError = validationError || error;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change Password</CardTitle>
        <CardDescription>
          Update your password to keep your account secure
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="grid gap-4">
          {displayError && (
            <div
              data-testid="password-error"
              className="rounded-md bg-destructive/15 p-3 text-sm text-destructive"
            >
              {displayError}
            </div>
          )}
          {success && (
            <div
              data-testid="password-success"
              className="rounded-md bg-green-500/15 p-3 text-sm text-green-700 dark:text-green-400"
            >
              Password changed successfully
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="current-password">Current Password</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={isLoading}
              required
              data-testid="password-current-input"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={isLoading}
              required
              data-testid="password-new-input"
            />
            <p className="text-sm text-muted-foreground">
              Must be at least 8 characters with uppercase, lowercase, and a
              number
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isLoading}
              required
              data-testid="password-confirm-input"
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button
            type="submit"
            disabled={isLoading}
            data-testid="password-submit-button"
          >
            {isLoading ? "Changing..." : "Change Password"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
