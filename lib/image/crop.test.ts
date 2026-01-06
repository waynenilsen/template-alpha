import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { CropArea } from "./crop";

// Mock globals before importing the module
let mockImageInstance: any;
let mockFileReaderInstance: any;
let mockCanvas: any;
let mockContext: any;

beforeEach(() => {
  // Mock ProgressEvent if not available
  if (typeof ProgressEvent === "undefined") {
    (global as any).ProgressEvent = mock(function (this: any, type: string) {
      this.type = type;
      return this;
    });
  }

  // Mock Image constructor - track the actual instance created
  global.Image = mock(function (this: any) {
    this.src = "";
    this.crossOrigin = "";
    this.onload = null;
    this.onerror = null;
    this.width = 800;
    this.height = 600;
    mockImageInstance = this;
    return this;
  }) as any;

  // Mock FileReader constructor - track the actual instance created
  global.FileReader = mock(function (this: any) {
    this.onload = null;
    this.onerror = null;
    this.result = "data:image/png;base64,fake";
    this.readAsDataURL = mock();
    mockFileReaderInstance = this;
    return this;
  }) as any;

  // Mock canvas context
  mockContext = {
    imageSmoothingEnabled: false,
    imageSmoothingQuality: "low",
    drawImage: mock(),
  };

  // Mock canvas
  mockCanvas = {
    width: 0,
    height: 0,
    getContext: mock(() => mockContext),
    toBlob: mock((callback: BlobCallback) => {
      callback(new Blob(["fake"], { type: "image/jpeg" }));
    }),
    toDataURL: mock(() => "data:image/jpeg;base64,fake"),
  };

  // Mock document.createElement
  global.document = {
    createElement: mock((tag: string) => {
      if (tag === "canvas") {
        return mockCanvas;
      }
      throw new Error(`Unexpected createElement: ${tag}`);
    }),
  } as any;
});

afterEach(() => {
  // Clean up mocks
  delete (global as any).Image;
  delete (global as any).FileReader;
  delete (global as any).document;
  if (typeof ProgressEvent !== "undefined") {
    delete (global as any).ProgressEvent;
  }
});

// Import after mocking
import {
  canvasToBlob,
  createImage,
  cropImage,
  cropImageToCanvas,
  getCroppedAreaPixels,
  getMaxSquareCrop,
  percentToPixelCrop,
  validateCropArea,
} from "./crop";

describe("percentToPixelCrop", () => {
  test("converts percentage to pixels correctly", () => {
    const percentCrop: CropArea = {
      x: 10,
      y: 20,
      width: 50,
      height: 60,
    };
    const imageWidth = 1000;
    const imageHeight = 800;

    const result = percentToPixelCrop(percentCrop, imageWidth, imageHeight);

    expect(result).toEqual({
      x: 100, // 10% of 1000
      y: 160, // 20% of 800
      width: 500, // 50% of 1000
      height: 480, // 60% of 800
    });
  });

  test("handles zero values", () => {
    const percentCrop: CropArea = {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    };
    const imageWidth = 1000;
    const imageHeight = 800;

    const result = percentToPixelCrop(percentCrop, imageWidth, imageHeight);

    expect(result).toEqual({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    });
  });

  test("handles 100% values", () => {
    const percentCrop: CropArea = {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    };
    const imageWidth = 1000;
    const imageHeight = 800;

    const result = percentToPixelCrop(percentCrop, imageWidth, imageHeight);

    expect(result).toEqual({
      x: 0,
      y: 0,
      width: 1000,
      height: 800,
    });
  });

  test("handles decimal percentages", () => {
    const percentCrop: CropArea = {
      x: 12.5,
      y: 25.3,
      width: 33.33,
      height: 66.67,
    };
    const imageWidth = 800;
    const imageHeight = 600;

    const result = percentToPixelCrop(percentCrop, imageWidth, imageHeight);

    // Use closeTo for floating point comparisons
    expect(result.x).toBeCloseTo(100, 2);
    expect(result.y).toBeCloseTo(151.8, 2);
    expect(result.width).toBeCloseTo(266.64, 2);
    expect(result.height).toBeCloseTo(400.02, 2);
  });
});

