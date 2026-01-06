import { describe, expect, mock, test } from "bun:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { AvatarUploadView } from "./avatar-upload-view";

describe("AvatarUploadView", () => {
  const defaultProps = {
    avatarUrl: null,
    fallbackText: "John Doe",
    isLoading: false,
    isUploading: false,
    isDeleting: false,
    error: null,
    onUpload: mock(() => {}),
    onDelete: mock(() => {}),
    onClearError: mock(() => {}),
    size: "lg" as const,
  };

  describe("rendering", () => {
    test("renders without avatar", () => {
      const html = renderToString(
        createElement(AvatarUploadView, defaultProps),
      );

      expect(html).toContain('data-testid="avatar-upload"');
      expect(html).toContain("Upload");
      expect(html).toContain("JD"); // Initials
    });

    test("renders with avatar", () => {
      const html = renderToString(
        createElement(AvatarUploadView, {
          ...defaultProps,
          avatarUrl: "https://example.com/avatar.jpg",
        }),
      );

      expect(html).toContain("Change");
      expect(html).toContain("Remove");
      // Note: Radix Avatar renders the image in a way that may not be fully
      // visible in SSR output - the main verification is the Change/Remove buttons
    });

    test("renders loading state", () => {
      const html = renderToString(
        createElement(AvatarUploadView, {
          ...defaultProps,
          isLoading: true,
        }),
      );

      expect(html).toContain("animate-spin");
    });

    test("renders uploading state", () => {
      const html = renderToString(
        createElement(AvatarUploadView, {
          ...defaultProps,
          isUploading: true,
        }),
      );

      expect(html).toContain("Uploading");
      expect(html).toContain("animate-spin");
    });

    test("renders deleting state", () => {
      const html = renderToString(
        createElement(AvatarUploadView, {
          ...defaultProps,
          avatarUrl: "https://example.com/avatar.jpg",
          isDeleting: true,
        }),
      );

      expect(html).toContain("Removing");
      expect(html).toContain("animate-spin");
    });

    test("renders error message", () => {
      const html = renderToString(
        createElement(AvatarUploadView, {
          ...defaultProps,
          error: "File is too large",
        }),
      );

      expect(html).toContain('data-testid="avatar-error"');
      expect(html).toContain("File is too large");
      expect(html).toContain("Dismiss");
    });
  });

  describe("sizes", () => {
    test("renders small size", () => {
      const html = renderToString(
        createElement(AvatarUploadView, {
          ...defaultProps,
          size: "sm",
        }),
      );

      expect(html).toContain("h-16");
      expect(html).toContain("w-16");
    });

    test("renders medium size", () => {
      const html = renderToString(
        createElement(AvatarUploadView, {
          ...defaultProps,
          size: "md",
        }),
      );

      expect(html).toContain("h-24");
      expect(html).toContain("w-24");
    });

    test("renders large size", () => {
      const html = renderToString(
        createElement(AvatarUploadView, {
          ...defaultProps,
          size: "lg",
        }),
      );

      expect(html).toContain("h-32");
      expect(html).toContain("w-32");
    });
  });

  describe("fallback text", () => {
    test("renders initials from name", () => {
      const html = renderToString(
        createElement(AvatarUploadView, {
          ...defaultProps,
          fallbackText: "Jane Smith",
        }),
      );

      expect(html).toContain("JS");
    });

    test("renders single initial from single word", () => {
      const html = renderToString(
        createElement(AvatarUploadView, {
          ...defaultProps,
          fallbackText: "Admin",
        }),
      );

      expect(html).toContain("A");
    });

    test("truncates to two initials for long names", () => {
      const html = renderToString(
        createElement(AvatarUploadView, {
          ...defaultProps,
          fallbackText: "John Robert Smith Junior",
        }),
      );

      expect(html).toContain("JR");
    });
  });

  describe("help text", () => {
    test("shows supported file types", () => {
      const html = renderToString(
        createElement(AvatarUploadView, defaultProps),
      );

      expect(html).toContain("JPEG, PNG, GIF, or WebP");
      expect(html).toContain("Max 5MB");
    });
  });

  describe("file input", () => {
    test("renders hidden file input", () => {
      const html = renderToString(
        createElement(AvatarUploadView, defaultProps),
      );

      expect(html).toContain('data-testid="avatar-file-input"');
      expect(html).toContain('type="file"');
      expect(html).toContain(
        'accept="image/jpeg,image/png,image/gif,image/webp"',
      );
    });
  });

  describe("button states", () => {
    test("shows Upload button when no avatar", () => {
      const html = renderToString(
        createElement(AvatarUploadView, defaultProps),
      );

      expect(html).toContain("Upload");
      expect(html).not.toContain("Remove");
    });

    test("shows Change and Remove buttons when avatar exists", () => {
      const html = renderToString(
        createElement(AvatarUploadView, {
          ...defaultProps,
          avatarUrl: "https://example.com/avatar.jpg",
        }),
      );

      expect(html).toContain("Change");
      expect(html).toContain("Remove");
    });
  });
});
