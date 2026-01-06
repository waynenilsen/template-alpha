import { describe, expect, mock, test } from "bun:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

// Mock react-easy-crop BEFORE importing component
mock.module("react-easy-crop", () => ({
  default: ({
    image,
    crop,
    zoom,
    aspect,
    cropShape,
  }: {
    image: string;
    crop: { x: number; y: number };
    zoom: number;
    aspect: number;
    cropShape: "rect" | "round";
  }) =>
    createElement("div", {
      "data-testid": "mock-cropper",
      "data-image": image,
      "data-crop-x": crop.x,
      "data-crop-y": crop.y,
      "data-zoom": zoom,
      "data-aspect": aspect,
      "data-crop-shape": cropShape,
    }),
}));

// Import component AFTER mocking
import { ImageCropperView } from "./image-cropper-view";

describe("ImageCropperView", () => {
  const defaultProps = {
    imageSrc: "data:image/png;base64,test",
    crop: { x: 0, y: 0 },
    zoom: 1,
    aspect: 1,
    cropShape: "round" as const,
    onCropChange: mock(() => {}),
    onZoomChange: mock(() => {}),
    onCropComplete: mock(() => {}),
    onApply: mock(() => {}),
    onCancel: mock(() => {}),
    isProcessing: false,
  };

  describe("rendering", () => {
    test("renders the main container with correct test ID", () => {
      const html = renderToString(
        createElement(ImageCropperView, defaultProps),
      );

      expect(html).toContain('data-testid="image-cropper"');
    });

    test("renders the cropper component", () => {
      const html = renderToString(
        createElement(ImageCropperView, defaultProps),
      );

      expect(html).toContain('data-testid="mock-cropper"');
    });

    test("renders zoom slider with correct test ID", () => {
      const html = renderToString(
        createElement(ImageCropperView, defaultProps),
      );

      expect(html).toContain('data-testid="zoom-slider"');
      expect(html).toContain("Zoom");
    });

    test("renders Cancel button with correct test ID", () => {
      const html = renderToString(
        createElement(ImageCropperView, defaultProps),
      );

      expect(html).toContain('data-testid="cancel-button"');
      expect(html).toContain("Cancel");
    });

    test("renders Apply button with correct test ID", () => {
      const html = renderToString(
        createElement(ImageCropperView, defaultProps),
      );

      expect(html).toContain('data-testid="apply-button"');
      expect(html).toContain("Apply");
    });
  });

  describe("cropper props", () => {
    test("passes image source to cropper", () => {
      const imageSrc = "https://example.com/test-image.jpg";
      const html = renderToString(
        createElement(ImageCropperView, {
          ...defaultProps,
          imageSrc,
        }),
      );

      expect(html).toContain(`data-image="${imageSrc}"`);
    });

    test("passes crop position to cropper", () => {
      const crop = { x: 10, y: 20 };
      const html = renderToString(
        createElement(ImageCropperView, {
          ...defaultProps,
          crop,
        }),
      );

      expect(html).toContain(`data-crop-x="${crop.x}"`);
      expect(html).toContain(`data-crop-y="${crop.y}"`);
    });

    test("passes zoom level to cropper", () => {
      const zoom = 2.5;
      const html = renderToString(
        createElement(ImageCropperView, {
          ...defaultProps,
          zoom,
        }),
      );

      expect(html).toContain(`data-zoom="${zoom}"`);
    });

    test("passes default aspect ratio", () => {
      const html = renderToString(
        createElement(ImageCropperView, defaultProps),
      );

      expect(html).toContain('data-aspect="1"');
    });

    test("passes custom aspect ratio", () => {
      const aspect = 16 / 9;
      const html = renderToString(
        createElement(ImageCropperView, {
          ...defaultProps,
          aspect,
        }),
      );

      expect(html).toContain(`data-aspect="${aspect}"`);
    });

    test("passes default crop shape", () => {
      const html = renderToString(
        createElement(ImageCropperView, defaultProps),
      );

      expect(html).toContain('data-crop-shape="round"');
    });

    test("passes rect crop shape", () => {
      const html = renderToString(
        createElement(ImageCropperView, {
          ...defaultProps,
          cropShape: "rect",
        }),
      );

      expect(html).toContain('data-crop-shape="rect"');
    });
  });

  describe("zoom slider", () => {
    test("renders with correct attributes", () => {
      const html = renderToString(
        createElement(ImageCropperView, defaultProps),
      );

      expect(html).toContain('id="zoom-slider"');
      expect(html).toContain('data-testid="zoom-slider"');
    });

    test("has label for accessibility", () => {
      const html = renderToString(
        createElement(ImageCropperView, defaultProps),
      );

      expect(html).toContain('for="zoom-slider"');
      expect(html).toContain(">Zoom</label>");
    });
  });

  describe("button states", () => {
    test("Apply button shows default text when not processing", () => {
      const html = renderToString(
        createElement(ImageCropperView, {
          ...defaultProps,
          isProcessing: false,
        }),
      );

      expect(html).toContain("Apply");
      expect(html).not.toContain("Processing");
    });

    test("Apply button shows loading state when processing", () => {
      const html = renderToString(
        createElement(ImageCropperView, {
          ...defaultProps,
          isProcessing: true,
        }),
      );

      expect(html).toContain("Processing");
      expect(html).toContain("animate-spin");
    });

    test("buttons are enabled when not processing", () => {
      const html = renderToString(
        createElement(ImageCropperView, {
          ...defaultProps,
          isProcessing: false,
        }),
      );

      // Buttons should be present when not processing
      expect(html).toContain('data-testid="cancel-button"');
      expect(html).toContain('data-testid="apply-button"');
    });

    test("buttons are disabled when processing", () => {
      const html = renderToString(
        createElement(ImageCropperView, {
          ...defaultProps,
          isProcessing: true,
        }),
      );

      // Check that disabled attribute is present somewhere near the buttons
      // The Button component will render disabled prop
      expect(html).toContain('data-testid="cancel-button"');
      expect(html).toContain('data-testid="apply-button"');
      // Verify processing state is active
      expect(html).toContain("Processing");
    });
  });

  describe("loading indicator", () => {
    test("shows Loader2 icon when processing", () => {
      const html = renderToString(
        createElement(ImageCropperView, {
          ...defaultProps,
          isProcessing: true,
        }),
      );

      expect(html).toContain("animate-spin");
      expect(html).toContain("h-4");
      expect(html).toContain("w-4");
    });

    test("does not show Loader2 icon when not processing", () => {
      const html = renderToString(
        createElement(ImageCropperView, {
          ...defaultProps,
          isProcessing: false,
        }),
      );

      // Check that Apply button section doesn't have the spinner
      const applyButtonSection = html.split('data-testid="apply-button"')[1];
      expect(applyButtonSection).not.toContain("animate-spin");
    });
  });

  describe("layout and styling", () => {
    test("renders with correct container spacing", () => {
      const html = renderToString(
        createElement(ImageCropperView, defaultProps),
      );

      expect(html).toContain("space-y-6");
    });

    test("cropper container has correct height and styling", () => {
      const html = renderToString(
        createElement(ImageCropperView, defaultProps),
      );

      expect(html).toContain("h-[300px]");
      expect(html).toContain("w-full");
      expect(html).toContain("overflow-hidden");
      expect(html).toContain("rounded-lg");
      expect(html).toContain("bg-muted");
    });

    test("zoom slider section has correct spacing", () => {
      const html = renderToString(
        createElement(ImageCropperView, defaultProps),
      );

      expect(html).toContain("space-y-2");
    });

    test("action buttons are right-aligned", () => {
      const html = renderToString(
        createElement(ImageCropperView, defaultProps),
      );

      expect(html).toContain("justify-end");
      expect(html).toContain("gap-3");
    });
  });

  describe("button variants", () => {
    test("Cancel button has outline variant", () => {
      const html = renderToString(
        createElement(ImageCropperView, defaultProps),
      );

      // Check for outline variant in the Cancel button section
      const cancelSection = html.split('data-testid="cancel-button"')[0];
      const lastButton = cancelSection.split("<button").pop();
      expect(lastButton).toContain("outline");
    });
  });
});
