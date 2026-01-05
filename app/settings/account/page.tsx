"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChangePasswordForm } from "@/components/change-password-form";
import { DeleteAccountDialog } from "@/components/delete-account-dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { UserSettingsForm } from "@/components/user-settings-form";
import { useTRPC } from "@/trpc/client";

export default function AccountSettingsPage() {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Profile states
  const [profileError, setProfileError] = useState<string | undefined>();
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Password states
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Delete states
  const [deleteError, setDeleteError] = useState<string | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Fetch profile
  const profileQuery = useQuery(trpc.user.getProfile.queryOptions());

  // Update profile mutation
  const updateProfileMutation = useMutation(
    trpc.user.updateProfile.mutationOptions({
      onSuccess: () => {
        setProfileError(undefined);
        setProfileSuccess(true);
        queryClient.invalidateQueries({
          queryKey: trpc.user.getProfile.queryKey(),
        });
        setTimeout(() => setProfileSuccess(false), 3000);
      },
      onError: (error) => {
        setProfileError(error.message);
        setProfileSuccess(false);
      },
    }),
  );

  // Change password mutation
  const changePasswordMutation = useMutation(
    trpc.user.changePassword.mutationOptions({
      onSuccess: () => {
        setPasswordError(undefined);
        setPasswordSuccess(true);
        setTimeout(() => setPasswordSuccess(false), 3000);
      },
      onError: (error) => {
        setPasswordError(error.message);
        setPasswordSuccess(false);
      },
    }),
  );

  // Delete account mutation
  const deleteAccountMutation = useMutation(
    trpc.user.deleteAccount.mutationOptions({
      onSuccess: () => {
        setDeleteDialogOpen(false);
        router.push("/sign-in");
        router.refresh();
      },
      onError: (error) => {
        setDeleteError(error.message);
      },
    }),
  );

  const handleProfileSubmit = (data: { name: string }) => {
    updateProfileMutation.mutate(data);
  };

  const handlePasswordSubmit = (data: {
    currentPassword: string;
    newPassword: string;
  }) => {
    changePasswordMutation.mutate(data);
  };

  const handleDeleteConfirm = (password: string) => {
    deleteAccountMutation.mutate({ password });
  };

  if (profileQuery.isLoading) {
    return (
      <div className="container max-w-2xl py-8">
        <div className="space-y-6">
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
          <div className="h-64 animate-pulse rounded-lg bg-muted" />
        </div>
      </div>
    );
  }

  if (profileQuery.isError) {
    return (
      <div className="container max-w-2xl py-8">
        <div className="rounded-md bg-destructive/15 p-4 text-sm text-destructive">
          Failed to load profile: {profileQuery.error.message}
        </div>
      </div>
    );
  }

  const profile = profileQuery.data;

  return (
    <div className="container max-w-2xl py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Account Settings</h1>
          <p className="text-muted-foreground">
            Manage your account settings and preferences
          </p>
        </div>

        <UserSettingsForm
          initialName={profile?.name ?? ""}
          email={profile?.email ?? ""}
          onSubmit={handleProfileSubmit}
          isLoading={updateProfileMutation.isPending}
          error={profileError}
          success={profileSuccess}
        />

        <Separator />

        <ChangePasswordForm
          onSubmit={handlePasswordSubmit}
          isLoading={changePasswordMutation.isPending}
          error={passwordError}
          success={passwordSuccess}
        />

        <Separator />

        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-destructive">
              Danger Zone
            </h2>
            <p className="text-sm text-muted-foreground">
              Irreversible and destructive actions
            </p>
          </div>
          <DeleteAccountDialog
            trigger={
              <Button variant="destructive" data-testid="delete-account-button">
                Delete Account
              </Button>
            }
            onConfirm={handleDeleteConfirm}
            isLoading={deleteAccountMutation.isPending}
            error={deleteError}
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
          />
        </div>
      </div>
    </div>
  );
}
