/**
 * Subscription and Plan factory for test harness
 */

import type {
  BillingInterval,
  Plan,
  PrismaClient,
  Subscription,
  SubscriptionStatus,
} from "../../../generated/prisma/client";
import type { PlanLimit } from "../../../subscriptions/plans";
import type { CreatePlanOptions, CreateSubscriptionOptions } from "../types";
import { generateUniqueId } from "../utils";

export function createPlanFactory(
  prisma: PrismaClient,
  prefix: string,
  planIds: Set<string>,
) {
  return async (options: CreatePlanOptions = {}): Promise<Plan> => {
    const uniqueId = generateUniqueId();
    const slug = options.slug ?? `${prefix}plan-${uniqueId}`;
    const name = options.name ?? `${prefix}Plan ${uniqueId}`;

    const limits = options.limits ?? {
      maxTodos: 10,
      maxMembers: 1,
      maxOrganizations: 1,
    };

    const plan = await prisma.plan.create({
      data: {
        slug,
        name,
        description: options.description ?? "Test plan",
        priceMonthly: options.priceMonthly ?? 0,
        priceYearly: options.priceYearly ?? null,
        limits: JSON.parse(JSON.stringify(limits)),
        sortOrder: options.sortOrder ?? 0,
        active: options.active ?? true,
        isDefault: options.isDefault ?? false,
        stripeProductId: options.stripeProductId ?? null,
        stripePriceMonthlyId: options.stripePriceMonthlyId ?? null,
        stripePriceYearlyId: options.stripePriceYearlyId ?? null,
      },
    });

    planIds.add(plan.id);
    return plan;
  };
}

export function createSubscriptionFactory(
  prisma: PrismaClient,
  _prefix: string,
  subscriptionIds: Set<string>,
) {
  return async (options: CreateSubscriptionOptions): Promise<Subscription> => {
    const subscription = await prisma.subscription.create({
      data: {
        organizationId: options.organizationId,
        planId: options.planId,
        status: options.status ?? "active",
        interval: options.interval ?? "monthly",
        stripeSubscriptionId: options.stripeSubscriptionId ?? null,
        stripeCustomerId: options.stripeCustomerId ?? null,
        currentPeriodStart: options.currentPeriodStart ?? null,
        currentPeriodEnd: options.currentPeriodEnd ?? null,
        cancelAtPeriodEnd: options.cancelAtPeriodEnd ?? false,
      },
    });

    subscriptionIds.add(subscription.id);
    return subscription;
  };
}
