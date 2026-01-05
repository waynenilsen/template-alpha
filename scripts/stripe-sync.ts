#!/usr/bin/env bun
/**
 * Stripe Sync Script
 *
 * This script synchronizes the declarative plan configuration (plans.ts)
 * with Stripe and the database. It performs a diff-based sync:
 *
 * 1. Reads plan definitions from lib/subscriptions/plans.ts
 * 2. Fetches existing products/prices from Stripe (matched by slug metadata)
 * 3. Creates or updates Stripe products and prices as needed
 * 4. Syncs everything to the database Plan table
 *
 * Usage:
 *   bun run stripe:sync
 *
 * Environment variables required:
 *   - DATABASE_URL: PostgreSQL connection string
 *   - STRIPE_SECRET_KEY: Stripe API secret key
 *
 * This script is idempotent - run it as many times as needed.
 */

import Stripe from "stripe";
import { prisma } from "../lib/db";
import { PLANS, type PlanDefinition } from "../lib/subscriptions/plans";
import { PLAN_SLUG_METADATA_KEY } from "../lib/subscriptions/stripe";

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  red: "\x1b[31m",
  dim: "\x1b[2m",
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logStep(step: string) {
  log(`\n→ ${step}`, colors.blue);
}

function logSuccess(message: string) {
  log(`  ✓ ${message}`, colors.green);
}

function logSkip(message: string) {
  log(`  ○ ${message}`, colors.dim);
}

function logCreate(message: string) {
  log(`  + ${message}`, colors.green);
}

function logUpdate(message: string) {
  log(`  ~ ${message}`, colors.yellow);
}

function logError(message: string) {
  log(`  ✗ ${message}`, colors.red);
}

interface StripePlanData {
  productId: string | null;
  priceMonthlyId: string | null;
  priceYearlyId: string | null;
}

