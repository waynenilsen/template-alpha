import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import {
  deleteAllMessages,
  getBody,
  getMessages,
  getMessagesByRecipient,
  getSubject,
  isMailHogAvailable,
  waitForEmail,
} from "./mailhog";

// Mock fetch globally
const originalFetch = globalThis.fetch;
let mockFetch: ReturnType<
  typeof mock<
    (url: string | URL | Request, init?: RequestInit) => Promise<Response>
  >
>;

beforeEach(() => {
  mockFetch = mock(() =>
    Promise.resolve(
      new Response(JSON.stringify({ items: [] }), { status: 200 }),
    ),
  );
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// Helper to create a mock MailHog message
function createMockMessage(
  overrides: {
    id?: string;
    from?: string;
    to?: string;
    subject?: string;
    body?: string;
  } = {},
) {
  const to = overrides.to ?? "test@example.com";
  const [mailbox, domain] = to.split("@");

  return {
    ID: overrides.id ?? "mock-id",
    From: {
      Relays: null,
      Mailbox: "sender",
      Domain: "example.com",
      Params: "",
    },
    To: [
      {
        Relays: null,
        Mailbox: mailbox,
        Domain: domain,
        Params: "",
      },
    ],
    Content: {
      Headers: {
        Subject: overrides.subject ? [overrides.subject] : ["Test Subject"],
      },
      Body: overrides.body ?? "Test body",
      Size: 100,
      MIME: null,
    },
    Created: new Date().toISOString(),
    Raw: {
      From: overrides.from ?? "sender@example.com",
      To: [to],
      Data: "",
      Helo: "",
    },
  };
}

describe("mailhog helpers", () => {
  describe("getMessages", () => {
    test("fetches messages from MailHog API", async () => {
      const mockMessages = [createMockMessage()];
      mockFetch.mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              items: mockMessages,
              total: 1,
              count: 1,
              start: 0,
            }),
            { status: 200 },
          ),
        ),
      );

      const messages = await getMessages();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch.mock.calls[0][0]).toBe(
        "http://localhost:58443/api/v2/messages",
      );
      expect(messages).toHaveLength(1);
      expect(messages[0].ID).toBe("mock-id");
    });

    test("throws error on failed response", async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve(new Response("Not found", { status: 404 })),
      );

      await expect(getMessages()).rejects.toThrow(
        "Failed to fetch messages from MailHog: 404",
      );
    });
  });

  describe("deleteAllMessages", () => {
    test("sends DELETE request to MailHog API", async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve(new Response("", { status: 200 })),
      );

      await deleteAllMessages();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch.mock.calls[0][0]).toBe(
        "http://localhost:58443/api/v1/messages",
      );
      expect(mockFetch.mock.calls[0][1]).toEqual({ method: "DELETE" });
    });

    test("throws error on failed response", async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve(new Response("Error", { status: 500 })),
      );

      await expect(deleteAllMessages()).rejects.toThrow(
        "Failed to delete messages from MailHog: 500",
      );
    });
  });

  describe("getMessagesByRecipient", () => {
    test("filters messages by recipient email", async () => {
      const mockMessages = [
        createMockMessage({ to: "alice@example.com" }),
        createMockMessage({ to: "bob@example.com" }),
        createMockMessage({ to: "alice@example.com" }),
      ];
      mockFetch.mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ items: mockMessages }), {
            status: 200,
          }),
        ),
      );

      const messages = await getMessagesByRecipient("alice@example.com");

      expect(messages).toHaveLength(2);
      expect(messages[0].To[0].Mailbox).toBe("alice");
    });

    test("is case insensitive", async () => {
      const mockMessages = [createMockMessage({ to: "Alice@Example.COM" })];
      mockFetch.mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ items: mockMessages }), {
            status: 200,
          }),
        ),
      );

      const messages = await getMessagesByRecipient("alice@example.com");

      expect(messages).toHaveLength(1);
    });

    test("returns empty array when no matches", async () => {
      const mockMessages = [createMockMessage({ to: "other@example.com" })];
      mockFetch.mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ items: mockMessages }), {
            status: 200,
          }),
        ),
      );

      const messages = await getMessagesByRecipient("alice@example.com");

      expect(messages).toHaveLength(0);
    });
  });

  describe("waitForEmail", () => {
    test("returns message when found immediately", async () => {
      const mockMessage = createMockMessage({ to: "test@example.com" });
      mockFetch.mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ items: [mockMessage] }), {
            status: 200,
          }),
        ),
      );

      const message = await waitForEmail("test@example.com", { timeout: 1000 });

      expect(message.ID).toBe("mock-id");
    });

    test("filters by subject when specified", async () => {
      const mockMessages = [
        createMockMessage({ to: "test@example.com", subject: "Welcome!" }),
        createMockMessage({ to: "test@example.com", subject: "Other" }),
      ];
      mockFetch.mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ items: mockMessages }), {
            status: 200,
          }),
        ),
      );

      const message = await waitForEmail("test@example.com", {
        timeout: 1000,
        subjectContains: "Welcome",
      });

      expect(getSubject(message)).toBe("Welcome!");
    });

    test("subject filter is case insensitive", async () => {
      const mockMessage = createMockMessage({
        to: "test@example.com",
        subject: "WELCOME!",
      });
      mockFetch.mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ items: [mockMessage] }), {
            status: 200,
          }),
        ),
      );

      const message = await waitForEmail("test@example.com", {
        timeout: 1000,
        subjectContains: "welcome",
      });

      expect(getSubject(message)).toBe("WELCOME!");
    });

    test("throws timeout error when message not found", async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ items: [] }), { status: 200 }),
        ),
      );

      await expect(
        waitForEmail("test@example.com", { timeout: 100, pollInterval: 50 }),
      ).rejects.toThrow("Timeout waiting for email to test@example.com");
    });

    test("includes subject in timeout error message when specified", async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ items: [] }), { status: 200 }),
        ),
      );

      await expect(
        waitForEmail("test@example.com", {
          timeout: 100,
          pollInterval: 50,
          subjectContains: "Welcome",
        }),
      ).rejects.toThrow(
        'Timeout waiting for email to test@example.com with subject containing "Welcome"',
      );
    });

    test("polls until message arrives", async () => {
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.resolve(
            new Response(JSON.stringify({ items: [] }), { status: 200 }),
          );
        }
        return Promise.resolve(
          new Response(
            JSON.stringify({
              items: [createMockMessage({ to: "test@example.com" })],
            }),
            { status: 200 },
          ),
        );
      });

      const message = await waitForEmail("test@example.com", {
        timeout: 2000,
        pollInterval: 50,
      });

      expect(message).toBeDefined();
      expect(callCount).toBeGreaterThanOrEqual(3);
    });
  });

  describe("getSubject", () => {
    test("returns subject from message headers", () => {
      const message = createMockMessage({ subject: "Test Subject" });
      expect(getSubject(message)).toBe("Test Subject");
    });

    test("returns empty string when subject is missing", () => {
      const message = createMockMessage();
      message.Content.Headers.Subject = undefined as unknown as string[];
      expect(getSubject(message)).toBe("");
    });
  });

  describe("getBody", () => {
    test("returns body content", () => {
      const message = createMockMessage({ body: "Hello, world!" });
      expect(getBody(message)).toBe("Hello, world!");
    });
  });

  describe("isMailHogAvailable", () => {
    test("returns true when MailHog responds with 200", async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve(new Response("", { status: 200 })),
      );

      const available = await isMailHogAvailable();

      expect(available).toBe(true);
      expect(mockFetch.mock.calls[0][1]).toEqual({ method: "HEAD" });
    });

    test("returns false when MailHog responds with error", async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve(new Response("", { status: 500 })),
      );

      const available = await isMailHogAvailable();

      expect(available).toBe(false);
    });

    test("returns false when fetch throws", async () => {
      mockFetch.mockImplementation(() =>
        Promise.reject(new Error("Network error")),
      );

      const available = await isMailHogAvailable();

      expect(available).toBe(false);
    });
  });
});
