/**
 * Stripe billing functions
 *
 * These functions require actual Stripe credentials to operate.
 * They are separated from service.ts to allow that file to maintain test coverage.
 */

import type { PrismaClient } from "../generated/prisma/client";
import { getOrCreateSubscription, SubscriptionError } from "./service";
import { getStripe } from "./stripe";

/**
 * Create a Stripe Checkout session for upgrading
 */
export async function createCheckoutSession(
  prisma: PrismaClient,
  organizationId: string,
  planSlug: string,
  interval: "monthly" | "yearly",
  successUrl: string,
  cancelUrl: string,
): Promise<string> {
  const stripe = getStripe();

  // Get the target plan
  const plan = await prisma.plan.findUnique({
    where: { slug: planSlug },
  });

  if (!plan) {
    throw new SubscriptionError(
      `Plan not found: ${planSlug}`,
      "PLAN_NOT_FOUND",
    );
  }

  if (plan.priceMonthly === 0) {
    throw new SubscriptionError("Cannot checkout for free plan", "FREE_PLAN");
  }

  const priceId =
    interval === "yearly"
      ? plan.stripePriceYearlyId
      : plan.stripePriceMonthlyId;

  if (!priceId) {
    throw new SubscriptionError(
      `No ${interval} price for plan: ${planSlug}`,
      "NO_PRICE",
    );
  }

  // Get or create subscription record
  const subscription = await getOrCreateSubscription(prisma, organizationId);

  // Get the organization for customer metadata
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      members: {
        where: { role: "owner" },
        include: { user: true },
        take: 1,
      },
    },
  });

  if (!organization) {
    throw new SubscriptionError("Organization not found", "ORG_NOT_FOUND");
  }

  const ownerEmail = organization.members[0]?.user.email;

  // Create or get Stripe customer
  let customerId = subscription.stripeCustomerId;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: ownerEmail,
      metadata: {
        organizationId,
        organizationName: organization.name,
      },
    });
    customerId = customer.id;

    // Save customer ID
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { stripeCustomerId: customerId },
    });
  }

  // Create checkout session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      organizationId,
      planSlug,
    },
    subscription_data: {
      metadata: {
        organizationId,
        planSlug,
      },
    },
  });

  if (!session.url) {
    throw new SubscriptionError(
      "Failed to create checkout session",
      "CHECKOUT_FAILED",
    );
  }

  return session.url;
}

/**
 * Create a Stripe billing portal session
 */
export async function createBillingPortalSession(
  prisma: PrismaClient,
  organizationId: string,
  returnUrl: string,
): Promise<string> {
  const stripe = getStripe();

  const subscription = await getOrCreateSubscription(prisma, organizationId);

  if (!subscription.stripeCustomerId) {
    throw new SubscriptionError(
      "No billing account. Subscribe to a paid plan first.",
      "NO_CUSTOMER",
    );
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: returnUrl,
  });

  return session.url;
}