async function main() {
  console.log("\n=== Stripe Sync Script ===\n");

  // Check environment
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    logError("STRIPE_SECRET_KEY is not set");
    console.log("\nPlease set the STRIPE_SECRET_KEY environment variable:");
    console.log('  export STRIPE_SECRET_KEY="sk_test_..."');
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logError("DATABASE_URL is not set");
    process.exit(1);
  }

  // Initialize Stripe
  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: "2025-12-15.clover",
  });

  logStep("Verifying Stripe connection...");
  try {
    await stripe.accounts.retrieve();
    logSuccess("Connected to Stripe");
  } catch (error) {
    logError("Failed to connect to Stripe. Check your API key.");
    process.exit(1);
  }

  // Fetch existing products from Stripe
  logStep("Fetching existing Stripe products...");
  const existingProducts = await stripe.products.list({ limit: 100 });

  // Build a map of slug -> product
  const productsBySlug = new Map<string, Stripe.Product>();
  for (const product of existingProducts.data) {
    const slug = product.metadata[PLAN_SLUG_METADATA_KEY];
    if (slug) {
      productsBySlug.set(slug, product);
      logSuccess(`Found product for "${slug}": ${product.id}`);
    }
  }

  // Fetch existing prices from Stripe
  logStep("Fetching existing Stripe prices...");
  const existingPrices = await stripe.prices.list({
    limit: 100,
    active: true,
  });

  // Build a map of product ID -> prices
  const pricesByProduct = new Map<
    string,
    { monthly?: Stripe.Price; yearly?: Stripe.Price }
  >();
  for (const price of existingPrices.data) {
    const productId =
      typeof price.product === "string" ? price.product : price.product.id;
    if (!pricesByProduct.has(productId)) {
      pricesByProduct.set(productId, {});
    }
    const prices = pricesByProduct.get(productId)!;
    if (price.recurring?.interval === "month") {
      prices.monthly = price;
    } else if (price.recurring?.interval === "year") {
      prices.yearly = price;
    }
  }

  // Process each plan
  logStep("Syncing plans to Stripe...");
  const stripePlanData = new Map<string, StripePlanData>();

  for (const plan of PLANS) {
    console.log(`\n  Plan: ${plan.name} (${plan.slug})`);

    // Free plans don't need Stripe products
    if (plan.priceMonthly === 0) {
      logSkip("Free plan - no Stripe product needed");
      stripePlanData.set(plan.slug, {
        productId: null,
        priceMonthlyId: null,
        priceYearlyId: null,
      });
      continue;
    }

    let product = productsBySlug.get(plan.slug);
    let priceMonthly: Stripe.Price | undefined;
    let priceYearly: Stripe.Price | undefined;

    // Create or update product
    if (!product) {
      logCreate(`Creating Stripe product...`);
      product = await stripe.products.create({
        name: plan.name,
        description: plan.description,
        metadata: {
          [PLAN_SLUG_METADATA_KEY]: plan.slug,
        },
        active: plan.active,
      });
      logSuccess(`Created product: ${product.id}`);
    } else {
      // Check if product needs update
      if (
        product.name !== plan.name ||
        product.description !== plan.description ||
        product.active !== plan.active
      ) {
        logUpdate(`Updating product...`);
        product = await stripe.products.update(product.id, {
          name: plan.name,
          description: plan.description,
          active: plan.active,
        });
        logSuccess(`Updated product: ${product.id}`);
      } else {
        logSkip(`Product up to date: ${product.id}`);
      }
    }

    // Get existing prices for this product
    const existingProductPrices = pricesByProduct.get(product.id);

    // Create or verify monthly price
    if (existingProductPrices?.monthly) {
      priceMonthly = existingProductPrices.monthly;
      // Prices are immutable in Stripe, so we can only check if it matches
      if (priceMonthly.unit_amount !== plan.priceMonthly) {
        logUpdate(
          `Monthly price changed: ${priceMonthly.unit_amount} -> ${plan.priceMonthly}`,
        );
        logCreate(`Creating new monthly price...`);
        // Archive old price
        await stripe.prices.update(priceMonthly.id, { active: false });
        priceMonthly = await stripe.prices.create({
          product: product.id,
          unit_amount: plan.priceMonthly,
          currency: "usd",
          recurring: { interval: "month" },
        });
        logSuccess(`Created monthly price: ${priceMonthly.id}`);
      } else {
        logSkip(`Monthly price up to date: ${priceMonthly.id}`);
      }
    } else {
      logCreate(`Creating monthly price...`);
      priceMonthly = await stripe.prices.create({
        product: product.id,
        unit_amount: plan.priceMonthly,
        currency: "usd",
        recurring: { interval: "month" },
      });
      logSuccess(`Created monthly price: ${priceMonthly.id}`);
    }

    // Create or verify yearly price if applicable
    if (plan.priceYearly !== null) {
      if (existingProductPrices?.yearly) {
        priceYearly = existingProductPrices.yearly;
        if (priceYearly.unit_amount !== plan.priceYearly) {
          logUpdate(
            `Yearly price changed: ${priceYearly.unit_amount} -> ${plan.priceYearly}`,
          );
          logCreate(`Creating new yearly price...`);
          await stripe.prices.update(priceYearly.id, { active: false });
          priceYearly = await stripe.prices.create({
            product: product.id,
            unit_amount: plan.priceYearly,
            currency: "usd",
            recurring: { interval: "year" },
          });
          logSuccess(`Created yearly price: ${priceYearly.id}`);
        } else {
          logSkip(`Yearly price up to date: ${priceYearly.id}`);
        }
      } else {
        logCreate(`Creating yearly price...`);
        priceYearly = await stripe.prices.create({
          product: product.id,
          unit_amount: plan.priceYearly,
          currency: "usd",
          recurring: { interval: "year" },
        });
        logSuccess(`Created yearly price: ${priceYearly.id}`);
      }
    }

    stripePlanData.set(plan.slug, {
      productId: product.id,
      priceMonthlyId: priceMonthly?.id ?? null,
      priceYearlyId: priceYearly?.id ?? null,
    });
  }

  // Sync to database
  logStep("Syncing plans to database...");

  for (const plan of PLANS) {
    const stripeData = stripePlanData.get(plan.slug)!;

    const existingPlan = await prisma.plan.findUnique({
      where: { slug: plan.slug },
    });

    const planData = {
      slug: plan.slug,
      name: plan.name,
      description: plan.description,
      priceMonthly: plan.priceMonthly,
      priceYearly: plan.priceYearly,
      stripeProductId: stripeData.productId,
      stripePriceMonthlyId: stripeData.priceMonthlyId,
      stripePriceYearlyId: stripeData.priceYearlyId,
      limits: JSON.parse(JSON.stringify(plan.limits)),
      sortOrder: plan.order,
      active: plan.active,
      isDefault: plan.isDefault,
    };

    if (existingPlan) {
      logUpdate(`Updating plan: ${plan.name}`);
      await prisma.plan.update({
        where: { slug: plan.slug },
        data: planData,
      });
    } else {
      logCreate(`Creating plan: ${plan.name}`);
      await prisma.plan.create({
        data: planData,
      });
    }
  }

  // Ensure all organizations have a subscription
  logStep("Ensuring all organizations have subscriptions...");

  const freePlan = await prisma.plan.findFirst({
    where: { isDefault: true },
  });

  if (!freePlan) {
    logError("No default plan found! Check your plans configuration.");
    process.exit(1);
  }

  const orgsWithoutSubscription = await prisma.organization.findMany({
    where: {
      subscription: null,
    },
  });

  if (orgsWithoutSubscription.length > 0) {
    log(
      `  Found ${orgsWithoutSubscription.length} organizations without subscriptions`,
    );

    for (const org of orgsWithoutSubscription) {
      await prisma.subscription.create({
        data: {
          organizationId: org.id,
          planId: freePlan.id,
          status: "active",
        },
      });
      logCreate(`Created free subscription for: ${org.name}`);
    }
  } else {
    logSkip("All organizations have subscriptions");
  }

  // Summary
  console.log("\n=== Sync Complete ===\n");
  log("Plans synced:", colors.green);
  for (const plan of PLANS) {
    const stripeData = stripePlanData.get(plan.slug)!;
    if (stripeData.productId) {
      console.log(`  • ${plan.name}: ${stripeData.productId}`);
    } else {
      console.log(`  • ${plan.name}: (free - no Stripe product)`);
    }
  }

  console.log("\nNext steps:");
  console.log("  1. Set up the webhook endpoint in Stripe Dashboard");
  console.log("     URL: https://your-domain.com/api/stripe/webhook");
  console.log("  2. Copy the webhook signing secret to STRIPE_WEBHOOK_SECRET");
  console.log("  3. Start your application!\n");

  await prisma.$disconnect();
  process.exit(0);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
