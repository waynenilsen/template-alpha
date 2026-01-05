/**
 * Email normalization utilities
 *
 * Emails are case-insensitive according to RFC 5321.
 * We normalize all emails to lowercase for consistent storage and comparison.
 */

/**
 * Normalize an email address to lowercase for case-insensitive handling.
 *
 * @param email - The email address to normalize
 * @returns The email address in lowercase
 */
export function normalizeEmail(email: string): string {
  return email.toLowerCase();
}
