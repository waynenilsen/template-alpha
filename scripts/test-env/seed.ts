/**
 * Test Database Seeder
 *
 * Seeds required data for running tests. This is separate from Stripe sync
 * because we don't need actual Stripe connections for tests.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../../lib/generated/prisma/client";
import type { ServiceResult, TestEnvConfig } from "./types";
import { getDefaultConfig, log } from "./utils";

// Plan definitions for seeding (matches lib/subscriptions/plans.ts)
const PLANS = [
  {
    slug: "free",
    name: "Free",
    description: "For personal projects",
    priceMonthly: 0,
    priceYearly: null,
    limits: {
      maxTodos: 10,
      maxMembers: 1,
      maxProjects: 1,
      maxStorageMB: 100,
      apiAccessEnabled: false,
    },
    order: 0,
    active: true,
    isDefault: true,
  },
  {
    slug: "pro",
    name: "Pro",
    description: "For professionals",
    priceMonthly: 999,
    priceYearly: 9990,
    limits: {
      maxTodos: 1000,
      maxMembers: 5,
      maxProjects: 10,
      maxStorageMB: 5000,
      apiAccessEnabled: true,
    },
    order: 1,
    active: true,
    isDefault: false,
  },
  {
    slug: "team",
    name: "Team",
    description: "For teams",
    priceMonthly: 2999,
    priceYearly: 29990,
    limits: {
      maxTodos: -1, // unlimited
      maxMembers: 25,
      maxProjects: 50,
      maxStorageMB: 50000,
      apiAccessEnabled: true,
    },
    order: 2,
    active: true,
    isDefault: false,
  },
];

/**
 * Seed the database with required data for tests
 */
export async function seed(
  config?: TestEnvConfig["postgres"],
): Promise<ServiceResult> {
  log.step("Seeding database with test data...");

  const cfg = config ?? getDefaultConfig().postgres;
  const connectionString = `postgresql://${cfg.user}:${cfg.password}@${cfg.host}:${cfg.port}/${cfg.database}`;

  let pool: Pool | null = null;
  let prisma: PrismaClient | null = null;

  try {
    pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter });

    // Seed plans
    log.info("Seeding subscription plans...");

    for (const plan of PLANS) {
      await prisma.plan.upsert({
        where: { slug: plan.slug },
        create: {
          slug: plan.slug,
          name: plan.name,
          description: plan.description,
          priceMonthly: plan.priceMonthly,
          priceYearly: plan.priceYearly,
          stripeProductId: null,
          stripePriceMonthlyId: null,
          stripePriceYearlyId: null,
          limits: plan.limits,
          sortOrder: plan.order,
          active: plan.active,
          isDefault: plan.isDefault,
        },
        update: {
          name: plan.name,
          description: plan.description,
          priceMonthly: plan.priceMonthly,
          priceYearly: plan.priceYearly,
          limits: plan.limits,
          sortOrder: plan.order,
          active: plan.active,
          isDefault: plan.isDefault,
        },
      });
    }

    log.success(`Seeded ${PLANS.length} plans`);
    return { success: true, message: "Database seeded successfully" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`Failed to seed database: ${message}`);
    return {
      success: false,
      message: "Failed to seed database",
      error: error instanceof Error ? error : new Error(message),
    };
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
    if (pool) {
      await pool.end();
    }
  }
}

// CLI entry point
if (import.meta.main) {
  seed()
    .then((result) => {
      if (!result.success) {
        process.exit(1);
      }
    })
    .catch((error) => {
      log.error(`Unhandled error: ${error.message}`);
      process.exit(1);
    });
}
