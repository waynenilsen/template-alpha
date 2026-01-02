/**
 * Password reset token factory for test harness
 */

import {
  generateResetToken,
  hashResetToken,
} from "../../../auth/password-reset";
import type { PrismaClient } from "../../../generated/prisma/client";
import type {
  CreatePasswordResetTokenOptions,
  PasswordResetTokenWithPlainToken,
} from "../types";

export function createPasswordResetTokenFactory(
  prisma: PrismaClient,
  passwordResetTokenIds: Set<string>,
) {
  return async (
    options: CreatePasswordResetTokenOptions,
  ): Promise<PasswordResetTokenWithPlainToken> => {
    const plainToken = generateResetToken();
    const tokenHash = hashResetToken(plainToken);
    const expiresAt =
      options.expiresAt ?? new Date(Date.now() + 60 * 60 * 1000); // 1 hour default

    const token = await prisma.passwordResetToken.create({
      data: {
        userId: options.userId,
        tokenHash,
        expiresAt,
        usedAt: options.usedAt ?? null,
      },
    });

    passwordResetTokenIds.add(token.id);
    return { token, plainToken };
  };
}
