/**
 * Test Environment Service Types
 *
 * Shared types and interfaces for the test environment management system.
 */

/**
 * Result of a service health check
 */
export interface HealthCheckResult {
  healthy: boolean;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Result of a service operation (boot, wipe, etc.)
 */
export interface ServiceResult {
  success: boolean;
  message: string;
  error?: Error;
}

/**
 * Service configuration
 */
export interface ServiceConfig {
  name: string;
  enabled: boolean;
}

/**
 * Configuration for the test environment
 */
export interface TestEnvConfig {
  postgres: ServiceConfig & {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  };
  mailhog: ServiceConfig & {
    smtpPort: number;
    webPort: number;
  };
  minio: ServiceConfig & {
    apiPort: number;
    consolePort: number;
    accessKey: string;
    secretKey: string;
    publicBucket: string;
    privateBucket: string;
  };
}

/**
 * Service interface that all service modules must implement
 */
export interface TestService {
  name: string;
  checkHealth(): Promise<HealthCheckResult>;
  boot(): Promise<ServiceResult>;
  wipe?(): Promise<ServiceResult>;
}

/**
 * Options for the test environment runner
 */
export interface TestEnvOptions {
  wipeDatabase?: boolean;
  wipeS3?: boolean;
  skipMailhog?: boolean;
  skipS3?: boolean;
  verbose?: boolean;
}
