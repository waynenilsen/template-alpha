/**
 * User factory for test harness
 */

import { hashPassword } from "../../../auth/password";
import type { PrismaClient, User } from "../../../generated/prisma/client";
import type { CreateUserOptions } from "../types";
import { generateUniqueId } from "../utils";

export function createUserFactory(
  prisma: PrismaClient,
  prefix: string,
  userIds: Set<string>,
) {
  return async (options: CreateUserOptions = {}): Promise<User> => {
    const uniqueId = generateUniqueId();
    const email = options.email ?? `${prefix}user_${uniqueId}@test.local`;
    const password = options.password ?? "TestPassword123";
    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: options.name,
        isAdmin: options.isAdmin ?? false,
      },
    });

    userIds.add(user.id);
    return user;
  };
}
