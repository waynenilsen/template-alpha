/**
 * MinIO (S3) Service Management
 *
 * Provides health checks, bootstrapping, and bucket wiping for MinIO.
 */

import type { HealthCheckResult, ServiceResult, TestEnvConfig } from "./types";
import { exec, isDockerAvailable, isPortInUse, log, waitFor } from "./utils";

/**
 * Check if MinIO is healthy
 */
export async function checkHealth(
  config: TestEnvConfig["minio"],
): Promise<HealthCheckResult> {
  const { apiPort } = config;

  try {
    const response = await fetch(
      `http://localhost:${apiPort}/minio/health/live`,
      {
        signal: AbortSignal.timeout(3000),
      },
    );

    if (response.ok) {
      return {
        healthy: true,
        message: `MinIO is healthy on port ${apiPort}`,
        details: { apiPort, consolePort: config.consolePort },
      };
    }
  } catch {
    // Fall through to unhealthy
  }

  return {
    healthy: false,
    message: `MinIO is not responding on port ${apiPort}`,
  };
}

/**
 * Boot MinIO service
 */
export async function boot(
  config: TestEnvConfig["minio"],
): Promise<ServiceResult> {
  // Check if already running
  const health = await checkHealth(config);
  if (health.healthy) {
    // Ensure buckets exist
    await ensureBuckets(config);
    return { success: true, message: "MinIO is already running" };
  }

  log.step("Starting MinIO...");

  // Check if Docker is available
  const hasDocker = await isDockerAvailable();

  if (hasDocker) {
    return await bootWithDocker(config);
  }
  return await bootWithoutDocker(config);
}

/**
 * Boot MinIO using Docker Compose
 */
async function bootWithDocker(
  config: TestEnvConfig["minio"],
): Promise<ServiceResult> {
  log.info("Docker detected - starting MinIO with docker compose...");

  const result = await exec("docker compose up -d minio", { timeout: 120000 });
  if (!result.success) {
    return {
      success: false,
      message: "Failed to start MinIO with Docker",
      error: new Error(result.stderr),
    };
  }

  // Wait for MinIO to be ready
  const ready = await waitFor(
    () => checkHealth(config).then((h) => h.healthy),
    {
      timeout: 30000,
      interval: 1000,
      message: "MinIO to be ready",
    },
  );

  if (!ready) {
    return {
      success: false,
      message: "MinIO failed to start within 30 seconds",
    };
  }

  // Create buckets using docker
  await createBucketsDocker(config);

  return { success: true, message: "MinIO started with Docker" };
}

/**
 * Create buckets using Docker mc
 */
async function createBucketsDocker(
  config: TestEnvConfig["minio"],
): Promise<void> {
  const { publicBucket, privateBucket, accessKey, secretKey } = config;

  log.info("Creating buckets...");

  await exec(
    `docker compose run --rm minio-mc alias set local http://minio:9000 "${accessKey}" "${secretKey}" 2>/dev/null || true`,
    { quiet: true },
  );
  await exec(
    `docker compose run --rm minio-mc mb --ignore-existing local/${publicBucket} 2>/dev/null || true`,
    {
      quiet: true,
    },
  );
  await exec(
    `docker compose run --rm minio-mc mb --ignore-existing local/${privateBucket} 2>/dev/null || true`,
    {
      quiet: true,
    },
  );

  log.info(`Created buckets: ${publicBucket}, ${privateBucket}`);
}

/**
 * Boot MinIO locally (for environments without Docker)
 */
