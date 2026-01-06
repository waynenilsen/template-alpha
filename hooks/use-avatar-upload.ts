"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTRPC } from "@/trpc/client";

export interface UseAvatarUploadReturn {
  avatarUrl: string | null;
  isLoading: boolean;
  isUploading: boolean;
  isDeleting: boolean;
  error: string | null;
  handleUpload: (file: File) => void;
  handleDelete: () => void;
  clearError: () => void;
}

export interface UseAvatarUploadOptions {
  type: "user" | "organization";
}

export function useAvatarUpload({
  type,
}: UseAvatarUploadOptions): UseAvatarUploadReturn {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  // Query for current avatar URL
  const avatarQuery = useQuery(
    type === "user"
      ? trpc.avatar.getUserAvatarUrl.queryOptions()
      : trpc.avatar.getOrgAvatarUrl.queryOptions(),
  );

  // Upload mutation
  const uploadMutation = useMutation(
    type === "user"
      ? trpc.avatar.uploadUserAvatar.mutationOptions({
          onSuccess: () => {
            setError(null);
            queryClient.invalidateQueries({
              queryKey: trpc.avatar.getUserAvatarUrl.queryKey(),
            });
          },
          onError: (err) => {
            setError(err.message);
          },
        })
      : trpc.avatar.uploadOrgAvatar.mutationOptions({
          onSuccess: () => {
            setError(null);
            queryClient.invalidateQueries({
              queryKey: trpc.avatar.getOrgAvatarUrl.queryKey(),
            });
          },
          onError: (err) => {
            setError(err.message);
          },
        }),
  );

  // Delete mutation
  const deleteMutation = useMutation(
    type === "user"
      ? trpc.avatar.deleteUserAvatar.mutationOptions({
          onSuccess: () => {
            setError(null);
            queryClient.invalidateQueries({
              queryKey: trpc.avatar.getUserAvatarUrl.queryKey(),
            });
          },
          onError: (err) => {
            setError(err.message);
          },
        })
      : trpc.avatar.deleteOrgAvatar.mutationOptions({
          onSuccess: () => {
            setError(null);
            queryClient.invalidateQueries({
              queryKey: trpc.avatar.getOrgAvatarUrl.queryKey(),
            });
          },
          onError: (err) => {
            setError(err.message);
          },
        }),
  );

  const handleUpload = async (file: File) => {
    setError(null);

    // Validate file type - must match SUPPORTED_AVATAR_TYPES from lib/storage/s3.ts
    const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setError(
        "Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.",
      );
      return;
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setError("File is too large. Maximum size is 5MB.");
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/png;base64,")
      const base64Data = result.split(",")[1];
      uploadMutation.mutate({
        data: base64Data,
        contentType: file.type as
          | "image/jpeg"
          | "image/png"
          | "image/gif"
          | "image/webp",
      });
    };
    reader.onerror = () => {
      setError("Failed to read file");
    };
    reader.readAsDataURL(file);
  };

  const handleDelete = () => {
    deleteMutation.mutate();
  };

  const clearError = () => {
    setError(null);
  };

  return {
    avatarUrl: avatarQuery.data?.avatarUrl ?? null,
    isLoading: avatarQuery.isLoading,
    isUploading: uploadMutation.isPending,
    isDeleting: deleteMutation.isPending,
    error,
    handleUpload,
    handleDelete,
    clearError,
  };
}
