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
import { createTRPCRouter, orgProcedure, publicProcedure } from "../init";

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
  getPlans: publicProcedure.query(async ({ ctx }) => {
    const plans = await ctx.prisma.plan.findMany({
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
  }),

  /**
   * Get the current organization's subscription
   */
  getCurrent: orgProcedure.query(async ({ ctx }) => {
    const subscription = await getOrCreateSubscription(
      ctx.prisma,
      ctx.organizationId,
    );

    const usage = await getUsageStats(ctx.prisma, ctx.organizationId);

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
  }),

  /**
   * Create a checkout session for upgrading to a paid plan
   */
  createCheckout: orgProcedure
    .input(
      z.object({
        planSlug: z.string(),
        interval: z.enum(["monthly", "yearly"]),
        successUrl: z.string().url(),
        cancelUrl: z.string().url(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
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
          ctx.prisma,
          ctx.organizationId,
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
    }),

  /**
   * Create a billing portal session for managing subscription
   */
  createBillingPortal: orgProcedure
    .input(
      z.object({
        returnUrl: z.string().url(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
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
          ctx.prisma,
          ctx.organizationId,
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
    }),

  /**
   * Get usage statistics for the current organization
   */
  getUsage: orgProcedure.query(async ({ ctx }) => {
    return getUsageStats(ctx.prisma, ctx.organizationId);
  }),
});