describe("getCroppedAreaPixels", () => {
  test("rounds values correctly", () => {
    const croppedArea: CropArea = {
      x: 10.4,
      y: 20.6,
      width: 100.3,
      height: 200.8,
    };

    const result = getCroppedAreaPixels(croppedArea);

    expect(result).toEqual({
      x: 10,
      y: 21,
      width: 100,
      height: 201,
    });
  });

  test("handles integer values", () => {
    const croppedArea: CropArea = {
      x: 10,
      y: 20,
      width: 100,
      height: 200,
    };

    const result = getCroppedAreaPixels(croppedArea);

    expect(result).toEqual({
      x: 10,
      y: 20,
      width: 100,
      height: 200,
    });
  });

  test("rounds 0.5 up", () => {
    const croppedArea: CropArea = {
      x: 10.5,
      y: 20.5,
      width: 100.5,
      height: 200.5,
    };

    const result = getCroppedAreaPixels(croppedArea);

    expect(result).toEqual({
      x: 11,
      y: 21,
      width: 101,
      height: 201,
    });
  });

  test("handles negative values", () => {
    const croppedArea: CropArea = {
      x: -10.6,
      y: -20.3,
      width: 100.7,
      height: 200.2,
    };

    const result = getCroppedAreaPixels(croppedArea);

    expect(result).toEqual({
      x: -11,
      y: -20,
      width: 101,
      height: 200,
    });
  });
});

describe("validateCropArea", () => {
  test("returns true for valid crop within bounds", () => {
    const cropArea: CropArea = {
      x: 10,
      y: 20,
      width: 100,
      height: 80,
    };
    const imageWidth = 200;
    const imageHeight = 200;

    const result = validateCropArea(cropArea, imageWidth, imageHeight);

    expect(result).toBe(true);
  });

  test("returns true for crop at origin", () => {
    const cropArea: CropArea = {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    };
    const imageWidth = 200;
    const imageHeight = 200;

    const result = validateCropArea(cropArea, imageWidth, imageHeight);

    expect(result).toBe(true);
  });

  test("returns true for full image crop", () => {
    const cropArea: CropArea = {
      x: 0,
      y: 0,
      width: 200,
      height: 200,
    };
    const imageWidth = 200;
    const imageHeight = 200;

    const result = validateCropArea(cropArea, imageWidth, imageHeight);

    expect(result).toBe(true);
  });

  test("returns false for negative x", () => {
    const cropArea: CropArea = {
      x: -1,
      y: 0,
      width: 100,
      height: 100,
    };
    const imageWidth = 200;
    const imageHeight = 200;

    const result = validateCropArea(cropArea, imageWidth, imageHeight);

    expect(result).toBe(false);
  });

  test("returns false for negative y", () => {
    const cropArea: CropArea = {
      x: 0,
      y: -1,
      width: 100,
      height: 100,
    };
    const imageWidth = 200;
    const imageHeight = 200;

    const result = validateCropArea(cropArea, imageWidth, imageHeight);

    expect(result).toBe(false);
  });

  test("returns false for zero width", () => {
    const cropArea: CropArea = {
      x: 0,
      y: 0,
      width: 0,
      height: 100,
    };
    const imageWidth = 200;
    const imageHeight = 200;

    const result = validateCropArea(cropArea, imageWidth, imageHeight);

    expect(result).toBe(false);
  });

  test("returns false for zero height", () => {
    const cropArea: CropArea = {
      x: 0,
      y: 0,
      width: 100,
      height: 0,
    };
    const imageWidth = 200;
    const imageHeight = 200;

    const result = validateCropArea(cropArea, imageWidth, imageHeight);

    expect(result).toBe(false);
  });

  test("returns false for negative width", () => {
    const cropArea: CropArea = {
      x: 0,
      y: 0,
      width: -100,
      height: 100,
    };
    const imageWidth = 200;
    const imageHeight = 200;

    const result = validateCropArea(cropArea, imageWidth, imageHeight);

    expect(result).toBe(false);
  });

  test("returns false for negative height", () => {
    const cropArea: CropArea = {
      x: 0,
      y: 0,
      width: 100,
      height: -100,
    };
    const imageWidth = 200;
    const imageHeight = 200;

    const result = validateCropArea(cropArea, imageWidth, imageHeight);

    expect(result).toBe(false);
  });

  test("returns false when crop extends beyond right edge", () => {
    const cropArea: CropArea = {
      x: 150,
      y: 0,
      width: 100,
      height: 100,
    };
    const imageWidth = 200;
    const imageHeight = 200;

    const result = validateCropArea(cropArea, imageWidth, imageHeight);

    expect(result).toBe(false);
  });

  test("returns false when crop extends beyond bottom edge", () => {
    const cropArea: CropArea = {
      x: 0,
      y: 150,
      width: 100,
      height: 100,
    };
    const imageWidth = 200;
    const imageHeight = 200;

    const result = validateCropArea(cropArea, imageWidth, imageHeight);

    expect(result).toBe(false);
  });

  test("returns true when crop exactly fits right edge", () => {
    const cropArea: CropArea = {
      x: 100,
      y: 0,
      width: 100,
      height: 100,
    };
    const imageWidth = 200;
    const imageHeight = 200;

    const result = validateCropArea(cropArea, imageWidth, imageHeight);

    expect(result).toBe(true);
  });

  test("returns true when crop exactly fits bottom edge", () => {
    const cropArea: CropArea = {
      x: 0,
      y: 100,
      width: 100,
      height: 100,
    };
    const imageWidth = 200;
    const imageHeight = 200;

    const result = validateCropArea(cropArea, imageWidth, imageHeight);

    expect(result).toBe(true);
  });
});

