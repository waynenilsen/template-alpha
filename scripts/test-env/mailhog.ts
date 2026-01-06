/**
 * MailHog Service Management
 *
 * Provides health checks and bootstrapping for MailHog email testing server.
 */

import type { HealthCheckResult, ServiceResult, TestEnvConfig } from "./types";
import { exec, isDockerAvailable, isPortInUse, log, waitFor } from "./utils";

/**
 * Check if MailHog is healthy
 */
export async function checkHealth(
  config: TestEnvConfig["mailhog"],
): Promise<HealthCheckResult> {
  const { webPort } = config;

  try {
    const response = await fetch(
      `http://localhost:${webPort}/api/v2/messages?limit=1`,
      {
        signal: AbortSignal.timeout(3000),
      },
    );

    if (response.ok) {
      return {
        healthy: true,
        message: `MailHog is healthy on port ${webPort}`,
        details: { webPort, smtpPort: config.smtpPort },
      };
    }
  } catch {
    // Fall through to unhealthy
  }

  return {
    healthy: false,
    message: `MailHog is not responding on port ${webPort}`,
  };
}

/**
 * Boot MailHog service
 */
export async function boot(
  config: TestEnvConfig["mailhog"],
): Promise<ServiceResult> {
  const { smtpPort, webPort } = config;

  // Check if already running
  const health = await checkHealth(config);
  if (health.healthy) {
    return { success: true, message: "MailHog is already running" };
  }

  log.step("Starting MailHog...");

  // Check if Docker is available
  const hasDocker = await isDockerAvailable();

  if (hasDocker) {
    return await bootWithDocker(config);
  }
  return await bootWithoutDocker(config);
}

/**
 * Boot MailHog using Docker Compose
 */
async function bootWithDocker(
  config: TestEnvConfig["mailhog"],
): Promise<ServiceResult> {
  log.info("Docker detected - starting MailHog with docker compose...");

  const result = await exec("docker compose up -d mailhog", {
    timeout: 120000,
  });
  if (!result.success) {
    return {
      success: false,
      message: "Failed to start MailHog with Docker",
      error: new Error(result.stderr),
    };
  }

  // Wait for MailHog to be ready
  const ready = await waitFor(
    () => checkHealth(config).then((h) => h.healthy),
    {
      timeout: 30000,
      interval: 1000,
      message: "MailHog to be ready",
    },
  );

  if (!ready) {
    return {
      success: false,
      message: "MailHog failed to start within 30 seconds",
    };
  }

  return { success: true, message: "MailHog started with Docker" };
}

/**
 * Boot MailHog locally (for environments without Docker)
 */
async function bootWithoutDocker(
  config: TestEnvConfig["mailhog"],
): Promise<ServiceResult> {
  const { smtpPort, webPort } = config;

  log.info("Docker not available - setting up MailHog locally...");

  // Check if ports are in use
  const smtpInUse = await isPortInUse(smtpPort);
  const webInUse = await isPortInUse(webPort);

  if (smtpInUse || webInUse) {
    // Maybe MailHog is already running?
    const health = await checkHealth(config);
    if (health.healthy) {
      return { success: true, message: "MailHog is already running" };
    }
    return {
      success: false,
      message: `Ports ${smtpPort} or ${webPort} are in use by another process`,
    };
  }

  const mailhogBin = `${process.env.HOME}/.local/bin/MailHog`;

  // Install MailHog if not present
  const exists = await exec(`test -f "${mailhogBin}"`, { quiet: true });
  if (!exists.success) {
    log.info("Installing MailHog...");

    await exec(`mkdir -p "${process.env.HOME}/.local/bin"`);

    // Detect architecture
    const archResult = await exec("uname -m", { quiet: true });
    const arch = archResult.stdout.trim();
    const mailhogArch = arch === "x86_64" ? "linux_amd64" : "linux_arm64";

    const url = `https://github.com/mailhog/MailHog/releases/download/v1.0.1/MailHog_${mailhogArch}`;

    const downloadResult = await exec(
      `curl -sL "${url}" -o "${mailhogBin}" && chmod +x "${mailhogBin}"`,
      {
        timeout: 60000,
      },
    );

    if (!downloadResult.success) {
      return {
        success: false,
        message: "Failed to download MailHog",
        error: new Error(downloadResult.stderr),
      };
    }

    log.info("MailHog installed");
  }

  // Create log directory
  await exec(`mkdir -p "${process.env.HOME}/.local/log"`);

  // Start MailHog in background
  log.info(`Starting MailHog on SMTP:${smtpPort}, Web:${webPort}...`);

  const startResult = await exec(
    `nohup "${mailhogBin}" -smtp-bind-addr "0.0.0.0:${smtpPort}" -api-bind-addr "0.0.0.0:${webPort}" -ui-bind-addr "0.0.0.0:${webPort}" > "${process.env.HOME}/.local/log/mailhog.log" 2>&1 & echo $!`,
    { quiet: true },
  );

  if (startResult.success && startResult.stdout) {
    // Save PID
    await exec(
      `echo "${startResult.stdout.trim()}" > "${process.env.HOME}/.local/mailhog.pid"`,
    );
  }

  // Wait for MailHog to be ready
  const ready = await waitFor(
    () => checkHealth(config).then((h) => h.healthy),
    {
      timeout: 10000,
      interval: 500,
      message: "MailHog to be ready",
    },
  );

  if (!ready) {
    return {
      success: false,
      message: "MailHog failed to start",
    };
  }

  return {
    success: true,
    message: `MailHog started locally on ports SMTP:${smtpPort}, Web:${webPort}`,
  };
}

/**
 * Wipe all emails from MailHog
 */
export async function wipe(
  config: TestEnvConfig["mailhog"],
): Promise<ServiceResult> {
  const { webPort } = config;

  log.step("Wiping MailHog emails...");

  const health = await checkHealth(config);
  if (!health.healthy) {
    // If MailHog isn't running, that's fine - nothing to wipe
    return { success: true, message: "MailHog not running - nothing to wipe" };
  }

  try {
    const response = await fetch(
      `http://localhost:${webPort}/api/v1/messages`,
      {
        method: "DELETE",
        signal: AbortSignal.timeout(5000),
      },
    );

    if (response.ok) {
      log.success("MailHog emails wiped");
      return { success: true, message: "All emails deleted from MailHog" };
    }

    return {
      success: false,
      message: `Failed to wipe MailHog: ${response.statusText}`,
    };
  } catch (error) {
    return {
      success: false,
      message: "Failed to wipe MailHog emails",
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
