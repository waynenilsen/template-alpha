/**
 * Shared Prisma client management for tests
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../../generated/prisma/client";

// Shared Prisma client and pool for all tests
let sharedPrisma: PrismaClient | null = null;
let sharedPool: Pool | null = null;

/**
 * Get the shared Prisma client instance
 * Creates one if it doesn't exist
 */
export function getTestPrisma(): PrismaClient {
  if (!sharedPrisma) {
    const connectionString = process.env.DATABASE_URL;
    sharedPool = new Pool({ connectionString });
    const adapter = new PrismaPg(sharedPool);
    sharedPrisma = new PrismaClient({ adapter });
  }
  return sharedPrisma;
}

/**
 * Disconnect the shared Prisma client
 * Call this in afterAll() of your test suite
 */
export async function disconnectTestPrisma(): Promise<void> {
  if (sharedPrisma) {
    await sharedPrisma.$disconnect();
    sharedPrisma = null;
  }
  if (sharedPool) {
    await sharedPool.end();
    sharedPool = null;
  }
}
