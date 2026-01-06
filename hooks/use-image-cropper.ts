"use client";

import { useEffect, useState } from "react";
import type { Area } from "react-easy-crop";
import { type CropArea, cropImage } from "@/lib/image";

export interface UseImageCropperOptions {
  /** The file to crop */
  file: File | null;
  /** Target output width in pixels (default: 256) */
  outputWidth?: number;
  /** Target output height in pixels (default: 256) */
  outputHeight?: number;
  /** Output image format (default: "image/jpeg") */
  format?: "image/jpeg" | "image/png" | "image/webp";
  /** Quality for lossy formats (default: 0.9) */
  quality?: number;
}

export interface UseImageCropperReturn {
  /** The loaded image data URL */
  imageSrc: string | null;
  /** Current crop position */
  crop: { x: number; y: number };
  /** Current zoom level (1-3) */
  zoom: number;
  /** Whether the crop is being processed */
  isProcessing: boolean;
  /** Error message if any */
  error: string | null;
  /** Update crop position */
  setCrop: (crop: { x: number; y: number }) => void;
  /** Update zoom level */
  setZoom: (zoom: number) => void;
  /** Callback for when crop area changes (from react-easy-crop) */
  onCropComplete: (croppedArea: Area, croppedAreaPixels: Area) => void;
  /** Process the crop and return the result */
  processCrop: () => Promise<{ blob: Blob; dataUrl: string } | null>;
  /** Reset all state */
  reset: () => void;
}

const DEFAULT_CROP = { x: 0, y: 0 };
const DEFAULT_ZOOM = 1;

/**
 * Hook for managing image cropping state
 *
 * Handles loading the image file, tracking crop/zoom state,
 * and processing the final crop using canvas.
 */
export function useImageCropper(
  options: UseImageCropperOptions,
): UseImageCropperReturn {
  const {
    file,
    outputWidth = 256,
    outputHeight = 256,
    format = "image/jpeg",
    quality = 0.9,
  } = options;

  // State
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState(DEFAULT_CROP);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(
    null,
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load file as data URL when file changes
  useEffect(() => {
    if (!file) {
      setImageSrc(null);
      setError(null);
      return;
    }

    // Reset state when new file is loaded
    setCrop(DEFAULT_CROP);
    setZoom(DEFAULT_ZOOM);
    setCroppedAreaPixels(null);
    setError(null);

    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        setImageSrc(result);
      } else {
        setError("Failed to read file as data URL");
      }
    };

    reader.onerror = () => {
      setError("Failed to read file");
      setImageSrc(null);
    };

    reader.readAsDataURL(file);

    // Cleanup
    return () => {
      reader.abort();
    };
  }, [file]);

  // Handle crop complete callback from react-easy-crop
  const onCropComplete = (_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  // Process the crop and return blob + data URL
  const processCrop = async (): Promise<{
    blob: Blob;
    dataUrl: string;
  } | null> => {
    if (!imageSrc || !croppedAreaPixels) {
      setError("No image or crop area available");
      return null;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const result = await cropImage(imageSrc, croppedAreaPixels, {
        outputWidth,
        outputHeight,
        format,
        quality,
      });

      setIsProcessing(false);
      return result;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to crop image";
      setError(errorMessage);
      setIsProcessing(false);
      return null;
    }
  };

  // Reset all state
  const reset = () => {
    setImageSrc(null);
    setCrop(DEFAULT_CROP);
    setZoom(DEFAULT_ZOOM);
    setCroppedAreaPixels(null);
    setIsProcessing(false);
    setError(null);
  };

  return {
    imageSrc,
    crop,
    zoom,
    isProcessing,
    error,
    setCrop,
    setZoom,
    onCropComplete,
    processCrop,
    reset,
  };
}
