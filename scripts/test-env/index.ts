/**
 * Test Environment Manager
 *
 * Orchestrates the setup and teardown of the test environment.
 * This module provides a clean interface for:
 * - Checking service health
 * - Booting services that aren't running
 * - Wiping databases and storage
 * - Pushing database schema
 *
 * Usage:
 *   bun run scripts/test-env/index.ts [options]
 *
 * Options:
 *   --wipe       Wipe database and S3 before tests (default: true)
 *   --no-wipe    Skip wiping
 *   --skip-mail  Skip MailHog setup
 *   --skip-s3    Skip MinIO setup
 *   --check      Only check service health, don't boot or wipe
 *   --verbose    Enable verbose logging
 */

import * as mailhog from "./mailhog";
import * as minio from "./minio";
import * as postgres from "./postgres";
import * as seeder from "./seed";
import type {
  HealthCheckResult,
  ServiceResult,
  TestEnvConfig,
  TestEnvOptions,
} from "./types";
import { getDefaultConfig, log } from "./utils";

/**
 * Test Environment API
 *
 * Provides a clean interface for managing the test environment.
 * Each function is designed to be composable and can be called independently.
 */
export const testEnv = {
  /**
   * Get the default configuration
   */
  getConfig: getDefaultConfig,

  /**
   * Check health of all services
   */
  async checkHealth(config?: TestEnvConfig): Promise<{
    postgres: HealthCheckResult;
    mailhog: HealthCheckResult;
    minio: HealthCheckResult;
    allHealthy: boolean;
  }> {
    const cfg = config ?? getDefaultConfig();

    const [pgHealth, mailHealth, minioHealth] = await Promise.all([
      postgres.checkHealth(cfg.postgres),
      mailhog.checkHealth(cfg.mailhog),
      minio.checkHealth(cfg.minio),
    ]);

    return {
      postgres: pgHealth,
      mailhog: mailHealth,
      minio: minioHealth,
      allHealthy: pgHealth.healthy && mailHealth.healthy && minioHealth.healthy,
    };
  },

  /**
   * Check PostgreSQL health
   */
  checkPostgresHealth: (config?: TestEnvConfig) =>
    postgres.checkHealth((config ?? getDefaultConfig()).postgres),

  /**
   * Check MailHog health
   */
  checkMailhogHealth: (config?: TestEnvConfig) =>
    mailhog.checkHealth((config ?? getDefaultConfig()).mailhog),

  /**
   * Check MinIO health
   */
  checkMinioHealth: (config?: TestEnvConfig) =>
    minio.checkHealth((config ?? getDefaultConfig()).minio),

  /**
   * Boot PostgreSQL
   */
  bootPostgres: (config?: TestEnvConfig) =>
    postgres.boot((config ?? getDefaultConfig()).postgres),

  /**
   * Boot MailHog
   */
  bootMailhog: (config?: TestEnvConfig) =>
    mailhog.boot((config ?? getDefaultConfig()).mailhog),

  /**
   * Boot MinIO
   */
  bootMinio: (config?: TestEnvConfig) =>
    minio.boot((config ?? getDefaultConfig()).minio),

  /**
   * Wipe PostgreSQL database (drops all DDL)
   */
  wipePostgres: (config?: TestEnvConfig) =>
    postgres.wipe((config ?? getDefaultConfig()).postgres),

  /**
   * Wipe MailHog emails
   */
  wipeMailhog: (config?: TestEnvConfig) =>
    mailhog.wipe((config ?? getDefaultConfig()).mailhog),

  /**
   * Wipe MinIO buckets
   */
  wipeMinio: (config?: TestEnvConfig) =>
    minio.wipe((config ?? getDefaultConfig()).minio),

  /**
   * Push Prisma schema to database
   */
  pushSchema: (config?: TestEnvConfig) =>
    postgres.pushSchema((config ?? getDefaultConfig()).postgres),

  /**
   * Seed the database with required test data (e.g., subscription plans)
   */
  seed: (config?: TestEnvConfig) =>
    seeder.seed((config ?? getDefaultConfig()).postgres),

  /**
   * Full environment setup for tests
   *
   * This is the main entry point for preparing the test environment:
   * 1. Boot PostgreSQL if not running
   * 2. Optionally wipe database (including DDL)
   * 3. Push Prisma schema
   * 4. Seed database with test data (subscription plans, etc.)
   * 5. Boot MailHog if not running (optional)
   * 6. Boot MinIO if not running (optional)
   * 7. Optionally wipe S3 buckets
   */
  async setup(options: TestEnvOptions = {}): Promise<{
    success: boolean;
    results: Record<string, ServiceResult>;
  }> {
    const {
      wipeDatabase = true,
      wipeS3 = true,
      skipMailhog = false,
      skipS3 = false,
      verbose = false,
    } = options;

    const config = getDefaultConfig();
    const results: Record<string, ServiceResult> = {};

    log.step("=== Test Environment Setup ===");

    // 1. Boot PostgreSQL
    const pgBootResult = await postgres.boot(config.postgres);
    results["postgres.boot"] = pgBootResult;
    if (!pgBootResult.success) {
      log.error("Failed to boot PostgreSQL");
      return { success: false, results };
    }

    // 2. Wipe database if requested
    if (wipeDatabase) {
      const wipeResult = await postgres.wipe(config.postgres);
      results["postgres.wipe"] = wipeResult;
      if (!wipeResult.success) {
        log.error("Failed to wipe database");
        return { success: false, results };
      }
    }

    // 3. Push schema
    const schemaResult = await postgres.pushSchema(config.postgres);
    results["postgres.pushSchema"] = schemaResult;
    if (!schemaResult.success) {
      log.error("Failed to push schema");
      return { success: false, results };
    }

    // 4. Seed database with required test data
    const seedResult = await seeder.seed(config.postgres);
    results["postgres.seed"] = seedResult;
    if (!seedResult.success) {
      log.error("Failed to seed database");
      return { success: false, results };
    }

    // 5. Boot MailHog (optional)
    if (!skipMailhog) {
      const mailBootResult = await mailhog.boot(config.mailhog);
      results["mailhog.boot"] = mailBootResult;
      if (!mailBootResult.success) {
        log.warn("MailHog setup failed - continuing anyway");
      }
    }

    // 6. Boot MinIO (optional)
    if (!skipS3) {
      const minioBootResult = await minio.boot(config.minio);
      results["minio.boot"] = minioBootResult;
      if (!minioBootResult.success) {
        log.warn("MinIO setup failed - continuing anyway");
      }

      // 7. Wipe S3 if requested
      if (wipeS3 && minioBootResult.success) {
        const s3WipeResult = await minio.wipe(config.minio);
        results["minio.wipe"] = s3WipeResult;
      }
    }

    log.success("=== Test Environment Ready ===");
    return { success: true, results };
  },
};

