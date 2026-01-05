"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface DeleteAccountDialogProps {
  trigger?: React.ReactNode;
  onConfirm?: (password: string) => void;
  isLoading?: boolean;
  error?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function DeleteAccountDialog({
  trigger,
  onConfirm,
  isLoading = false,
  error,
  open,
  onOpenChange,
}: DeleteAccountDialogProps) {
  const [password, setPassword] = useState("");
  const [internalOpen, setInternalOpen] = useState(false);

  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setIsOpen = isControlled ? onOpenChange : setInternalOpen;

  /* c8 ignore start - client-side event handlers, tested via Storybook interactions */
  const handleConfirm = () => {
    if (password) {
      onConfirm?.(password);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setIsOpen?.(newOpen);
    if (!newOpen) {
      setPassword("");
    }
  };
  /* c8 ignore stop */

  return (
    <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
      {trigger && <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Account</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete your
            account and remove all your data from our servers.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-4 py-4">
          {error && (
            <div
              data-testid="delete-error"
              className="rounded-md bg-destructive/15 p-3 text-sm text-destructive"
            >
              {error}
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="delete-password">
              Enter your password to confirm
            </Label>
            <Input
              id="delete-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              placeholder="Your password"
              data-testid="delete-password-input"
            />
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isLoading || !password}
            data-testid="delete-confirm-button"
          >
            {isLoading ? "Deleting..." : "Delete Account"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
