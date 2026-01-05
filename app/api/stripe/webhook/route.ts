import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import {
  getStripe,
  getWebhookSecret,
  isStripeConfigured,
} from "@/lib/subscriptions";

/**
 * Stripe Webhook Handler
 *
 * Handles subscription lifecycle events from Stripe:
 * - checkout.session.completed: New subscription created
 * - customer.subscription.updated: Plan change, payment update
 * - customer.subscription.deleted: Subscription canceled
 * - invoice.payment_failed: Payment failed
 *
 * Webhook URL: /api/stripe/webhook
 * Configure this URL in Stripe Dashboard -> Webhooks
 */
export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return new Response("Stripe not configured", { status: 500 });
  }

  const stripe = getStripe();
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      payload,
      signature,
      getWebhookSecret(),
    );
  } catch (error) {
    console.error("Webhook signature verification failed:", error);
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription,
        );
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
        );
        break;

      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        // Ignore unhandled events
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return new Response("Webhook handler failed", { status: 500 });
  }
}

/**
 * Handle successful checkout - link Stripe subscription to our database
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const organizationId = session.metadata?.organizationId;
  const planSlug = session.metadata?.planSlug;

  if (!organizationId || !planSlug) {
    console.error("Missing metadata in checkout session:", session.id);
    return;
  }

  // Get the subscription ID from the session
  const stripeSubscriptionId = session.subscription as string;
  if (!stripeSubscriptionId) {
    console.error("No subscription in checkout session:", session.id);
    return;
  }

  // Get the plan
  const plan = await prisma.plan.findUnique({
    where: { slug: planSlug },
  });

  if (!plan) {
    console.error("Plan not found:", planSlug);
    return;
  }

  // Fetch the full subscription from Stripe
  const stripe = getStripe();
  const stripeSubscription = (await stripe.subscriptions.retrieve(
    stripeSubscriptionId,
  )) as Stripe.Subscription;

  // Get current period from subscription
  const currentPeriodStart = (
    stripeSubscription as unknown as { current_period_start?: number }
  ).current_period_start;
  const currentPeriodEnd = (
    stripeSubscription as unknown as { current_period_end?: number }
  ).current_period_end;

  // Update or create subscription
  await prisma.subscription.upsert({
    where: { organizationId },
    update: {
      planId: plan.id,
      stripeSubscriptionId,
      stripeCustomerId: stripeSubscription.customer as string,
      status: mapStripeStatus(stripeSubscription.status),
      interval:
        stripeSubscription.items.data[0]?.price.recurring?.interval === "year"
          ? "yearly"
          : "monthly",
      currentPeriodStart: currentPeriodStart
        ? new Date(currentPeriodStart * 1000)
        : null,
      currentPeriodEnd: currentPeriodEnd
        ? new Date(currentPeriodEnd * 1000)
        : null,
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
    },
    create: {
      organizationId,
      planId: plan.id,
      stripeSubscriptionId,
      stripeCustomerId: stripeSubscription.customer as string,
      status: mapStripeStatus(stripeSubscription.status),
      interval:
        stripeSubscription.items.data[0]?.price.recurring?.interval === "year"
          ? "yearly"
          : "monthly",
      currentPeriodStart: currentPeriodStart
        ? new Date(currentPeriodStart * 1000)
        : null,
      currentPeriodEnd: currentPeriodEnd
        ? new Date(currentPeriodEnd * 1000)
        : null,
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
    },
  });

  console.log(`Subscription created for org ${organizationId}: ${plan.name}`);
}

/**
 * Handle subscription update (plan change, payment method change, etc.)
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const organizationId = subscription.metadata?.organizationId;

  if (!organizationId) {
    // Try to find by Stripe subscription ID
    const existingSubscription = await prisma.subscription.findUnique({
      where: { stripeSubscriptionId: subscription.id },
    });

    if (!existingSubscription) {
      console.error("Cannot find subscription for update:", subscription.id);
      return;
    }

    await updateSubscriptionFromStripe(
      existingSubscription.organizationId,
      subscription,
    );
    return;
  }

  await updateSubscriptionFromStripe(organizationId, subscription);
}

/**
 * Handle subscription deletion (canceled)
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  // Find the subscription
  const existingSubscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (!existingSubscription) {
    console.error("Subscription not found for deletion:", subscription.id);
    return;
  }

  // Get the free plan
  const freePlan = await prisma.plan.findFirst({
    where: { isDefault: true },
  });

  if (!freePlan) {
    console.error("No default plan found for downgrade");
    return;
  }

  // Downgrade to free plan
  await prisma.subscription.update({
    where: { id: existingSubscription.id },
    data: {
      planId: freePlan.id,
      status: "canceled",
      stripeSubscriptionId: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    },
  });

  console.log(
    `Subscription canceled, downgraded to free: ${existingSubscription.organizationId}`,
  );
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  // Access subscription via type assertion since Stripe types may vary
  const stripeSubscriptionId = (
    invoice as unknown as { subscription?: string | null }
  ).subscription;

  if (!stripeSubscriptionId) {
    return;
  }

  const subscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId },
  });

  if (!subscription) {
    console.error(
      "Subscription not found for failed payment:",
      stripeSubscriptionId,
    );
    return;
  }

  // Mark as past due
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: "past_due",
    },
  });

  console.log(
    `Payment failed for subscription: ${subscription.organizationId}`,
  );
}

/**
 * Helper to update subscription from Stripe data
 */
async function updateSubscriptionFromStripe(
  organizationId: string,
  stripeSubscription: Stripe.Subscription,
) {
  // Get plan by price ID
  const priceId = stripeSubscription.items.data[0]?.price.id;

  const plan = await prisma.plan.findFirst({
    where: {
      OR: [{ stripePriceMonthlyId: priceId }, { stripePriceYearlyId: priceId }],
    },
  });

  if (!plan) {
    console.error("Plan not found for price:", priceId);
    return;
  }

  // Get current period from subscription
  const currentPeriodStart = (
    stripeSubscription as unknown as { current_period_start?: number }
  ).current_period_start;
  const currentPeriodEnd = (
    stripeSubscription as unknown as { current_period_end?: number }
  ).current_period_end;

  await prisma.subscription.update({
    where: { organizationId },
    data: {
      planId: plan.id,
      status: mapStripeStatus(stripeSubscription.status),
      interval:
        stripeSubscription.items.data[0]?.price.recurring?.interval === "year"
          ? "yearly"
          : "monthly",
      currentPeriodStart: currentPeriodStart
        ? new Date(currentPeriodStart * 1000)
        : null,
      currentPeriodEnd: currentPeriodEnd
        ? new Date(currentPeriodEnd * 1000)
        : null,
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
    },
  });

  console.log(`Subscription updated for org ${organizationId}: ${plan.name}`);
}

/**
 * Map Stripe subscription status to our enum
 */
function mapStripeStatus(
  stripeStatus: Stripe.Subscription.Status,
): "active" | "past_due" | "canceled" | "trialing" | "incomplete" | "paused" {
  switch (stripeStatus) {
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
      return "canceled";
    case "trialing":
      return "trialing";
    case "incomplete":
    case "incomplete_expired":
      return "incomplete";
    case "paused":
      return "paused";
    default:
      return "active";
  }
}