describe("getMaxSquareCrop", () => {
  test("calculates centered square crop for landscape image", () => {
    const imageWidth = 1000;
    const imageHeight = 600;

    const result = getMaxSquareCrop(imageWidth, imageHeight);

    expect(result).toEqual({
      x: 200, // (1000 - 600) / 2
      y: 0,
      width: 600,
      height: 600,
    });
  });

  test("calculates centered square crop for portrait image", () => {
    const imageWidth = 600;
    const imageHeight = 1000;

    const result = getMaxSquareCrop(imageWidth, imageHeight);

    expect(result).toEqual({
      x: 0,
      y: 200, // (1000 - 600) / 2
      width: 600,
      height: 600,
    });
  });

  test("returns full dimensions for square image", () => {
    const imageWidth = 500;
    const imageHeight = 500;

    const result = getMaxSquareCrop(imageWidth, imageHeight);

    expect(result).toEqual({
      x: 0,
      y: 0,
      width: 500,
      height: 500,
    });
  });

  test("handles very wide landscape image", () => {
    const imageWidth = 2000;
    const imageHeight = 400;

    const result = getMaxSquareCrop(imageWidth, imageHeight);

    expect(result).toEqual({
      x: 800, // (2000 - 400) / 2
      y: 0,
      width: 400,
      height: 400,
    });
  });

  test("handles very tall portrait image", () => {
    const imageWidth = 400;
    const imageHeight = 2000;

    const result = getMaxSquareCrop(imageWidth, imageHeight);

    expect(result).toEqual({
      x: 0,
      y: 800, // (2000 - 400) / 2
      width: 400,
      height: 400,
    });
  });

  test("handles small square image", () => {
    const imageWidth = 10;
    const imageHeight = 10;

    const result = getMaxSquareCrop(imageWidth, imageHeight);

    expect(result).toEqual({
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    });
  });

  test("centers correctly with odd dimensions", () => {
    const imageWidth = 1001;
    const imageHeight = 601;

    const result = getMaxSquareCrop(imageWidth, imageHeight);

    expect(result).toEqual({
      x: 200, // (1001 - 601) / 2
      y: 0,
      width: 601,
      height: 601,
    });
  });
});

