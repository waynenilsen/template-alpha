/**
 * PostgreSQL Service Management
 *
 * Provides health checks, bootstrapping, and database wiping for PostgreSQL.
 */

import type { HealthCheckResult, ServiceResult, TestEnvConfig } from "./types";
import { exec, isDockerAvailable, log, waitFor } from "./utils";

/**
 * Check if PostgreSQL is healthy and accepting connections
 */
export async function checkHealth(
  config: TestEnvConfig["postgres"],
): Promise<HealthCheckResult> {
  const { host, port, user, password, database } = config;

  // Try to connect using psql
  const result = await exec(
    `PGPASSWORD="${password}" psql -h ${host} -p ${port} -U ${user} -d ${database} -c "SELECT 1;" 2>/dev/null`,
    { quiet: true },
  );

  if (result.success) {
    return {
      healthy: true,
      message: `PostgreSQL is healthy on port ${port}`,
      details: { host, port, database },
    };
  }

  // Try peer authentication as fallback (for local installs)
  const peerResult = await exec(
    `sudo -u postgres psql -p ${port} -d ${database} -c "SELECT 1;" 2>/dev/null`,
    { quiet: true },
  );

  if (peerResult.success) {
    return {
      healthy: true,
      message: `PostgreSQL is healthy on port ${port} (peer auth)`,
      details: { host, port, database, authMethod: "peer" },
    };
  }

  return {
    healthy: false,
    message: `PostgreSQL is not responding on port ${port}`,
    details: { error: result.stderr },
  };
}

/**
 * Boot PostgreSQL service
 */
export async function boot(
  config: TestEnvConfig["postgres"],
): Promise<ServiceResult> {
  const { port, user, password, database } = config;

  // Check if already running
  const health = await checkHealth(config);
  if (health.healthy) {
    return { success: true, message: "PostgreSQL is already running" };
  }

  log.step("Starting PostgreSQL...");

  // Check if Docker is available
  const hasDocker = await isDockerAvailable();

  if (hasDocker) {
    return await bootWithDocker(config);
  }
  return await bootWithoutDocker(config);
}

/**
 * Boot PostgreSQL using Docker Compose
 */
async function bootWithDocker(
  config: TestEnvConfig["postgres"],
): Promise<ServiceResult> {
  log.info("Docker detected - starting PostgreSQL with docker compose...");

  const result = await exec("docker compose up -d postgres", {
    timeout: 120000,
  });
  if (!result.success) {
    return {
      success: false,
      message: "Failed to start PostgreSQL with Docker",
      error: new Error(result.stderr),
    };
  }

  // Wait for PostgreSQL to be ready
  const ready = await waitFor(
    () => checkHealth(config).then((h) => h.healthy),
    {
      timeout: 30000,
      interval: 1000,
      message: "PostgreSQL to be ready",
    },
  );

  if (!ready) {
    return {
      success: false,
      message: "PostgreSQL failed to start within 30 seconds",
    };
  }

  return { success: true, message: "PostgreSQL started with Docker" };
}

/**
 * Boot PostgreSQL locally (for environments without Docker)
 */
