/**
 * Authentication helpers for e2e tests
 * Provides utilities for signup/signin form interactions
 */

import type { Page } from "@playwright/test";

/**
 * Test data constants
 */
export const TEST_USER = {
  name: "Test User",
  password: "SecurePass123!",
  weakPassword: "weak",
} as const;

/**
 * Counter for generating unique emails within the same millisecond
 */
let emailCounter = 0;

/**
 * Generate a unique email address for testing
 * Uses timestamp + counter to ensure uniqueness even in rapid succession
 */
export function generateUniqueEmail(prefix = "test"): string {
  return `${prefix}-${Date.now()}-${emailCounter++}@example.com`;
}

/**
 * Signup form field locators
 */
export const signupLocators = {
  nameInput: "signup-name-input",
  emailInput: "signup-email-input",
  passwordInput: "signup-password-input",
  confirmPasswordInput: "signup-confirm-password-input",
  submitButton: "signup-submit-button",
  errorMessage: "signup-error",
  passwordMismatchError: "password-mismatch-error",
  signinLink: "signin-link",
} as const;

/**
 * Dashboard locators
 */
export const dashboardLocators = {
  dashboard: "dashboard",
  dashboardTitle: "dashboard-title",
} as const;

/**
 * Options for filling the signup form
 */
export interface SignupFormData {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

/**
 * Fill the signup form with provided data
 * Defaults to TEST_USER values if not specified
 */
export async function fillSignupForm(
  page: Page,
  data: SignupFormData = {},
): Promise<void> {
  const {
    name = TEST_USER.name,
    email = generateUniqueEmail(),
    password = TEST_USER.password,
    confirmPassword = password,
  } = data;

  await page.getByTestId(signupLocators.nameInput).fill(name);
  await page.getByTestId(signupLocators.emailInput).fill(email);
  await page.getByTestId(signupLocators.passwordInput).fill(password);
  await page
    .getByTestId(signupLocators.confirmPasswordInput)
    .fill(confirmPassword);
}

/**
 * Click the signup submit button
 */
export async function submitSignupForm(page: Page): Promise<void> {
  await page.getByTestId(signupLocators.submitButton).click();
}

/**
 * Fill and submit the signup form
 * Returns the email used (useful for subsequent assertions)
 */
export async function fillAndSubmitSignupForm(
  page: Page,
  data: SignupFormData = {},
): Promise<string> {
  const email = data.email ?? generateUniqueEmail();
  await fillSignupForm(page, { ...data, email });
  await submitSignupForm(page);
  return email;
}

/**
 * Wait for successful redirect to dashboard after signup/signin
 */
export async function waitForDashboard(
  page: Page,
  options: { timeout?: number } = {},
): Promise<void> {
  const { timeout = 10000 } = options;
  const { expect } = await import("@playwright/test");

  await expect(page).toHaveURL("/", { timeout });
  await expect(page.getByTestId(dashboardLocators.dashboard)).toBeVisible({
    timeout,
  });
}

/**
 * Complete full signup flow: fill form, submit, and wait for dashboard
 * Returns the email used
 */
export async function completeSignup(
  page: Page,
  data: SignupFormData = {},
): Promise<string> {
  const email = await fillAndSubmitSignupForm(page, data);
  await waitForDashboard(page);
  return email;
}