describe("createImage", () => {
  test("creates image from string URL", async () => {
    const url = "https://example.com/image.jpg";
    const imagePromise = createImage(url);

    // Simulate image load asynchronously
    await Promise.resolve();
    mockImageInstance.onload?.call(mockImageInstance, new Event("load"));

    const image = await imagePromise;

    expect(image.src).toBe(url);
    expect(image.crossOrigin).toBe("anonymous");
  });

  test("rejects when image fails to load from string URL", async () => {
    const url = "https://example.com/invalid.jpg";
    const imagePromise = createImage(url);

    // Simulate image error asynchronously
    await Promise.resolve();
    const error = new Event("error");
    mockImageInstance.onerror?.call(mockImageInstance, error);

    await expect(imagePromise).rejects.toThrow("Failed to load image");
  });

  test("creates image from File object", async () => {
    const file = new File(["fake"], "image.jpg", { type: "image/jpeg" });
    const imagePromise = createImage(file);

    // Simulate FileReader load asynchronously
    await Promise.resolve();
    mockFileReaderInstance.onload?.call(
      mockFileReaderInstance,
      new ProgressEvent("load"),
    );
    await Promise.resolve();
    // Then simulate image load
    mockImageInstance.onload?.call(mockImageInstance, new Event("load"));

    const image = await imagePromise;

    expect(mockFileReaderInstance.readAsDataURL).toHaveBeenCalledWith(file);
    expect(image.src).toBe(mockFileReaderInstance.result);
  });

  test("rejects when FileReader fails", async () => {
    const file = new File(["fake"], "image.jpg", { type: "image/jpeg" });
    const imagePromise = createImage(file);

    // Simulate FileReader error asynchronously
    await Promise.resolve();
    mockFileReaderInstance.onerror?.call(
      mockFileReaderInstance,
      new ProgressEvent("error"),
    );

    await expect(imagePromise).rejects.toThrow("Failed to read file");
  });

  test("rejects when image fails to load from File", async () => {
    const file = new File(["fake"], "image.jpg", { type: "image/jpeg" });
    const imagePromise = createImage(file);

    // Simulate FileReader load asynchronously
    await Promise.resolve();
    mockFileReaderInstance.onload?.call(
      mockFileReaderInstance,
      new ProgressEvent("load"),
    );
    await Promise.resolve();
    // Then simulate image error
    const error = new Event("error");
    mockImageInstance.onerror?.call(mockImageInstance, error);

    await expect(imagePromise).rejects.toThrow("Failed to load image");
  });
});

describe("cropImageToCanvas", () => {
  test("creates canvas with default dimensions", () => {
    const image = new Image();
    const cropArea: CropArea = {
      x: 10,
      y: 20,
      width: 100,
      height: 100,
    };

    const canvas = cropImageToCanvas(image, cropArea);

    expect(canvas.width).toBe(256); // default
    expect(canvas.height).toBe(256); // default
    expect(mockCanvas.getContext).toHaveBeenCalledWith("2d");
  });

  test("creates canvas with custom dimensions", () => {
    const image = new Image();
    const cropArea: CropArea = {
      x: 10,
      y: 20,
      width: 100,
      height: 100,
    };
    const options = {
      outputWidth: 512,
      outputHeight: 512,
    };

    const canvas = cropImageToCanvas(image, cropArea, options);

    expect(canvas.width).toBe(512);
    expect(canvas.height).toBe(512);
  });

  test("enables image smoothing with high quality", () => {
    const image = new Image();
    const cropArea: CropArea = {
      x: 10,
      y: 20,
      width: 100,
      height: 100,
    };

    cropImageToCanvas(image, cropArea);

    expect(mockContext.imageSmoothingEnabled).toBe(true);
    expect(mockContext.imageSmoothingQuality).toBe("high");
  });

  test("draws image with correct parameters", () => {
    const image = new Image();
    const cropArea: CropArea = {
      x: 50,
      y: 75,
      width: 200,
      height: 150,
    };
    const options = {
      outputWidth: 400,
      outputHeight: 300,
    };

    cropImageToCanvas(image, cropArea, options);

    expect(mockContext.drawImage).toHaveBeenCalledWith(
      image,
      50, // crop x
      75, // crop y
      200, // crop width
      150, // crop height
      0, // dest x
      0, // dest y
      400, // dest width
      300, // dest height
    );
  });

  test("throws error when canvas context is not available", () => {
    const image = new Image();
    const cropArea: CropArea = {
      x: 10,
      y: 20,
      width: 100,
      height: 100,
    };

    // Mock getContext to return null
    mockCanvas.getContext = mock(() => null);

    expect(() => cropImageToCanvas(image, cropArea)).toThrow(
      "Failed to get canvas context",
    );
  });
});

