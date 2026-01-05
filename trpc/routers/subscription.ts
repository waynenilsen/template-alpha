import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";
import {
  createBillingPortalSession,
  createCheckoutSession,
  getOrCreateSubscription,
  getUsageStats,
  isStripeConfigured,
  SubscriptionError,
} from "../../lib/subscriptions";
import type { PlanLimit } from "../../lib/subscriptions/plans";
import { auth, orgContext, tmid, withPrisma } from "../../lib/trpc";
import { createTRPCRouter, publicProcedure } from "../init";

/**
 * Subscription router
 *
 * Handles subscription management, plan changes, and usage tracking.
 * Requires Stripe to be configured (run stripe:sync first).
 */
export const subscriptionRouter = createTRPCRouter({
  /**
   * Get all available plans
   */
  getPlans: publicProcedure.query(async () => {
    return tmid()
      .use(withPrisma())
      .build(async ({ prisma }) => {
        const plans = await prisma.plan.findMany({
          where: { active: true },
          orderBy: { sortOrder: "asc" },
        });

        return plans.map((plan) => ({
          id: plan.id,
          slug: plan.slug,
          name: plan.name,
          description: plan.description,
          priceMonthly: plan.priceMonthly,
          priceYearly: plan.priceYearly,
          limits: plan.limits as unknown as PlanLimit,
          isDefault: plan.isDefault,
        }));
      });
  }),

  /**
   * Get the current organization's subscription
   */
  getCurrent: publicProcedure.query(async () => {
    return tmid()
      .use(withPrisma())
      .use(auth())
      .use(orgContext())
      .build(async ({ prisma, organizationId }) => {
        const subscription = await getOrCreateSubscription(
          prisma,
          organizationId,
        );

        const usage = await getUsageStats(prisma, organizationId);

        return {
          id: subscription.id,
          status: subscription.status,
          interval: subscription.interval,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          plan: {
            slug: subscription.plan.slug,
            name: subscription.plan.name,
            limits: subscription.plan.limits as PlanLimit,
          },
          usage,
          hasStripeSubscription: !!subscription.stripeSubscriptionId,
        };
      });
  }),

  /**
   * Create a checkout session for upgrading to a paid plan
   */
  createCheckout: publicProcedure
    .input(
      z.object({
        planSlug: z.string(),
        interval: z.enum(["monthly", "yearly"]),
        successUrl: z.string().url(),
        cancelUrl: z.string().url(),
      }),
    )
    .mutation(async ({ input }) => {
      return tmid()
        .use(withPrisma())
        .use(auth())
        .use(orgContext())
        .build(async ({ prisma, organizationId }) => {
          if (!isStripeConfigured()) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message:
                "Stripe is not configured. Run 'bun run stripe:sync' to set up billing.",
            });
          }

          /* c8 ignore start - requires actual Stripe credentials */
          try {
            const url = await createCheckoutSession(
              prisma,
              organizationId,
              input.planSlug,
              input.interval,
              input.successUrl,
              input.cancelUrl,
            );

            return { url };
          } catch (error) {
            if (error instanceof SubscriptionError) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: error.message,
              });
            }
            throw error;
          }
          /* c8 ignore stop */
        });
    }),

  /**
   * Create a billing portal session for managing subscription
   */
  createBillingPortal: publicProcedure
    .input(
      z.object({
        returnUrl: z.string().url(),
      }),
    )
    .mutation(async ({ input }) => {
      return tmid()
        .use(withPrisma())
        .use(auth())
        .use(orgContext())
        .build(async ({ prisma, organizationId }) => {
          if (!isStripeConfigured()) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message:
                "Stripe is not configured. Run 'bun run stripe:sync' to set up billing.",
            });
          }

          /* c8 ignore start - requires actual Stripe credentials */
          try {
            const url = await createBillingPortalSession(
              prisma,
              organizationId,
              input.returnUrl,
            );

            return { url };
          } catch (error) {
            if (error instanceof SubscriptionError) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: error.message,
              });
            }
            throw error;
          }
          /* c8 ignore stop */
        });
    }),

  /**
   * Get usage statistics for the current organization
   */
  getUsage: publicProcedure.query(async () => {
    return tmid()
      .use(withPrisma())
      .use(auth())
      .use(orgContext())
      .build(async ({ prisma, organizationId }) => {
        return getUsageStats(prisma, organizationId);
      });
  }),
});
