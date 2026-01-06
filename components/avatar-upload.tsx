"use client";

import { useAvatarUpload } from "@/hooks/use-avatar-upload";
import { AvatarUploadView } from "./avatar-upload-view";

export interface AvatarUploadProps {
  type: "user" | "organization";
  fallbackText: string;
  size?: "sm" | "md" | "lg";
}

export function AvatarUpload({ type, fallbackText, size }: AvatarUploadProps) {
  const {
    avatarUrl,
    isLoading,
    isUploading,
    isDeleting,
    error,
    handleUpload,
    handleDelete,
    clearError,
  } = useAvatarUpload({ type });

  return (
    <AvatarUploadView
      avatarUrl={avatarUrl}
      fallbackText={fallbackText}
      isLoading={isLoading}
      isUploading={isUploading}
      isDeleting={isDeleting}
      error={error}
      onUpload={handleUpload}
      onDelete={handleDelete}
      onClearError={clearError}
      size={size}
    />
  );
}
