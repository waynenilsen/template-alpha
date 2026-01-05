import crypto from "node:crypto";
import type {
  PasswordResetToken,
  PrismaClient,
} from "../generated/prisma/client";
import { normalizeEmail } from "./email";
import { hashPassword } from "./password";

// Transaction-compatible Prisma client type (for use in $transaction callbacks)
type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

// Type that accepts both full PrismaClient and transaction clients
type PrismaClientLike = PrismaClient | TransactionClient;

// Password reset token validity: 1 hour in milliseconds
const TOKEN_VALIDITY_MS = 60 * 60 * 1000;

// Token length in bytes (generates 64 character hex string)
const TOKEN_BYTES = 32;

export interface PasswordResetTokenData {
  id: string;
  userId: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export interface CreatePasswordResetResult {
  token: string;
  expiresAt: Date;
}

export type RequestPasswordResetResult =
  | { success: true; token: string; expiresAt: Date }
  | { success: false; error: "user_not_found" };

export type ValidateResetTokenResult =
  | { valid: true; userId: string }
  | { valid: false; error: "invalid_token" | "expired_token" | "used_token" };

export type ResetPasswordResult =
  | { success: true }
  | {
      success: false;
      error:
        | "invalid_token"
        | "expired_token"
        | "used_token"
        | "user_not_found";
    };

/**
 * Generate a secure random token
 */
export function generateResetToken(): string {
  return crypto.randomBytes(TOKEN_BYTES).toString("hex");
}

/**
 * Hash a reset token for storage
 * Uses SHA-256 for fast, secure hashing (tokens are already high-entropy)
 */
export function hashResetToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Create a password reset token for a user
 * Returns the plain token (to be sent via email) and expiration time
 */
export async function createPasswordResetToken(
  prisma: PrismaClientLike,
  userId: string,
): Promise<CreatePasswordResetResult> {
  const token = generateResetToken();
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_VALIDITY_MS);

  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

/**
 * Request a password reset for a user by email
 * Returns the token if user exists, or an error if not found
 */
export async function requestPasswordReset(
  prisma: PrismaClient,
  email: string,
): Promise<RequestPasswordResetResult> {
  const user = await prisma.user.findUnique({
    where: { email: normalizeEmail(email) },
    select: { id: true },
  });

  if (!user) {
    return { success: false, error: "user_not_found" };
  }

  // Invalidate any existing unused tokens for this user
  await invalidateUserResetTokens(prisma, user.id);

  const { token, expiresAt } = await createPasswordResetToken(prisma, user.id);

  return { success: true, token, expiresAt };
}

/**
 * Validate a password reset token
 * Returns the user ID if valid, or an error describing the issue
 */
export async function validateResetToken(
  prisma: PrismaClient,
  token: string,
): Promise<ValidateResetTokenResult> {
  const tokenHash = hashResetToken(token);

  const resetToken = await prisma.passwordResetToken.findFirst({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      usedAt: true,
    },
  });

  if (!resetToken) {
    return { valid: false, error: "invalid_token" };
  }

  if (resetToken.usedAt !== null) {
    return { valid: false, error: "used_token" };
  }

  if (resetToken.expiresAt < new Date()) {
    return { valid: false, error: "expired_token" };
  }

  return { valid: true, userId: resetToken.userId };
}

/**
 * Reset a user's password using a valid token
 * Marks the token as used and updates the password
 */
export async function resetPassword(
  prisma: PrismaClient,
  token: string,
  newPassword: string,
): Promise<ResetPasswordResult> {
  const tokenHash = hashResetToken(token);

  // Use a transaction to ensure atomicity
  return prisma.$transaction(async (tx) => {
    const resetToken = await tx.passwordResetToken.findFirst({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        usedAt: true,
      },
    });

    if (!resetToken) {
      return { success: false, error: "invalid_token" as const };
    }

    if (resetToken.usedAt !== null) {
      return { success: false, error: "used_token" as const };
    }

    if (resetToken.expiresAt < new Date()) {
      return { success: false, error: "expired_token" as const };
    }

    // Verify user still exists
    const user = await tx.user.findUnique({
      where: { id: resetToken.userId },
      select: { id: true },
    });

    if (!user) {
      return { success: false, error: "user_not_found" as const };
    }

    // Hash the new password
    const passwordHash = await hashPassword(newPassword);

    // Update the user's password
    await tx.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    });

    // Mark the token as used
    await tx.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    });

    return { success: true };
  });
}

/**
 * Invalidate all unused password reset tokens for a user
 * Call this when a user successfully resets their password or changes it manually
 */
export async function invalidateUserResetTokens(
  prisma: PrismaClientLike,
  userId: string,
): Promise<number> {
  const result = await prisma.passwordResetToken.updateMany({
    where: {
      userId,
      usedAt: null,
    },
    data: {
      usedAt: new Date(),
    },
  });

  return result.count;
}

/**
 * Get a password reset token by ID (for testing/admin purposes)
 */
export async function getPasswordResetTokenById(
  prisma: PrismaClient,
  tokenId: string,
): Promise<PasswordResetToken | null> {
  return prisma.passwordResetToken.findUnique({
    where: { id: tokenId },
  });
}

/**
 * Clean up expired password reset tokens
 * Returns the number of tokens deleted
 */
export async function cleanupExpiredResetTokens(
  prisma: PrismaClient,
): Promise<number> {
  const result = await prisma.passwordResetToken.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });
  return result.count;
}

/**
 * Get all password reset tokens for a user (for admin/debugging)
 */
export async function getUserResetTokens(
  prisma: PrismaClient,
  userId: string,
): Promise<PasswordResetTokenData[]> {
  return prisma.passwordResetToken.findMany({
    where: { userId },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      usedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}