describe("canvasToBlob", () => {
  test("converts canvas to blob successfully", async () => {
    const canvas = mockCanvas as unknown as HTMLCanvasElement;
    const format = "image/jpeg";
    const quality = 0.9;

    const blob = await canvasToBlob(canvas, format, quality);

    expect(mockCanvas.toBlob).toHaveBeenCalled();
    expect(blob).toBeInstanceOf(Blob);
  });

  test("passes format and quality to toBlob", async () => {
    const canvas = mockCanvas as unknown as HTMLCanvasElement;
    const format = "image/png";
    const quality = 0.8;

    await canvasToBlob(canvas, format, quality);

    const toBlobCall = mockCanvas.toBlob.mock.calls[0];
    expect(toBlobCall[1]).toBe(format);
    expect(toBlobCall[2]).toBe(quality);
  });

  test("rejects when blob conversion fails", async () => {
    const canvas = mockCanvas as unknown as HTMLCanvasElement;
    const format = "image/jpeg";
    const quality = 0.9;

    // Mock toBlob to call callback with null
    mockCanvas.toBlob = mock((callback: BlobCallback) => {
      callback(null);
    });

    await expect(canvasToBlob(canvas, format, quality)).rejects.toThrow(
      "Failed to convert canvas to blob",
    );
  });
});

describe("cropImage", () => {
  test("crops image from URL with default options", async () => {
    const url = "https://example.com/image.jpg";
    const cropArea: CropArea = {
      x: 10,
      y: 20,
      width: 100,
      height: 100,
    };

    const promise = cropImage(url, cropArea);

    // Simulate image load asynchronously
    await Promise.resolve();
    mockImageInstance.onload?.call(mockImageInstance, new Event("load"));

    const result = await promise;

    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.dataUrl).toBe("data:image/jpeg;base64,fake");
    expect(mockCanvas.toDataURL).toHaveBeenCalledWith("image/jpeg", 0.9);
  });

  test("crops image from File with custom options", async () => {
    const file = new File(["fake"], "image.jpg", { type: "image/jpeg" });
    const cropArea: CropArea = {
      x: 50,
      y: 75,
      width: 200,
      height: 150,
    };
    const options = {
      outputWidth: 512,
      outputHeight: 512,
      format: "image/png" as const,
      quality: 0.8,
    };

    const promise = cropImage(file, cropArea, options);

    // Simulate FileReader load asynchronously
    await Promise.resolve();
    mockFileReaderInstance.onload?.call(
      mockFileReaderInstance,
      new ProgressEvent("load"),
    );
    await Promise.resolve();
    // Then simulate image load
    mockImageInstance.onload?.call(mockImageInstance, new Event("load"));

    const result = await promise;

    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.dataUrl).toBe("data:image/jpeg;base64,fake");
    expect(mockCanvas.width).toBe(512);
    expect(mockCanvas.height).toBe(512);
    expect(mockCanvas.toDataURL).toHaveBeenCalledWith("image/png", 0.8);
  });

  test("rejects when image fails to load", async () => {
    const url = "https://example.com/invalid.jpg";
    const cropArea: CropArea = {
      x: 10,
      y: 20,
      width: 100,
      height: 100,
    };

    const promise = cropImage(url, cropArea);

    // Simulate image error asynchronously
    await Promise.resolve();
    const error = new Event("error");
    mockImageInstance.onerror?.call(mockImageInstance, error);

    await expect(promise).rejects.toThrow("Failed to load image");
  });

  test("rejects when canvas to blob fails", async () => {
    const url = "https://example.com/image.jpg";
    const cropArea: CropArea = {
      x: 10,
      y: 20,
      width: 100,
      height: 100,
    };

    // Mock toBlob to fail
    mockCanvas.toBlob = mock((callback: BlobCallback) => {
      callback(null);
    });

    const promise = cropImage(url, cropArea);

    // Simulate image load asynchronously
    await Promise.resolve();
    mockImageInstance.onload?.call(mockImageInstance, new Event("load"));

    await expect(promise).rejects.toThrow("Failed to convert canvas to blob");
  });

  test("uses webp format when specified", async () => {
    const url = "https://example.com/image.jpg";
    const cropArea: CropArea = {
      x: 10,
      y: 20,
      width: 100,
      height: 100,
    };
    const options = {
      format: "image/webp" as const,
      quality: 0.85,
    };

    const promise = cropImage(url, cropArea, options);

    // Simulate image load asynchronously
    await Promise.resolve();
    mockImageInstance.onload?.call(mockImageInstance, new Event("load"));

    await promise;

    expect(mockCanvas.toDataURL).toHaveBeenCalledWith("image/webp", 0.85);
  });
});