async function bootWithoutDocker(
  config: TestEnvConfig["minio"],
): Promise<ServiceResult> {
  const { apiPort, consolePort, accessKey, secretKey } = config;

  log.info("Docker not available - setting up MinIO locally...");

  // Check if ports are in use
  const apiInUse = await isPortInUse(apiPort);
  const consoleInUse = await isPortInUse(consolePort);

  if (apiInUse || consoleInUse) {
    // Maybe MinIO is already running?
    const health = await checkHealth(config);
    if (health.healthy) {
      await ensureBuckets(config);
      return { success: true, message: "MinIO is already running" };
    }
    return {
      success: false,
      message: `Ports ${apiPort} or ${consolePort} are in use by another process`,
    };
  }

  const minioBin = `${process.env.HOME}/.local/bin/minio`;
  const mcBin = `${process.env.HOME}/.local/bin/mc`;

  // Install MinIO if not present
  const minioExists = await exec(`test -f "${minioBin}"`, { quiet: true });
  if (!minioExists.success) {
    log.info("Installing MinIO...");

    await exec(`mkdir -p "${process.env.HOME}/.local/bin"`);

    // Detect architecture
    const archResult = await exec("uname -m", { quiet: true });
    const arch = archResult.stdout.trim();
    const minioArch = arch === "x86_64" ? "amd64" : "arm64";

    const url = `https://dl.min.io/server/minio/release/linux-${minioArch}/minio`;

    const downloadResult = await exec(
      `curl -sL "${url}" -o "${minioBin}" && chmod +x "${minioBin}"`,
      {
        timeout: 120000,
      },
    );

    if (!downloadResult.success) {
      return {
        success: false,
        message: "Failed to download MinIO",
        error: new Error(downloadResult.stderr),
      };
    }

    log.info("MinIO installed");
  }

  // Install mc (MinIO client) if not present
  const mcExists = await exec(`test -f "${mcBin}"`, { quiet: true });
  if (!mcExists.success) {
    log.info("Installing MinIO client (mc)...");

    const archResult = await exec("uname -m", { quiet: true });
    const arch = archResult.stdout.trim();
    const mcArch = arch === "x86_64" ? "amd64" : "arm64";

    const url = `https://dl.min.io/client/mc/release/linux-${mcArch}/mc`;

    const downloadResult = await exec(
      `curl -sL "${url}" -o "${mcBin}" && chmod +x "${mcBin}"`,
      {
        timeout: 120000,
      },
    );

    if (!downloadResult.success) {
      return {
        success: false,
        message: "Failed to download MinIO client",
        error: new Error(downloadResult.stderr),
      };
    }

    log.info("MinIO client installed");
  }

  // Create data and log directories
  const dataDir = `${process.env.HOME}/.local/minio/data`;
  await exec(`mkdir -p "${dataDir}"`);
  await exec(`mkdir -p "${process.env.HOME}/.local/log"`);

  // Start MinIO in background
  log.info(`Starting MinIO on API:${apiPort}, Console:${consolePort}...`);

  const startResult = await exec(
    `MINIO_ROOT_USER="${accessKey}" MINIO_ROOT_PASSWORD="${secretKey}" nohup "${minioBin}" server "${dataDir}" --address ":${apiPort}" --console-address ":${consolePort}" > "${process.env.HOME}/.local/log/minio.log" 2>&1 & echo $!`,
    { quiet: true },
  );

  if (startResult.success && startResult.stdout) {
    // Save PID
    await exec(
      `echo "${startResult.stdout.trim()}" > "${process.env.HOME}/.local/minio.pid"`,
    );
  }

  // Wait for MinIO to be ready
  const ready = await waitFor(
    () => checkHealth(config).then((h) => h.healthy),
    {
      timeout: 15000,
      interval: 500,
      message: "MinIO to be ready",
    },
  );

  if (!ready) {
    return {
      success: false,
      message: "MinIO failed to start",
    };
  }

  // Create buckets
  await ensureBuckets(config);

  return {
    success: true,
    message: `MinIO started locally on ports API:${apiPort}, Console:${consolePort}`,
  };
}

/**
 * Ensure buckets exist using local mc client
 */
async function ensureBuckets(config: TestEnvConfig["minio"]): Promise<void> {
  const { apiPort, accessKey, secretKey, publicBucket, privateBucket } = config;
  const mcBin = `${process.env.HOME}/.local/bin/mc`;

  const mcExists = await exec(`test -f "${mcBin}"`, { quiet: true });
  if (!mcExists.success) {
    log.warn("MinIO client not found, skipping bucket creation");
    return;
  }

  log.info("Ensuring buckets exist...");

  await exec(
    `"${mcBin}" alias set local http://localhost:${apiPort} "${accessKey}" "${secretKey}" 2>/dev/null`,
    {
      quiet: true,
    },
  );
  await exec(
    `"${mcBin}" mb --ignore-existing local/${publicBucket} 2>/dev/null || true`,
    { quiet: true },
  );
  await exec(
    `"${mcBin}" mb --ignore-existing local/${privateBucket} 2>/dev/null || true`,
    { quiet: true },
  );

  log.info(`Buckets ready: ${publicBucket}, ${privateBucket}`);
}

/**
 * Wipe all objects from MinIO buckets
 */
export async function wipe(
  config: TestEnvConfig["minio"],
): Promise<ServiceResult> {
  const { apiPort, accessKey, secretKey, publicBucket, privateBucket } = config;

  log.step("Wiping MinIO buckets...");

  const health = await checkHealth(config);
  if (!health.healthy) {
    // If MinIO isn't running, nothing to wipe
    return { success: true, message: "MinIO not running - nothing to wipe" };
  }

  // Check if Docker is available
  const hasDocker = await isDockerAvailable();

  if (hasDocker) {
    // Use docker mc to wipe
    await exec(
      `docker compose run --rm minio-mc rm --recursive --force local/${publicBucket}/ 2>/dev/null || true`,
      {
        quiet: true,
      },
    );
    await exec(
      `docker compose run --rm minio-mc rm --recursive --force local/${privateBucket}/ 2>/dev/null || true`,
      {
        quiet: true,
      },
    );
  } else {
    // Use local mc to wipe
    const mcBin = `${process.env.HOME}/.local/bin/mc`;
    const mcExists = await exec(`test -f "${mcBin}"`, { quiet: true });

    if (mcExists.success) {
      await exec(
        `"${mcBin}" alias set local http://localhost:${apiPort} "${accessKey}" "${secretKey}" 2>/dev/null`,
        {
          quiet: true,
        },
      );
      await exec(
        `"${mcBin}" rm --recursive --force local/${publicBucket}/ 2>/dev/null || true`,
        { quiet: true },
      );
      await exec(
        `"${mcBin}" rm --recursive --force local/${privateBucket}/ 2>/dev/null || true`,
        { quiet: true },
      );
    } else {
      log.warn("MinIO client not found, cannot wipe buckets");
      return {
        success: true,
        message: "MinIO client not found - skipping wipe",
      };
    }
  }

  log.success("MinIO buckets wiped");
  return { success: true, message: "All objects deleted from MinIO buckets" };
}
