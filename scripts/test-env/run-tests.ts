#!/usr/bin/env bun
/**
 * Test Runner with Environment Setup
 *
 * This script provides a clean slate for running tests:
 * 1. Boots all required services (PostgreSQL, MailHog, MinIO)
 * 2. Wipes the database (including DDL)
 * 3. Pushes the Prisma schema
 * 4. Wipes S3 buckets
 * 5. Runs tests with coverage
 *
 * Usage:
 *   bun run scripts/test-env/run-tests.ts [bun test options]
 *
 * Options:
 *   --no-wipe    Skip wiping (useful for debugging)
 *   --skip-mail  Skip MailHog setup
 *   --skip-s3    Skip MinIO setup
 *   All other options are passed to `bun test`
 *
 * Examples:
 *   # Run all tests with full setup
 *   bun run scripts/test-env/run-tests.ts
 *
 *   # Run specific test file
 *   bun run scripts/test-env/run-tests.ts lib/test/harness.test.ts
 *
 *   # Run without wiping (faster for reruns)
 *   bun run scripts/test-env/run-tests.ts --no-wipe
 */

import { testEnv } from "./index";
import { log } from "./utils";

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Parse our options (remove them from args to pass rest to bun test)
  const noWipe = args.includes("--no-wipe");
  const skipMail = args.includes("--skip-mail");
  const skipS3 = args.includes("--skip-s3");

  // Remove our options from args to pass rest to bun test
  const bunTestArgs = args.filter(
    (arg) => !["--no-wipe", "--skip-mail", "--skip-s3"].includes(arg),
  );

  // Show help
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Test Runner with Environment Setup

This script sets up a clean test environment before running tests.

Usage:
  bun run scripts/test-env/run-tests.ts [options] [bun test options]

Environment Options:
  --no-wipe    Skip wiping database and S3
  --skip-mail  Skip MailHog setup
  --skip-s3    Skip MinIO setup

All other options are passed directly to \`bun test\`.

Examples:
  # Run all tests
  bun run scripts/test-env/run-tests.ts

  # Run with coverage
  bun run scripts/test-env/run-tests.ts --coverage

  # Run specific test
  bun run scripts/test-env/run-tests.ts lib/test/harness.test.ts

  # Run without wiping (faster for debugging)
  bun run scripts/test-env/run-tests.ts --no-wipe
`);
    process.exit(0);
  }

  console.log("");
  log.step("=== Test Runner ===");
  console.log("");

  // Setup environment
  const setupResult = await testEnv.setup({
    wipeDatabase: !noWipe,
    wipeS3: !noWipe,
    skipMailhog: skipMail,
    skipS3: skipS3,
  });

  if (!setupResult.success) {
    log.error("Failed to set up test environment");
    process.exit(1);
  }

  console.log("");
  log.step("Running tests...");
  console.log("");

  // Run bun test
  const testCommand = ["bun", "test", ...bunTestArgs];

  const proc = Bun.spawn(testCommand, {
    stdio: ["inherit", "inherit", "inherit"],
    env: {
      ...process.env,
      // Ensure the database URL is set
      DATABASE_URL:
        "postgresql://postgres:postgres@localhost:54673/template_alpha",
    },
  });

  const exitCode = await proc.exited;
  process.exit(exitCode);
}

main().catch((error) => {
  log.error(`Unhandled error: ${error.message}`);
  process.exit(1);
});
