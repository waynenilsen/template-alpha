"use client";

import { useState } from "react";
import { useAvatarUpload } from "@/hooks/use-avatar-upload";
import { AvatarUploadView } from "./avatar-upload-view";
import { ImageCropperDialog } from "./image-cropper-dialog";

export interface AvatarUploadProps {
  type: "user" | "organization";
  fallbackText: string;
  size?: "sm" | "md" | "lg";
  /** Disable cropping and upload directly */
  disableCrop?: boolean;
  /** Output size for cropped avatar (default 256) */
  cropOutputSize?: number;
}

export function AvatarUpload({
  type,
  fallbackText,
  size,
  disableCrop = false,
  cropOutputSize = 256,
}: AvatarUploadProps) {
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [cropperOpen, setCropperOpen] = useState(false);

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

  // Intercept file selection to open cropper
  const handleFileSelect = (file: File) => {
    if (disableCrop) {
      handleUpload(file);
    } else {
      setPendingFile(file);
      setCropperOpen(true);
    }
  };

  // Handle cropped file from dialog
  const handleCropComplete = (croppedFile: File) => {
    handleUpload(croppedFile);
    setPendingFile(null);
  };

  // Handle dialog close
  const handleCropperOpenChange = (open: boolean) => {
    setCropperOpen(open);
    if (!open) {
      setPendingFile(null);
    }
  };

  return (
    <>
      <AvatarUploadView
        avatarUrl={avatarUrl}
        fallbackText={fallbackText}
        isLoading={isLoading}
        isUploading={isUploading}
        isDeleting={isDeleting}
        error={error}
        onUpload={handleFileSelect}
        onDelete={handleDelete}
        onClearError={clearError}
        size={size}
      />

      <ImageCropperDialog
        file={pendingFile}
        open={cropperOpen}
        onOpenChange={handleCropperOpenChange}
        onCropComplete={handleCropComplete}
        title="Crop Avatar"
        description="Drag to reposition. Use the slider to zoom in or out."
        outputWidth={cropOutputSize}
        outputHeight={cropOutputSize}
        cropShape="round"
      />
    </>
  );
}
