/**
 * MailHog API helper for e2e tests
 * Provides utilities to interact with MailHog's HTTP API for email verification
 */

const MAILHOG_API_URL = process.env.MAILHOG_API_URL || "http://localhost:58443";

interface MailHogAddress {
  Relays: string[] | null;
  Mailbox: string;
  Domain: string;
  Params: string;
}

interface MailHogContent {
  Headers: Record<string, string[]>;
  Body: string;
  Size: number;
  MIME: unknown | null;
}

interface MailHogMessage {
  ID: string;
  From: MailHogAddress;
  To: MailHogAddress[];
  Content: MailHogContent;
  Created: string;
  Raw: {
    From: string;
    To: string[];
    Data: string;
    Helo: string;
  };
}

interface MailHogMessagesResponse {
  total: number;
  count: number;
  start: number;
  items: MailHogMessage[];
}

/**
 * Fetch all messages from MailHog
 */
export async function getMessages(): Promise<MailHogMessage[]> {
  const response = await fetch(`${MAILHOG_API_URL}/api/v2/messages`);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch messages from MailHog: ${response.status}`,
    );
  }
  const data: MailHogMessagesResponse = await response.json();
  return data.items;
}

/**
 * Delete all messages from MailHog
 */
export async function deleteAllMessages(): Promise<void> {
  const response = await fetch(`${MAILHOG_API_URL}/api/v1/messages`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(
      `Failed to delete messages from MailHog: ${response.status}`,
    );
  }
}

/**
 * Find messages sent to a specific email address
 */
export async function getMessagesByRecipient(
  email: string,
): Promise<MailHogMessage[]> {
  const messages = await getMessages();
  return messages.filter((msg) =>
    msg.To.some(
      (to) =>
        `${to.Mailbox}@${to.Domain}`.toLowerCase() === email.toLowerCase(),
    ),
  );
}

/**
 * Wait for an email to arrive for a specific recipient
 * Polls MailHog until a message is found or timeout is reached
 */
export async function waitForEmail(
  email: string,
  options: {
    timeout?: number;
    pollInterval?: number;
    subjectContains?: string;
  } = {},
): Promise<MailHogMessage> {
  const { timeout = 10000, pollInterval = 500, subjectContains } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const messages = await getMessagesByRecipient(email);

    // Filter by subject if specified
    const matchingMessages = subjectContains
      ? messages.filter((msg) => {
          const subject = msg.Content.Headers.Subject?.[0] || "";
          return subject.toLowerCase().includes(subjectContains.toLowerCase());
        })
      : messages;

    if (matchingMessages.length > 0) {
      return matchingMessages[0];
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error(
    `Timeout waiting for email to ${email}${subjectContains ? ` with subject containing "${subjectContains}"` : ""}`,
  );
}

/**
 * Get the subject of an email message
 */
export function getSubject(message: MailHogMessage): string {
  return message.Content.Headers.Subject?.[0] || "";
}

/**
 * Get the plain text body of an email message
 */
export function getBody(message: MailHogMessage): string {
  return message.Content.Body;
}

/**
 * Check if MailHog is available
 */
export async function isMailHogAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${MAILHOG_API_URL}/api/v2/messages`, {
      method: "HEAD",
    });
    return response.ok;
  } catch {
    return false;
  }
}
