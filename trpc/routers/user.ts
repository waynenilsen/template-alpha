import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";
import {
  hashPassword,
  passwordSchema,
  verifyPassword,
} from "../../lib/auth/password";
import { deleteSession } from "../../lib/auth/session";
import { auth, tmid, withPrisma } from "../../lib/trpc";
import { createTRPCRouter, publicProcedure } from "../init";

/**
 * Input schema for updating profile
 */
const updateProfileInput = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
});

/**
 * Input schema for changing password
 */
const changePasswordInput = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: passwordSchema,
});

/**
 * Input schema for deleting account
 */
const deleteAccountInput = z.object({
  password: z.string().min(1, "Password is required to delete account"),
});

/**
 * User router - handles user profile and settings
 */
export const userRouter = createTRPCRouter({
  /**
   * Get current user profile
   * Returns the authenticated user's profile data
   */
  getProfile: publicProcedure.query(async () => {
    return tmid()
      .use(withPrisma())
      .use(auth())
      .build(async ({ prisma, session }) => {
        const user = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: {
            id: true,
            email: true,
            name: true,
            isAdmin: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        /* c8 ignore start - race condition: user deleted between middleware and here */
        if (!user) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "User not found",
          });
        }
        /* c8 ignore stop */

        return user;
      });
  }),

  /**
   * Update user profile
   * Allows updating user's name
   */
  updateProfile: publicProcedure
    .input(updateProfileInput)
    .mutation(async ({ input }) => {
      return tmid()
        .use(withPrisma())
        .use(auth())
        .build(async ({ prisma, session }) => {
          const user = await prisma.user.update({
            where: { id: session.user.id },
            data: { name: input.name },
            select: {
              id: true,
              email: true,
              name: true,
              isAdmin: true,
              createdAt: true,
              updatedAt: true,
            },
          });

          return user;
        });
    }),

  /**
   * Change user password
   * Requires current password for verification
   */
  changePassword: publicProcedure
    .input(changePasswordInput)
    .mutation(async ({ input }) => {
      return tmid()
        .use(withPrisma())
        .use(auth())
        .build(async ({ prisma, session }) => {
          // Get user with password hash
          const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { passwordHash: true },
          });

          /* c8 ignore start - race condition: user deleted between middleware and here */
          if (!user) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "User not found",
            });
          }
          /* c8 ignore stop */

          // Verify current password
          const isValid = await verifyPassword(
            input.currentPassword,
            user.passwordHash,
          );

          if (!isValid) {
            throw new TRPCError({
              code: "UNAUTHORIZED",
              message: "Current password is incorrect",
            });
          }

          // Hash and update new password
          const newPasswordHash = await hashPassword(input.newPassword);

          await prisma.user.update({
            where: { id: session.user.id },
            data: { passwordHash: newPasswordHash },
          });

          return { success: true };
        });
    }),

  /**
   * Delete user account
   * Requires password confirmation
   * Deletes all user data and sessions
   */
  deleteAccount: publicProcedure
    .input(deleteAccountInput)
    .mutation(async ({ input }) => {
      return tmid()
        .use(withPrisma())
        .use(auth())
        .build(async ({ prisma, session }) => {
          // Get user with password hash
          const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { passwordHash: true },
          });

          /* c8 ignore start - race condition: user deleted between middleware and here */
          if (!user) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "User not found",
            });
          }
          /* c8 ignore stop */

          // Verify password
          const isValid = await verifyPassword(
            input.password,
            user.passwordHash,
          );

          if (!isValid) {
            throw new TRPCError({
              code: "UNAUTHORIZED",
              message: "Password is incorrect",
            });
          }

          // Delete the current session first
          await deleteSession(prisma, session.id);

          // Delete the user (cascade will delete related records)
          await prisma.user.delete({
            where: { id: session.user.id },
          });

          return { success: true };
        });
    }),
});
