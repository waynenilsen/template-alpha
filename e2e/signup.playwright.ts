import { expect, test } from "@playwright/test";
import {
  completeSignup,
  dashboardLocators,
  fillAndSubmitSignupForm,
  fillSignupForm,
  signupLocators,
  submitSignupForm,
  TEST_USER,
} from "./helpers";
import { deleteAllMessages, getSubject, waitForEmail } from "./helpers/mailhog";

test.describe("Sign Up Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Clear all emails before each test
    await deleteAllMessages();
    await page.goto("/sign-up");
  });

  test("displays the signup form correctly", async ({ page }) => {
    // Check that the page has loaded (CardTitle uses a div, not a heading)
    await expect(
      page.getByText("Sign Up", { exact: true }).first(),
    ).toBeVisible();

    // Check that all form fields are visible
    await expect(page.getByTestId(signupLocators.nameInput)).toBeVisible();
    await expect(page.getByTestId(signupLocators.emailInput)).toBeVisible();
    await expect(page.getByTestId(signupLocators.passwordInput)).toBeVisible();
    await expect(
      page.getByTestId(signupLocators.confirmPasswordInput),
    ).toBeVisible();
    await expect(page.getByTestId(signupLocators.submitButton)).toBeVisible();

    // Check the submit button text
    await expect(page.getByTestId(signupLocators.submitButton)).toHaveText(
      "Sign up",
    );
  });

  test("shows password mismatch error when passwords do not match", async ({
    page,
  }) => {
    await fillSignupForm(page, {
      confirmPassword: "DifferentPass123!",
    });
    await submitSignupForm(page);

    // Check that the password mismatch error is displayed
    await expect(
      page.getByTestId(signupLocators.passwordMismatchError),
    ).toBeVisible();
    await expect(
      page.getByTestId(signupLocators.passwordMismatchError),
    ).toHaveText("Passwords do not match");
  });

  test("clears password mismatch error when user modifies confirm password", async ({
    page,
  }) => {
    await fillSignupForm(page, {
      confirmPassword: "DifferentPass123!",
    });
    await submitSignupForm(page);

    // Verify error is shown
    await expect(
      page.getByTestId(signupLocators.passwordMismatchError),
    ).toBeVisible();

    // Modify confirm password to match
    await page
      .getByTestId(signupLocators.confirmPasswordInput)
      .fill(TEST_USER.password);

    // Error should be cleared
    await expect(
      page.getByTestId(signupLocators.passwordMismatchError),
    ).not.toBeVisible();
  });

  test("navigates to sign in page when clicking sign in link", async ({
    page,
  }) => {
    await page.getByTestId(signupLocators.signinLink).click();
    await expect(page).toHaveURL("/sign-in");
  });

  test("successfully creates a new account and shows dashboard", async ({
    page,
  }) => {
    const email = await completeSignup(page);

    // Verify user is logged in and sees the dashboard
    await expect(page.getByTestId(dashboardLocators.dashboardTitle)).toHaveText(
      "Todo App",
    );

    // New user should see their auto-created organization with the todo list
    // The stats section shows "Total", "Completed", "Pending", "Progress"
    await expect(page.getByText("Total")).toBeVisible();
    await expect(page.getByText("Pending")).toBeVisible();

    // Verify welcome email was sent
    const welcomeEmail = await waitForEmail(email, {
      subjectContains: "Welcome",
      timeout: 5000,
    });
    expect(getSubject(welcomeEmail)).toContain("Welcome to Template Alpha");
  });

  test("shows error when trying to sign up with existing email", async ({
    page,
  }) => {
    // First, create an account
    const existingEmail = await completeSignup(page, {
      name: "First User",
    });

    // Now try to sign up with the same email
    await page.goto("/sign-up");

    await fillAndSubmitSignupForm(page, {
      name: "Second User",
      email: existingEmail,
      password: "AnotherPass123!",
    });

    // Should show error about existing account
    await expect(page.getByTestId(signupLocators.errorMessage)).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByTestId(signupLocators.errorMessage)).toContainText(
      "already exists",
    );
  });

  test("shows validation error for weak password", async ({ page }) => {
    await fillAndSubmitSignupForm(page, {
      password: TEST_USER.weakPassword,
    });

    // Should show password validation error
    await expect(page.getByTestId(signupLocators.errorMessage)).toBeVisible({
      timeout: 10000,
    });
  });

  test("shows validation error for invalid email", async ({ page }) => {
    await fillSignupForm(page, {
      email: "invalid-email",
    });
    await submitSignupForm(page);

    // HTML5 validation should prevent form submission - check that the email input is invalid
    const emailInput = page.getByTestId(signupLocators.emailInput);
    const isInvalid = await emailInput.evaluate(
      (el) => !(el as HTMLInputElement).checkValidity(),
    );
    expect(isInvalid).toBe(true);

    // Should still be on the sign-up page (form wasn't submitted)
    await expect(page).toHaveURL("/sign-up");
  });

  test("disables form inputs while submitting", async ({ page }) => {
    await fillSignupForm(page);
    await submitSignupForm(page);

    // Check loading state (may be quick, so we check immediately)
    await expect(page.getByTestId(signupLocators.submitButton)).toBeDisabled();
  });
});
