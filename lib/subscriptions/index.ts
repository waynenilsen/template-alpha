/**
 * Subscription management module
 *
 * This module provides everything needed for Stripe-based subscriptions:
 *
 * - plans.ts: Declarative plan configuration (source of truth)
 * - stripe.ts: Stripe client and utilities
 * - service.ts: Runtime functions for limits and billing
 *
 * Setup:
 * 1. Configure STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in .env
 * 2. Run 'bun run stripe:sync' to sync plans to Stripe and DB
 * 3. Set up webhook endpoint in Stripe dashboard
 */

// Plan configuration
export {
  formatLimit,
  formatPrice,
  getActivePlans,
  getDefaultPlan,
  getPlanBySlug,
  PLANS,
  type PlanDefinition,
  type PlanFeature,
  type PlanLimit,
} from "./plans";
// Subscription service
export {
  checkMemberLimit,
  checkOrganizationLimit,
  checkTodoLimit,
  enforceMemberLimit,
  enforceOrganizationLimit,
  enforceTodoLimit,
  getOrCreateSubscription,
  getUsageStats,
  LimitExceededError,
  SubscriptionError,
} from "./service";
// Stripe client
export {
  getStripe,
  getWebhookSecret,
  isStripeConfigured,
  PLAN_SLUG_METADATA_KEY,
} from "./stripe";
// Stripe billing operations (separated for coverage isolation)
export {
  createBillingPortalSession,
  createCheckoutSession,
} from "./stripe-billing";
