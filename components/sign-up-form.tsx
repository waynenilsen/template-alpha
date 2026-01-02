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

export interface SignUpFormProps {
  onSubmit?: (data: { name: string; email: string; password: string }) => void;
  onSignIn?: () => void;
  isLoading?: boolean;
  error?: string;
}

export function SignUpForm({
  onSubmit,
  onSignIn,
  isLoading = false,
  error,
}: SignUpFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
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
    onSubmit?.({ name, email, password });
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-2xl">Sign Up</CardTitle>
        <CardDescription>Create your account to get started</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="grid gap-4">
          {error && (
            <div
              className="rounded-md bg-destructive/15 p-3 text-sm text-destructive"
              data-testid="signup-error"
            >
              {error}
            </div>
          )}
          {passwordMismatch && (
            <div
              className="rounded-md bg-destructive/15 p-3 text-sm text-destructive"
              data-testid="password-mismatch-error"
            >
              Passwords do not match
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              type="text"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isLoading}
              data-testid="signup-name-input"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="m@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              data-testid="signup-email-input"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              data-testid="signup-password-input"
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
              data-testid="signup-confirm-password-input"
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
            data-testid="signup-submit-button"
          >
            {isLoading ? "Creating account..." : "Sign up"}
          </Button>
          {onSignIn && (
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <button
                type="button"
                onClick={onSignIn}
                className="underline underline-offset-4 hover:text-primary"
                data-testid="signin-link"
              >
                Sign in
              </button>
            </p>
          )}
        </CardFooter>
      </form>
    </Card>
  );
}
