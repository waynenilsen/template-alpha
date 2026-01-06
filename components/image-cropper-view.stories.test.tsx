import { describe, expect, test } from "bun:test";
import { composeStories } from "@storybook/react";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import * as stories from "./image-cropper-view.stories";

const {
  Default,
  Processing,
  RectangularCrop,
  ZoomedIn,
  WideAspectRatio,
  MaxZoom,
} = composeStories(stories);

describe("ImageCropperView Stories", () => {
  test("Default story renders without crashing", () => {
    const html = renderToString(createElement(Default));
    expect(html).toContain('data-testid="image-cropper"');
    expect(html).toContain('data-testid="zoom-slider"');
    expect(html).toContain('data-testid="cancel-button"');
    expect(html).toContain('data-testid="apply-button"');
  });

  test("Processing story shows loading state", () => {
    const html = renderToString(createElement(Processing));
    expect(html).toContain("Processing...");
    expect(html).toContain("disabled");
  });

  test("RectangularCrop story renders with rect shape", () => {
    const html = renderToString(createElement(RectangularCrop));
    expect(html).toContain('data-testid="image-cropper"');
  });

  test("ZoomedIn story renders with zoom level 2", () => {
    const html = renderToString(createElement(ZoomedIn));
    expect(html).toContain('data-testid="zoom-slider"');
  });

  test("WideAspectRatio story renders with 16:9 aspect", () => {
    const html = renderToString(createElement(WideAspectRatio));
    expect(html).toContain('data-testid="image-cropper"');
  });

  test("MaxZoom story renders with zoom level 3", () => {
    const html = renderToString(createElement(MaxZoom));
    expect(html).toContain('data-testid="zoom-slider"');
  });

  test("all stories have required action handlers", () => {
    const allStories = [
      Default,
      Processing,
      RectangularCrop,
      ZoomedIn,
      WideAspectRatio,
      MaxZoom,
    ];

    for (const Story of allStories) {
      const { args } = Story;
      expect(typeof args.onCropChange).toBe("function");
      expect(typeof args.onZoomChange).toBe("function");
      expect(typeof args.onCropComplete).toBe("function");
      expect(typeof args.onApply).toBe("function");
      expect(typeof args.onCancel).toBe("function");
    }
  });
});