/**
 * CLI entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  const options: TestEnvOptions & { checkOnly?: boolean } = {
    wipeDatabase: !args.includes("--no-wipe"),
    wipeS3: !args.includes("--no-wipe"),
    skipMailhog: args.includes("--skip-mail"),
    skipS3: args.includes("--skip-s3"),
    verbose: args.includes("--verbose"),
    checkOnly: args.includes("--check"),
  };

  // Handle --help
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Test Environment Manager

Usage:
  bun run scripts/test-env/index.ts [options]

Options:
  --wipe       Wipe database and S3 before tests (default: true)
  --no-wipe    Skip wiping
  --skip-mail  Skip MailHog setup
  --skip-s3    Skip MinIO setup
  --check      Only check service health, don't boot or wipe
  --verbose    Enable verbose logging
  --help       Show this help message

Examples:
  # Full setup with wipe (default)
  bun run scripts/test-env/index.ts

  # Setup without wiping data
  bun run scripts/test-env/index.ts --no-wipe

  # Only check health
  bun run scripts/test-env/index.ts --check

  # Skip optional services
  bun run scripts/test-env/index.ts --skip-mail --skip-s3
`);
    process.exit(0);
  }

  // Check only mode
  if (options.checkOnly) {
    log.step("Checking service health...");
    const health = await testEnv.checkHealth();

    console.log("\nService Health:");
    console.log(
      `  PostgreSQL: ${health.postgres.healthy ? "✓" : "✗"} ${health.postgres.message}`,
    );
    console.log(
      `  MailHog:    ${health.mailhog.healthy ? "✓" : "✗"} ${health.mailhog.message}`,
    );
    console.log(
      `  MinIO:      ${health.minio.healthy ? "✓" : "✗"} ${health.minio.message}`,
    );

    process.exit(health.allHealthy ? 0 : 1);
  }

  // Full setup
  const result = await testEnv.setup(options);

  if (!result.success) {
    log.error("Test environment setup failed");
    process.exit(1);
  }

  log.success("Test environment setup complete");
}

// Run CLI if this is the main module
if (import.meta.main) {
  main().catch((error) => {
    log.error(`Unhandled error: ${error.message}`);
    process.exit(1);
  });
}

// Export for programmatic use
export default testEnv;
export type {
  HealthCheckResult,
  ServiceResult,
  TestEnvConfig,
  TestEnvOptions,
  TestService,
} from "./types";
export { getDefaultConfig } from "./utils";
