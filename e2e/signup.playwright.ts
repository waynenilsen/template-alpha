import { expect, test } from "@playwright/test";

test.describe("Sign Up Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/sign-up");
  });

  test("displays the signup form correctly", async ({ page }) => {
    // Check that the page has loaded (CardTitle uses a div, not a heading)
    await expect(
      page.getByText("Sign Up", { exact: true }).first(),
    ).toBeVisible();

    // Check that all form fields are visible
    await expect(page.getByTestId("signup-name-input")).toBeVisible();
    await expect(page.getByTestId("signup-email-input")).toBeVisible();
    await expect(page.getByTestId("signup-password-input")).toBeVisible();
    await expect(
      page.getByTestId("signup-confirm-password-input"),
    ).toBeVisible();
    await expect(page.getByTestId("signup-submit-button")).toBeVisible();

    // Check the submit button text
    await expect(page.getByTestId("signup-submit-button")).toHaveText(
      "Sign up",
    );
  });

  test("shows password mismatch error when passwords do not match", async ({
    page,
  }) => {
    // Fill in the form with mismatched passwords
    await page.getByTestId("signup-name-input").fill("Test User");
    await page.getByTestId("signup-email-input").fill("test@example.com");
    await page.getByTestId("signup-password-input").fill("SecurePass123!");
    await page
      .getByTestId("signup-confirm-password-input")
      .fill("DifferentPass123!");

    // Submit the form
    await page.getByTestId("signup-submit-button").click();

    // Check that the password mismatch error is displayed
    await expect(page.getByTestId("password-mismatch-error")).toBeVisible();
    await expect(page.getByTestId("password-mismatch-error")).toHaveText(
      "Passwords do not match",
    );
  });

  test("clears password mismatch error when user modifies confirm password", async ({
    page,
  }) => {
    // Fill in the form with mismatched passwords
    await page.getByTestId("signup-name-input").fill("Test User");
    await page.getByTestId("signup-email-input").fill("test@example.com");
    await page.getByTestId("signup-password-input").fill("SecurePass123!");
    await page
      .getByTestId("signup-confirm-password-input")
      .fill("DifferentPass123!");

    // Submit the form
    await page.getByTestId("signup-submit-button").click();

    // Verify error is shown
    await expect(page.getByTestId("password-mismatch-error")).toBeVisible();

    // Modify confirm password
    await page
      .getByTestId("signup-confirm-password-input")
      .fill("SecurePass123!");

    // Error should be cleared
    await expect(page.getByTestId("password-mismatch-error")).not.toBeVisible();
  });

  test("navigates to sign in page when clicking sign in link", async ({
    page,
  }) => {
    await page.getByTestId("signin-link").click();
    await expect(page).toHaveURL("/sign-in");
  });

  test("successfully creates a new account and shows dashboard", async ({
    page,
  }) => {
    // Generate a unique email to avoid conflicts
    const uniqueEmail = `test-${Date.now()}@example.com`;

    // Fill in the form
    await page.getByTestId("signup-name-input").fill("Test User");
    await page.getByTestId("signup-email-input").fill(uniqueEmail);
    await page.getByTestId("signup-password-input").fill("SecurePass123!");
    await page
      .getByTestId("signup-confirm-password-input")
      .fill("SecurePass123!");

    // Submit the form
    await page.getByTestId("signup-submit-button").click();

    // Button should show loading state
    await expect(page.getByTestId("signup-submit-button")).toHaveText(
      "Creating account...",
    );

    // Should redirect to home page after successful signup
    await expect(page).toHaveURL("/", { timeout: 10000 });

    // Verify user is logged in and sees the dashboard
    await expect(page.getByTestId("dashboard")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("dashboard-title")).toHaveText("Todo App");

    // New user should see "No Organizations Yet" since they haven't joined any
    await expect(page.getByTestId("no-organizations")).toBeVisible();
    await expect(page.getByText("No Organizations Yet")).toBeVisible();
  });

  test("shows error when trying to sign up with existing email", async ({
    page,
  }) => {
    // First, create an account
    const existingEmail = `duplicate-${Date.now()}@example.com`;

    await page.getByTestId("signup-name-input").fill("First User");
    await page.getByTestId("signup-email-input").fill(existingEmail);
    await page.getByTestId("signup-password-input").fill("SecurePass123!");
    await page
      .getByTestId("signup-confirm-password-input")
      .fill("SecurePass123!");
    await page.getByTestId("signup-submit-button").click();

    // Wait for redirect to home and verify dashboard is visible
    await expect(page).toHaveURL("/", { timeout: 10000 });
    await expect(page.getByTestId("dashboard")).toBeVisible({ timeout: 10000 });

    // Now try to sign up with the same email
    await page.goto("/sign-up");

    await page.getByTestId("signup-name-input").fill("Second User");
    await page.getByTestId("signup-email-input").fill(existingEmail);
    await page.getByTestId("signup-password-input").fill("AnotherPass123!");
    await page
      .getByTestId("signup-confirm-password-input")
      .fill("AnotherPass123!");
    await page.getByTestId("signup-submit-button").click();

    // Should show error about existing account
    await expect(page.getByTestId("signup-error")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByTestId("signup-error")).toContainText(
      "already exists",
    );
  });

  test("shows validation error for weak password", async ({ page }) => {
    await page.getByTestId("signup-name-input").fill("Test User");
    await page
      .getByTestId("signup-email-input")
      .fill(`test-${Date.now()}@example.com`);
    await page.getByTestId("signup-password-input").fill("weak");
    await page.getByTestId("signup-confirm-password-input").fill("weak");
    await page.getByTestId("signup-submit-button").click();

    // Should show password validation error
    await expect(page.getByTestId("signup-error")).toBeVisible({
      timeout: 10000,
    });
  });

  test("shows validation error for invalid email", async ({ page }) => {
    await page.getByTestId("signup-name-input").fill("Test User");
    await page.getByTestId("signup-email-input").fill("invalid-email");
    await page.getByTestId("signup-password-input").fill("SecurePass123!");
    await page
      .getByTestId("signup-confirm-password-input")
      .fill("SecurePass123!");
    await page.getByTestId("signup-submit-button").click();

    // HTML5 validation should prevent form submission - check that the email input is invalid
    const emailInput = page.getByTestId("signup-email-input");
    const isInvalid = await emailInput.evaluate(
      (el) => !(el as HTMLInputElement).checkValidity(),
    );
    expect(isInvalid).toBe(true);

    // Should still be on the sign-up page (form wasn't submitted)
    await expect(page).toHaveURL("/sign-up");
  });

  test("disables form inputs while submitting", async ({ page }) => {
    const uniqueEmail = `test-${Date.now()}@example.com`;

    await page.getByTestId("signup-name-input").fill("Test User");
    await page.getByTestId("signup-email-input").fill(uniqueEmail);
    await page.getByTestId("signup-password-input").fill("SecurePass123!");
    await page
      .getByTestId("signup-confirm-password-input")
      .fill("SecurePass123!");

    // Submit and quickly check that inputs are disabled
    await page.getByTestId("signup-submit-button").click();

    // Check loading state (may be quick, so we check immediately)
    await expect(page.getByTestId("signup-submit-button")).toBeDisabled();
  });
});
