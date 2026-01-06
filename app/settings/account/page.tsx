"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, KeyRound, Trash2, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AvatarUpload } from "@/components/avatar-upload";
import { ChangePasswordForm } from "@/components/change-password-form";
import { DeleteAccountDialog } from "@/components/delete-account-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <Skeleton className="mb-2 h-9 w-48" />
        <Skeleton className="mb-8 h-5 w-64" />
        <div className="space-y-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (profileQuery.isError) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <Card>
          <CardContent className="py-12">
            <div className="rounded-md bg-destructive/15 p-4 text-sm text-destructive">
              Failed to load profile: {profileQuery.error.message}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const profile = profileQuery.data;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Account Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and preferences
        </p>
      </div>

      <div className="space-y-6">
        {/* Avatar Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Avatar
            </CardTitle>
            <CardDescription>Customize your profile picture</CardDescription>
          </CardHeader>
          <CardContent>
            <AvatarUpload
              type="user"
              fallbackText={profile?.name ?? profile?.email ?? "User"}
            />
          </CardContent>
        </Card>

        {/* Profile Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile
            </CardTitle>
            <CardDescription>Update your personal information</CardDescription>
          </CardHeader>
          <CardContent>
            <UserSettingsForm
              initialName={profile?.name ?? ""}
              email={profile?.email ?? ""}
              onSubmit={handleProfileSubmit}
              isLoading={updateProfileMutation.isPending}
              error={profileError}
              success={profileSuccess}
            />
          </CardContent>
        </Card>

        {/* Password Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Password
            </CardTitle>
            <CardDescription>Change your account password</CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm
              onSubmit={handlePasswordSubmit}
              isLoading={changePasswordMutation.isPending}
              error={passwordError}
              success={passwordSuccess}
            />
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>
              Irreversible and destructive actions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Delete Account</p>
                <p className="text-sm text-muted-foreground">
                  Permanently delete your account and all associated data
                </p>
              </div>
              <DeleteAccountDialog
                trigger={
                  <Button
                    variant="destructive"
                    data-testid="delete-account-button"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                }
                onConfirm={handleDeleteConfirm}
                isLoading={deleteAccountMutation.isPending}
                error={deleteError}
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
