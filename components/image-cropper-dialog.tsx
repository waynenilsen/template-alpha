"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useImageCropper } from "@/hooks/use-image-cropper";
import { ImageCropperView } from "./image-cropper-view";

export interface ImageCropperDialogProps {
  /** The file to crop (null closes the dialog) */
  file: File | null;
  /** Whether the dialog is open */
  open: boolean;
  /** Called when the dialog should close */
  onOpenChange: (open: boolean) => void;
  /** Called with the cropped file when user clicks Apply */
  onCropComplete: (croppedFile: File) => void;
  /** Dialog title */
  title?: string;
  /** Dialog description */
  description?: string;
  /** Output width in pixels */
  outputWidth?: number;
  /** Output height in pixels */
  outputHeight?: number;
  /** Output format */
  format?: "image/jpeg" | "image/png" | "image/webp";
  /** Crop shape */
  cropShape?: "rect" | "round";
}

const FORMAT_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function ImageCropperDialog({
  file,
  open,
  onOpenChange,
  onCropComplete,
  title = "Crop Image",
  description = "Drag to reposition and use the slider to zoom",
  outputWidth = 256,
  outputHeight = 256,
  format = "image/jpeg",
  cropShape = "round",
}: ImageCropperDialogProps) {
  const cropper = useImageCropper({
    file,
    outputWidth,
    outputHeight,
    format,
  });

  const handleApply = async () => {
    const result = await cropper.processCrop();
    if (result) {
      // Convert blob to File
      const extension = FORMAT_EXTENSIONS[format] || "jpg";
      const fileName = `cropped-avatar.${extension}`;
      const croppedFile = new File([result.blob], fileName, { type: format });
      onCropComplete(croppedFile);
      onOpenChange(false);
      cropper.reset();
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    cropper.reset();
  };

  // Handle dialog close (escape, click outside, etc.)
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      cropper.reset();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="image-cropper-dialog">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {cropper.imageSrc && (
          <ImageCropperView
            imageSrc={cropper.imageSrc}
            crop={cropper.crop}
            zoom={cropper.zoom}
            cropShape={cropShape}
            onCropChange={cropper.setCrop}
            onZoomChange={cropper.setZoom}
            onCropComplete={cropper.onCropComplete}
            onApply={handleApply}
            onCancel={handleCancel}
            isProcessing={cropper.isProcessing}
          />
        )}

        {cropper.error && (
          <div
            className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            data-testid="cropper-error"
          >
            {cropper.error}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
