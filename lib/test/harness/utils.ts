/**
 * Utility functions for the test harness
 */

/**
 * Generate a unique ID with a prefix
 * Uses timestamp + random string for uniqueness
 */
export function generateUniqueId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}${random}`;
}
