import { expect, test } from "@playwright/test";

// MailHog API configuration
const MAILHOG_API_URL = "http://localhost:58443/api/v2";

interface MailHogMessage {
  ID: string;
  From: { Mailbox: string; Domain: string };
  To: Array<{ Mailbox: string; Domain: string }>;
  Content: {
    Headers: {
      Subject: string[];
      From: string[];
      To: string[];
    };
    Body: string;
  };
  Created: string;
  Raw: {
    From: string;
    To: string[];
    Data: string;
  };
}

interface MailHogResponse {
  total: number;
  count: number;
  start: number;
  items: MailHogMessage[];
}

/**
 * Fetch emails from MailHog API
 */
async function getEmails(): Promise<MailHogMessage[]> {
  const response = await fetch(`${MAILHOG_API_URL}/messages`);
  if (!response.ok) {
    throw new Error(`Failed to fetch emails: ${response.statusText}`);
  }
  const data: MailHogResponse = await response.json();
  return data.items;
}

/**
 * Delete all emails from MailHog
 */
async function clearEmails(): Promise<void> {
  await fetch(`${MAILHOG_API_URL.replace("/v2", "/v1")}/messages`, {
    method: "DELETE",
  });
}

/**
 * Wait for an email to arrive for a specific recipient
 */
async function waitForEmail(
  toEmail: string,
  options: { timeout?: number; subject?: string } = {},
): Promise<MailHogMessage> {
  const { timeout = 10000, subject } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const emails = await getEmails();

    const matchingEmail = emails.find((email) => {
      const emailAddress = `${email.To[0].Mailbox}@${email.To[0].Domain}`;
      const matchesRecipient =
        emailAddress.toLowerCase() === toEmail.toLowerCase();
      const matchesSubject = subject
        ? email.Content.Headers.Subject[0]?.includes(subject)
        : true;
      return matchesRecipient && matchesSubject;
    });

    if (matchingEmail) {
      return matchingEmail;
    }

    // Wait 500ms before retrying
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    `Timeout waiting for email to ${toEmail}${subject ? ` with subject "${subject}"` : ""}`,
  );
}

/**
 * Decode quoted-printable encoding
 * In quoted-printable, =XX represents a hex byte, and =\r\n is a soft line break
 */
function decodeQuotedPrintable(str: string): string {
  // First, remove soft line breaks (=\r\n or =\n)
  str = str.replace(/=\r?\n/g, "");

  // Then decode =XX hex sequences
  return str.replace(/=([0-9A-Fa-f]{2})/g, (_, hex) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  );
}

/**
 * Extract password reset link from email body
 */
