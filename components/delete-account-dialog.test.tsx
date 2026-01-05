import { describe, expect, mock, test } from "bun:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { DeleteAccountDialog } from "./delete-account-dialog";

describe("DeleteAccountDialog", () => {
  describe("rendering", () => {
    test("renders trigger button when provided", () => {
      const html = renderToString(
        createElement(DeleteAccountDialog, {
          trigger: createElement(
            "button",
            { type: "button" },
            "Delete Account",
          ),
        }),
      );

      expect(html).toContain("Delete Account");
      expect(html).toContain("alert-dialog-trigger");
    });

    test("renders without trigger", () => {
      const html = renderToString(
        createElement(DeleteAccountDialog, {
          open: false,
        }),
      );

      // Should render empty dialog root without trigger
      expect(html).toBeDefined();
    });

    test("renders with custom trigger element", () => {
      const html = renderToString(
        createElement(DeleteAccountDialog, {
          trigger: createElement(
            "span",
            { className: "custom-trigger" },
            "Custom Delete",
          ),
        }),
      );

      expect(html).toContain("Custom Delete");
      expect(html).toContain("custom-trigger");
    });

    // Note: Dialog content renders via Portal which doesn't work with SSR
    // Content rendering is tested via Storybook stories
  });

  describe("props", () => {
    test("accepts onConfirm callback", () => {
      const onConfirm = mock(() => {});
      const html = renderToString(
        createElement(DeleteAccountDialog, {
          onConfirm,
        }),
      );

      expect(html).toBeDefined();
    });

    test("accepts onOpenChange callback", () => {
      const onOpenChange = mock(() => {});
      const html = renderToString(
        createElement(DeleteAccountDialog, {
          onOpenChange,
        }),
      );

      expect(html).toBeDefined();
    });

    test("renders with all default props", () => {
      const html = renderToString(createElement(DeleteAccountDialog, {}));

      expect(html).toBeDefined();
    });

    test("accepts isLoading prop", () => {
      const html = renderToString(
        createElement(DeleteAccountDialog, {
          isLoading: true,
        }),
      );

      expect(html).toBeDefined();
    });

    test("accepts error prop", () => {
      const html = renderToString(
        createElement(DeleteAccountDialog, {
          error: "Something went wrong",
        }),
      );

      expect(html).toBeDefined();
    });

    test("accepts open prop as false", () => {
      const html = renderToString(
        createElement(DeleteAccountDialog, {
          open: false,
        }),
      );

      expect(html).toBeDefined();
    });

    test("accepts open prop as true", () => {
      const html = renderToString(
        createElement(DeleteAccountDialog, {
          open: true,
        }),
      );

      // Note: Portal content won't render in SSR
      expect(html).toBeDefined();
    });
  });

  describe("component exports", () => {
    test("exports DeleteAccountDialog component", () => {
      expect(DeleteAccountDialog).toBeDefined();
      expect(typeof DeleteAccountDialog).toBe("function");
    });

    test("DeleteAccountDialog accepts expected props interface", () => {
      // Verify component renders with full props interface
      const html = renderToString(
        createElement(DeleteAccountDialog, {
          trigger: createElement("button", { type: "button" }, "Delete"),
          onConfirm: mock(() => {}),
          isLoading: false,
          error: undefined,
          open: false,
          onOpenChange: mock(() => {}),
        }),
      );

      expect(html).toBeDefined();
    });
  });
});
