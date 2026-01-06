/**
 * Utility functions for test environment management
 */

import type { TestEnvConfig } from "./types";

// ANSI color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
};

export const log = {
  info: (msg: string) =>
    console.log(`${colors.green}[INFO]${colors.reset} ${msg}`),
  warn: (msg: string) =>
    console.log(`${colors.yellow}[WARN]${colors.reset} ${msg}`),
  error: (msg: string) =>
    console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
  step: (msg: string) =>
    console.log(`${colors.cyan}[STEP]${colors.reset} ${msg}`),
  debug: (msg: string) =>
    console.log(`${colors.dim}[DEBUG] ${msg}${colors.reset}`),
  success: (msg: string) =>
    console.log(`${colors.green}[OK]${colors.reset} ${msg}`),
};

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
  } = {},
): Promise<T> {
  const { maxAttempts = 3, initialDelay = 1000, maxDelay = 10000 } = options;

  let lastError: Error | undefined;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxAttempts) {
        await sleep(Math.min(delay, maxDelay));
        delay *= 2;
      }
    }
  }

  throw lastError;
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => Promise<boolean>,
  options: { timeout?: number; interval?: number; message?: string } = {},
): Promise<boolean> {
  const { timeout = 30000, interval = 1000, message = "condition" } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return true;
    }
    await sleep(interval);
  }

  log.warn(`Timed out waiting for ${message} after ${timeout}ms`);
  return false;
}

/**
 * Execute a shell command and return the result
 */
export async function exec(
  command: string,
  options: { cwd?: string; timeout?: number; quiet?: boolean } = {},
): Promise<{
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  const { cwd, timeout = 60000, quiet = false } = options;

  try {
    const proc = Bun.spawn(["sh", "-c", command], {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
    });

    // Handle timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        proc.kill();
        reject(new Error(`Command timed out after ${timeout}ms: ${command}`));
      }, timeout);
    });

    const resultPromise = (async () => {
      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      const exitCode = await proc.exited;

      return {
        success: exitCode === 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode,
      };
    })();

    return await Promise.race([resultPromise, timeoutPromise]);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    if (!quiet) {
      log.error(`Command failed: ${command}`);
    }
    return {
      success: false,
      stdout: "",
      stderr: errMsg,
      exitCode: 1,
    };
  }
}

/**
 * Check if a port is in use
 */
export async function isPortInUse(port: number): Promise<boolean> {
  const result = await exec(`lsof -i :${port}`, { quiet: true });
  return result.success && result.stdout.length > 0;
}

/**
 * Check if Docker is available
 */
export async function isDockerAvailable(): Promise<boolean> {
  const result = await exec("docker info", { quiet: true, timeout: 5000 });
  return result.success;
}

/**
 * Get the default test environment configuration
 */
export function getDefaultConfig(): TestEnvConfig {
  return {
    postgres: {
      name: "PostgreSQL",
      enabled: true,
      host: "localhost",
      port: 54673,
      user: "postgres",
      password: "postgres",
      database: "template_alpha",
    },
    mailhog: {
      name: "MailHog",
      enabled: true,
      smtpPort: 50239,
      webPort: 58443,
    },
    minio: {
      name: "MinIO",
      enabled: true,
      apiPort: 52871,
      consolePort: 52872,
      accessKey: "minioadmin",
      secretKey: "minioadmin",
      publicBucket: "template-alpha-public",
      privateBucket: "template-alpha-private",
    },
  };
}