function extractResetLink(email: MailHogMessage): string {
  // The email body contains the reset link
  // Decode quoted-printable encoding from raw email data
  const body = decodeQuotedPrintable(email.Raw.Data);

  // First, try to find the token directly (most reliable)
  // The token is a 64-character hex string
  const tokenPattern = /token=([a-f0-9]{64})/i;
  const tokenMatch = body.match(tokenPattern);

  if (tokenMatch) {
    return `http://localhost:58665/reset-password?token=${tokenMatch[1]}`;
  }

  // Fallback: Try to find any hex token after token=
  const shortTokenPattern = /token=([a-f0-9]+)/i;
  const shortMatch = body.match(shortTokenPattern);

  if (shortMatch && shortMatch[1].length >= 32) {
    return `http://localhost:58665/reset-password?token=${shortMatch[1]}`;
  }

  // Last resort: match full URL
  const urlPattern = /https?:\/\/[^\s<>"]+\/reset-password\?token=[a-f0-9]+/gi;
  const matches = body.match(urlPattern);

  if (matches && matches.length > 0) {
    return matches[0];
  }

  throw new Error("No reset link found in email");
}

test.describe("Password Reset Flow", () => {
  const testPassword = "SecurePass123!";
  const newPassword = "NewSecurePass456!";

  test.beforeEach(async () => {
    // Clear all emails before each test
    await clearEmails();
  });

  test("full password reset flow", async ({ page }) => {
    // Generate unique email for this test
    const testEmail = `reset-test-${Date.now()}@example.com`;

    // Step 1: Create a user account via signup
    await page.goto("/sign-up");

    await page.getByTestId("signup-name-input").fill("Test User");
    await page.getByTestId("signup-email-input").fill(testEmail);
    await page.getByTestId("signup-password-input").fill(testPassword);
    await page.getByTestId("signup-confirm-password-input").fill(testPassword);
    await page.getByTestId("signup-submit-button").click();

    // Wait for signup to complete and redirect
    await expect(page).toHaveURL("/", { timeout: 10000 });
    await expect(page.getByTestId("dashboard")).toBeVisible({ timeout: 10000 });

    // Clear the welcome email that was sent
    await clearEmails();

    // Step 2: Navigate to forgot password page
    await page.goto("/forgot-password");

    // Step 3: Request password reset
    await page.getByTestId("forgot-password-email-input").fill(testEmail);
    await page.getByTestId("forgot-password-submit-button").click();

    // Wait for success message
    await expect(page.getByTestId("forgot-password-success")).toBeVisible({
      timeout: 10000,
    });

    // Step 4: Retrieve the email from MailHog
    const resetEmail = await waitForEmail(testEmail, {
      subject: "Reset your",
      timeout: 15000,
    });

    expect(resetEmail).toBeDefined();
    expect(resetEmail.Content.Headers.Subject[0]).toContain("Reset your");

    // Step 5: Extract reset link from email
    const resetLink = extractResetLink(resetEmail);
    expect(resetLink).toContain("/reset-password?token=");

    // Step 6: Navigate to reset password page
    await page.goto(resetLink);

    // Wait for the page to validate the token
    await expect(page.getByTestId("reset-password-input")).toBeVisible({
      timeout: 10000,
    });

    // Step 7: Reset the password
    await page.getByTestId("reset-password-input").fill(newPassword);
    await page.getByTestId("reset-password-confirm-input").fill(newPassword);
    await page.getByTestId("reset-password-submit-button").click();

    // Wait for success message
    await expect(page.getByTestId("reset-password-success")).toBeVisible({
      timeout: 10000,
    });

    // Step 8: Navigate to sign-in and verify new password works
    await page.getByTestId("reset-password-signin-button").click();

    await expect(page).toHaveURL("/sign-in", { timeout: 5000 });

    // Sign in with new password
    await page.getByTestId("signin-email-input").fill(testEmail);
    await page.getByTestId("signin-password-input").fill(newPassword);
    await page.getByTestId("signin-submit-button").click();

    // Should redirect to home page after successful signin
    await expect(page).toHaveURL("/", { timeout: 10000 });
    await expect(page.getByTestId("dashboard")).toBeVisible({ timeout: 10000 });
  });

  test("shows error for invalid reset token", async ({ page }) => {
    await page.goto("/reset-password?token=invalidtoken123");

    // Wait for validation to complete
    await expect(page.getByTestId("reset-password-error")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByTestId("reset-password-error")).toContainText(
      "Invalid",
    );
  });

  test("shows error when no token is provided", async ({ page }) => {
    await page.goto("/reset-password");

    await expect(page.getByTestId("reset-password-error")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByTestId("reset-password-error")).toContainText(
      "No reset token provided",
    );
  });

  test("shows password mismatch error", async ({ page }) => {
    const testEmail = `mismatch-test-${Date.now()}@example.com`;

    // Create user first
    await page.goto("/sign-up");
    await page.getByTestId("signup-name-input").fill("Test User");
    await page.getByTestId("signup-email-input").fill(testEmail);
    await page.getByTestId("signup-password-input").fill(testPassword);
    await page.getByTestId("signup-confirm-password-input").fill(testPassword);
    await page.getByTestId("signup-submit-button").click();
    await expect(page).toHaveURL("/", { timeout: 10000 });

    await clearEmails();

    // Request password reset
    await page.goto("/forgot-password");
    await page.getByTestId("forgot-password-email-input").fill(testEmail);
    await page.getByTestId("forgot-password-submit-button").click();
    await expect(page.getByTestId("forgot-password-success")).toBeVisible({
      timeout: 10000,
    });

    // Get reset email and navigate to reset page
    const resetEmail = await waitForEmail(testEmail, { timeout: 15000 });
    const resetLink = extractResetLink(resetEmail);
    await page.goto(resetLink);

    await expect(page.getByTestId("reset-password-input")).toBeVisible({
      timeout: 10000,
    });

    // Enter mismatched passwords
    await page.getByTestId("reset-password-input").fill("Password123!");
    await page
      .getByTestId("reset-password-confirm-input")
      .fill("DifferentPassword456!");
    await page.getByTestId("reset-password-submit-button").click();

    // Should show mismatch error
    await expect(
      page.getByTestId("reset-password-mismatch-error"),
    ).toBeVisible();
    await expect(page.getByTestId("reset-password-mismatch-error")).toHaveText(
      "Passwords do not match",
    );
  });

  test("cannot reuse a reset token", async ({ page }) => {
    const testEmail = `reuse-test-${Date.now()}@example.com`;

    // Create user first
    await page.goto("/sign-up");
    await page.getByTestId("signup-name-input").fill("Test User");
    await page.getByTestId("signup-email-input").fill(testEmail);
    await page.getByTestId("signup-password-input").fill(testPassword);
    await page.getByTestId("signup-confirm-password-input").fill(testPassword);
    await page.getByTestId("signup-submit-button").click();
    await expect(page).toHaveURL("/", { timeout: 10000 });

    await clearEmails();

    // Request password reset
    await page.goto("/forgot-password");
    await page.getByTestId("forgot-password-email-input").fill(testEmail);
    await page.getByTestId("forgot-password-submit-button").click();
    await expect(page.getByTestId("forgot-password-success")).toBeVisible({
      timeout: 10000,
    });

    // Get reset email and navigate to reset page
    const resetEmail = await waitForEmail(testEmail, { timeout: 15000 });
    const resetLink = extractResetLink(resetEmail);

    // Use the token once
    await page.goto(resetLink);
    await expect(page.getByTestId("reset-password-input")).toBeVisible({
      timeout: 10000,
    });
    await page.getByTestId("reset-password-input").fill(newPassword);
    await page.getByTestId("reset-password-confirm-input").fill(newPassword);
    await page.getByTestId("reset-password-submit-button").click();
    await expect(page.getByTestId("reset-password-success")).toBeVisible({
      timeout: 10000,
    });

    // Try to use the same token again
    await page.goto(resetLink);

    // Should show error that token is already used
    await expect(page.getByTestId("reset-password-error")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByTestId("reset-password-error")).toContainText(
      "already been used",
    );
  });

  test("forgot password always shows success to prevent email enumeration", async ({
    page,
  }) => {
    // Try to reset password for a non-existent email
    const nonExistentEmail = `nonexistent-${Date.now()}@example.com`;

    await page.goto("/forgot-password");
    await page
      .getByTestId("forgot-password-email-input")
      .fill(nonExistentEmail);
    await page.getByTestId("forgot-password-submit-button").click();

    // Should still show success message (to prevent email enumeration)
    await expect(page.getByTestId("forgot-password-success")).toBeVisible({
      timeout: 10000,
    });
  });
});
