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

export interface UserSettingsFormProps {
  initialName?: string;
  email?: string;
  onSubmit?: (data: { name: string }) => void;
  isLoading?: boolean;
  error?: string;
  success?: boolean;
}

export function UserSettingsForm({
  initialName = "",
  email = "",
  onSubmit,
  isLoading = false,
  error,
  success = false,
}: UserSettingsFormProps) {
  const [name, setName] = useState(initialName);

  /* c8 ignore start - client-side event handler, tested via Storybook interactions */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit?.({ name });
  };
  /* c8 ignore stop */

  const hasChanges = name !== initialName;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Settings</CardTitle>
        <CardDescription>
          Update your personal information and preferences
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="grid gap-4">
          {error && (
            <div
              data-testid="settings-error"
              className="rounded-md bg-destructive/15 p-3 text-sm text-destructive"
            >
              {error}
            </div>
          )}
          {success && (
            <div
              data-testid="settings-success"
              className="rounded-md bg-green-500/15 p-3 text-sm text-green-700 dark:text-green-400"
            >
              Profile updated successfully
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              disabled
              data-testid="settings-email-input"
            />
            <p className="text-sm text-muted-foreground">
              Email cannot be changed
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
              data-testid="settings-name-input"
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button
            type="submit"
            disabled={isLoading || !hasChanges}
            data-testid="settings-submit-button"
          >
            {isLoading ? "Saving..." : "Save Changes"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
