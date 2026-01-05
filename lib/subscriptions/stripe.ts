/**
 * Stripe client and utilities
 *
 * IMPORTANT: The STRIPE_SECRET_KEY must be set in the environment.
 * If not set, this module will throw at runtime.
 * This is intentional - run the bootstrap script first!
 */

import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

/**
 * Get the Stripe client instance.
 * Throws if STRIPE_SECRET_KEY is not configured.
 *
 * If STRIPE_MOCK_URL is set, the client will connect to stripe-mock
 * instead of the real Stripe API. Use `bun stripe:mock` to start stripe-mock.
 */
/* c8 ignore start - requires actual Stripe credentials */
export function getStripe(): Stripe {
  if (stripeInstance) {
    return stripeInstance;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Please configure Stripe and run the bootstrap script: bun run stripe:sync",
    );
  }

  const mockUrl = process.env.STRIPE_MOCK_URL;

  stripeInstance = new Stripe(secretKey, {
    apiVersion: "2025-12-15.clover",
    typescript: true,
    // Connect to stripe-mock if STRIPE_MOCK_URL is set
    ...(mockUrl && {
      host: new URL(mockUrl).hostname,
      port: Number.parseInt(new URL(mockUrl).port, 10) || 80,
      protocol: new URL(mockUrl).protocol.replace(":", "") as "http" | "https",
    }),
  });

  return stripeInstance;
}
/* c8 ignore stop */

/**
 * Check if Stripe is configured
 */
export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

/**
 * Metadata key used to store plan slug in Stripe products
 */
export const PLAN_SLUG_METADATA_KEY = "plan_slug";

/**
 * Get the webhook secret for verifying Stripe webhooks
 */
/* c8 ignore start - requires actual Stripe webhook secret */
export function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error(
      "STRIPE_WEBHOOK_SECRET is not set. Please configure webhook secret.",
    );
  }
  return secret;
}
/* c8 ignore stop */