async function bootWithoutDocker(
  config: TestEnvConfig["postgres"],
): Promise<ServiceResult> {
  const { port, user, password, database } = config;

  log.info("Docker not available - setting up PostgreSQL locally...");

  // Check if PostgreSQL is installed
  const psqlCheck = await exec("which psql", { quiet: true });
  if (!psqlCheck.success) {
    log.info("Installing PostgreSQL...");
    const installResult = await exec(
      "sudo apt-get update -qq && sudo apt-get install -y -qq postgresql postgresql-contrib",
      { timeout: 120000 },
    );
    if (!installResult.success) {
      return {
        success: false,
        message: "Failed to install PostgreSQL",
        error: new Error(installResult.stderr),
      };
    }
  }

  // Start PostgreSQL service
  log.info("Starting PostgreSQL service...");
  await exec(
    "sudo service postgresql start || sudo systemctl start postgresql || true",
  );
  await Bun.sleep(2000);

  // Configure port if needed
  const currentPort = await exec(
    "sudo -u postgres psql -t -c 'SHOW port' 2>/dev/null",
    { quiet: true },
  );
  const portValue = currentPort.stdout.trim();

  if (portValue !== String(port)) {
    log.info(`Configuring PostgreSQL to use port ${port}...`);

    // Get config directory
    const configDir = await exec(
      "sudo -u postgres psql -t -c 'SHOW config_file' 2>/dev/null",
      { quiet: true },
    );
    if (configDir.success) {
      const configPath = configDir.stdout.trim();
      const dir = configPath.replace(/\/[^/]+$/, "");

      // Update port in postgresql.conf
      await exec(
        `sudo sed -i "s/^#*port = .*/port = ${port}/" "${configPath}"`,
      );

      // Restart to apply
      await exec(
        "sudo service postgresql restart || sudo systemctl restart postgresql",
      );
      await Bun.sleep(2000);
    }
  }

  // Set up user password and database
  log.info("Configuring database user and database...");
  await exec(
    `sudo -u postgres psql -p ${port} -c "ALTER USER ${user} WITH PASSWORD '${password}';" 2>/dev/null`,
  );

  // Create database if it doesn't exist
  const dbExists = await exec(
    `sudo -u postgres psql -p ${port} -lqt | cut -d \\| -f 1 | grep -qw "${database}"`,
    { quiet: true },
  );

  if (!dbExists.success) {
    log.info(`Creating database '${database}'...`);
    await exec(`sudo -u postgres createdb -p ${port} "${database}"`);
  }

  // Verify connection
  const health = await checkHealth(config);
  if (!health.healthy) {
    return {
      success: false,
      message: "Failed to verify PostgreSQL connection",
    };
  }

  return {
    success: true,
    message: `PostgreSQL started locally on port ${port}`,
  };
}

/**
 * Wipe the database - drops all tables and recreates the schema
 */
export async function wipe(
  config: TestEnvConfig["postgres"],
): Promise<ServiceResult> {
  const { host, port, user, password, database } = config;

  log.step("Wiping PostgreSQL database...");

  // First ensure the database is running
  const health = await checkHealth(config);
  if (!health.healthy) {
    return {
      success: false,
      message: "PostgreSQL is not running - cannot wipe",
    };
  }

  // Drop the public schema and recreate it - simplest and most reliable way
  // to wipe all tables, sequences, types, etc.
  const dropSchemaSQL =
    "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public;";

  // Try password auth first
  const result = await exec(
    `PGPASSWORD="${password}" psql -h ${host} -p ${port} -U ${user} -d ${database} -c "${dropSchemaSQL}"`,
    { quiet: true },
  );

  if (result.success) {
    log.success("Database wiped successfully");
    return {
      success: true,
      message: "Database wiped (public schema dropped and recreated)",
    };
  }

  // Try with peer auth as fallback
  const peerResult = await exec(
    `sudo -u postgres psql -p ${port} -d ${database} -c "${dropSchemaSQL}"`,
    {
      quiet: true,
    },
  );

  if (peerResult.success) {
    log.success("Database wiped successfully (peer auth)");
    return {
      success: true,
      message: "Database wiped (public schema dropped and recreated)",
    };
  }

  return {
    success: false,
    message: "Failed to wipe database",
    error: new Error(result.stderr || peerResult.stderr),
  };
}

/**
 * Push the Prisma schema to the database
 */
export async function pushSchema(
  config?: TestEnvConfig["postgres"],
): Promise<ServiceResult> {
  log.step("Pushing Prisma schema...");

  // Ensure DATABASE_URL is set for prisma
  const cfg = config ?? {
    host: "localhost",
    port: 54673,
    user: "postgres",
    password: "postgres",
    database: "template_alpha",
  };
  const databaseUrl = `postgresql://${cfg.user}:${cfg.password}@${cfg.host}:${cfg.port}/${cfg.database}`;

  const result = await exec(
    `DATABASE_URL="${databaseUrl}" bunx prisma db push --accept-data-loss`,
    { timeout: 60000 },
  );

  if (!result.success) {
    return {
      success: false,
      message: "Failed to push Prisma schema",
      error: new Error(result.stderr),
    };
  }

  log.success("Prisma schema pushed successfully");
  return { success: true, message: "Schema pushed to database" };
}
