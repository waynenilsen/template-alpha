/**
 * Image cropping and resizing utilities using Canvas API
 * Used for frontend avatar cropping before upload
 */

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CropResult {
  blob: Blob;
  dataUrl: string;
}

export interface CropOptions {
  /** Target output width in pixels */
  outputWidth?: number;
  /** Target output height in pixels */
  outputHeight?: number;
  /** Output image format */
  format?: "image/jpeg" | "image/png" | "image/webp";
  /** Quality for lossy formats (0-1) */
  quality?: number;
}

const DEFAULT_OPTIONS: Required<CropOptions> = {
  outputWidth: 256,
  outputHeight: 256,
  format: "image/jpeg",
  quality: 0.9,
};

/**
 * Creates an Image element from a source URL or File
 */
export function createImage(source: string | File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";

    image.onload = () => resolve(image);
    image.onerror = (error) =>
      reject(new Error(`Failed to load image: ${error}`));

    if (typeof source === "string") {
      image.src = source;
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        image.src = reader.result as string;
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(source);
    }
  });
}

/**
 * Creates a canvas with the cropped and resized image
 */
export function cropImageToCanvas(
  image: HTMLImageElement,
  cropArea: CropArea,
  options: CropOptions = {},
): HTMLCanvasElement {
  const { outputWidth, outputHeight } = { ...DEFAULT_OPTIONS, ...options };

  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }

  // Enable smooth scaling
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Draw the cropped area scaled to output size
  ctx.drawImage(
    image,
    cropArea.x,
    cropArea.y,
    cropArea.width,
    cropArea.height,
    0,
    0,
    outputWidth,
    outputHeight,
  );

  return canvas;
}

/**
 * Converts a canvas to a Blob
 */
export function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Failed to convert canvas to blob"));
        }
      },
      format,
      quality,
    );
  });
}

/**
 * Crops and resizes an image based on the given crop area
 *
 * @param imageSource - URL or File of the source image
 * @param cropArea - The area to crop (in pixels relative to source)
 * @param options - Output options (size, format, quality)
 * @returns Promise with the cropped image as Blob and data URL
 */
export async function cropImage(
  imageSource: string | File,
  cropArea: CropArea,
  options: CropOptions = {},
): Promise<CropResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Load the image
  const image = await createImage(imageSource);

  // Crop and resize
  const canvas = cropImageToCanvas(image, cropArea, opts);

  // Convert to blob and data URL
  const blob = await canvasToBlob(canvas, opts.format, opts.quality);
  const dataUrl = canvas.toDataURL(opts.format, opts.quality);

  return { blob, dataUrl };
}

/**
 * Converts a crop from percentage to pixel values
 * Used with react-easy-crop which returns percentages
 */
export function percentToPixelCrop(
  percentCrop: CropArea,
  imageWidth: number,
  imageHeight: number,
): CropArea {
  return {
    x: (percentCrop.x / 100) * imageWidth,
    y: (percentCrop.y / 100) * imageHeight,
    width: (percentCrop.width / 100) * imageWidth,
    height: (percentCrop.height / 100) * imageHeight,
  };
}

/**
 * Gets the cropped area in pixels from react-easy-crop's croppedAreaPixels
 * This is the recommended approach - react-easy-crop provides pixel values directly
 */
export function getCroppedAreaPixels(croppedAreaPixels: CropArea): CropArea {
  return {
    x: Math.round(croppedAreaPixels.x),
    y: Math.round(croppedAreaPixels.y),
    width: Math.round(croppedAreaPixels.width),
    height: Math.round(croppedAreaPixels.height),
  };
}

/**
 * Validates that a crop area is within image bounds
 */
export function validateCropArea(
  cropArea: CropArea,
  imageWidth: number,
  imageHeight: number,
): boolean {
  return (
    cropArea.x >= 0 &&
    cropArea.y >= 0 &&
    cropArea.width > 0 &&
    cropArea.height > 0 &&
    cropArea.x + cropArea.width <= imageWidth &&
    cropArea.y + cropArea.height <= imageHeight
  );
}

/**
 * Calculates the maximum square crop area centered in the image
 */
export function getMaxSquareCrop(
  imageWidth: number,
  imageHeight: number,
): CropArea {
  const size = Math.min(imageWidth, imageHeight);
  return {
    x: (imageWidth - size) / 2,
    y: (imageHeight - size) / 2,
    width: size,
    height: size,
  };
}
