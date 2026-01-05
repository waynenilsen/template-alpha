import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";
import { getUserOrganizations, isMemberOf } from "../../lib/auth/authorization";
import { normalizeEmail } from "../../lib/auth/email";
import {
  hashPassword,
  passwordSchema,
  verifyPassword,
} from "../../lib/auth/password";
import {
  requestPasswordReset,
  resetPassword,
  validateResetToken,
} from "../../lib/auth/password-reset";
import {
  createSession,
  deleteSession,
  switchOrganization,
} from "../../lib/auth/session";
import { sendPasswordResetEmail } from "../../lib/email/send";
import { auth, tmid, withPrisma } from "../../lib/trpc";
import { createTRPCRouter, publicProcedure } from "../init";

/**
 * Input schema for sign up
 */
const signUpInput = z.object({
  email: z.string().email("Invalid email address"),
  password: passwordSchema,
  name: z.string().min(1, "Name is required").optional(),
});

/**
 * Input schema for sign in
 */
const signInInput = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

/**
 * Input schema for switching organization
 */
const switchOrgInput = z.object({
  organizationId: z.string().cuid().nullable(),
});

/**
 * Input schema for requesting password reset
 */
const requestPasswordResetInput = z.object({
  email: z.string().email("Invalid email address"),
});

/**
 * Input schema for validating reset token
 */
const validateResetTokenInput = z.object({
  token: z.string().min(1, "Token is required"),
});

/**
 * Input schema for resetting password
 */
const resetPasswordInput = z.object({
  token: z.string().min(1, "Token is required"),
  password: passwordSchema,
});

/**
 * Auth router - handles authentication and session management
 */
export const authRouter = createTRPCRouter({
  /**
   * Sign up a new user
   * Creates a user account with a personal organization and returns a session
   */
  signUp: publicProcedure.input(signUpInput).mutation(async ({ input }) => {
    return tmid()
      .use(withPrisma())
      .build(async ({ prisma }) => {
        // Normalize email to lowercase for case-insensitive handling
        const email = normalizeEmail(input.email);

        // Check if email is already taken
        const existingUser = await prisma.user.findUnique({
          where: { email },
        });

        if (existingUser) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "An account with this email already exists",
          });
        }

        // Hash password and create user with organization in a transaction
        const passwordHash = await hashPassword(input.password);

        const { user, organization, session } = await prisma.$transaction(
          async (tx) => {
            // Create user
            const newUser = await tx.user.create({
              data: {
                email,
                passwordHash,
              },
            });

            // Generate org name and slug from email
            const emailPrefix = email.split("@")[0];
            const orgName = `${emailPrefix}'s Organization`;
            const baseSlug = emailPrefix
              .toLowerCase()
              .replace(/[^a-z0-9]/g, "-");
            const uniqueSlug = `${baseSlug}-${newUser.id.slice(-8)}`;

            // Create organization
            const newOrg = await tx.organization.create({
              data: {
                name: orgName,
                slug: uniqueSlug,
              },
            });

            // Create membership with owner role
            await tx.organizationMember.create({
              data: {
                userId: newUser.id,
                organizationId: newOrg.id,
                role: "owner",
              },
            });

            // Create session with the new org as current
            const newSession = await createSession(tx, newUser.id, newOrg.id);

            return { user: newUser, organization: newOrg, session: newSession };
          },
        );

        return {
          user: {
            id: user.id,
            email: user.email,
            isAdmin: user.isAdmin,
          },
          session: {
            id: session.id,
            expiresAt: session.expiresAt,
            currentOrgId: session.currentOrgId,
          },
          organization: {
            id: organization.id,
            name: organization.name,
            slug: organization.slug,
          },
        };
      });
  }),

  /**
   * Sign in an existing user
   * Validates credentials and returns a session
   */
  signIn: publicProcedure.input(signInInput).mutation(async ({ input }) => {
    return tmid()
      .use(withPrisma())
      .build(async ({ prisma }) => {
        // Normalize email to lowercase for case-insensitive handling
        const email = normalizeEmail(input.email);

        // Find user by email
        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid email or password",
          });
        }

        // Verify password
        const isValid = await verifyPassword(input.password, user.passwordHash);

        if (!isValid) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid email or password",
          });
        }

        // Get user's organizations to potentially set a default
        const orgs = await getUserOrganizations(prisma, user.id);
        const defaultOrgId = orgs.length === 1 ? orgs[0].id : null;

        // Create session
        const session = await createSession(prisma, user.id, defaultOrgId);

        return {
          user: {
            id: user.id,
            email: user.email,
            isAdmin: user.isAdmin,
          },
          session: {
            id: session.id,
            expiresAt: session.expiresAt,
            currentOrgId: session.currentOrgId,
          },
          organizations: orgs,
        };
      });
  }),

  /**
   * Sign out - invalidate the current session
   */
  signOut: publicProcedure.mutation(async () => {
    return tmid()
      .use(withPrisma())
      .use(auth())
      .build(async ({ prisma, session }) => {
        await deleteSession(prisma, session.id);
        return { success: true };
      });
  }),

  /**
   * Get current user info
   * Returns the authenticated user and their organizations
   */
  me: publicProcedure.query(async () => {
    return tmid()
      .use(withPrisma())
      .use(auth())
      .build(async ({ prisma, session }) => {
        const orgs = await getUserOrganizations(prisma, session.user.id);

        return {
          user: {
            id: session.user.id,
            email: session.user.email,
            isAdmin: session.user.isAdmin,
          },
          session: {
            id: session.id,
            currentOrgId: session.currentOrgId,
            expiresAt: session.expiresAt,
          },
          organizations: orgs,
        };
      });
  }),

  /**
   * Switch organization context
   * Changes the active organization for the current session
   */
  switchOrg: publicProcedure
    .input(switchOrgInput)
    .mutation(async ({ input }) => {
      return tmid()
        .use(withPrisma())
        .use(auth())
        .build(async ({ prisma, session }) => {
          // If setting to null, just clear the org context
          if (input.organizationId === null) {
            await switchOrganization(prisma, session.id, null);
            return {
              success: true,
              currentOrgId: null,
            };
          }

          // Verify user is a member of the target organization (unless admin)
          const isMember = await isMemberOf(
            prisma,
            session.user.id,
            input.organizationId,
          );

          if (!isMember && !session.user.isAdmin) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "You are not a member of this organization",
            });
          }

          // Switch organization
          const updated = await switchOrganization(
            prisma,
            session.id,
            input.organizationId,
          );

          /* c8 ignore start - race condition: session deleted between middleware and here */
          if (!updated) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to switch organization",
            });
          }
          /* c8 ignore stop */

          return {
            success: true,
            currentOrgId: updated.currentOrgId,
          };
        });
    }),

  /**
   * Get user's organizations
   * Returns all organizations the user is a member of
   */
  getOrganizations: publicProcedure.query(async () => {
    return tmid()
      .use(withPrisma())
      .use(auth())
      .build(async ({ prisma, session }) => {
        return getUserOrganizations(prisma, session.user.id);
      });
  }),

  /**
   * Request a password reset email
   * Always returns success to avoid leaking user existence
   */
  requestPasswordReset: publicProcedure
    .input(requestPasswordResetInput)
    .mutation(async ({ input }) => {
      return tmid()
        .use(withPrisma())
        .build(async ({ prisma }) => {
          const result = await requestPasswordReset(prisma, input.email);

          // If user exists, send the email
          if (result.success) {
            await sendPasswordResetEmail(input.email, result.token);
          }

          // Always return success to prevent email enumeration
          return { success: true };
        });
    }),

  /**
   * Validate a password reset token
   * Returns whether the token is valid (for UI feedback)
   */
  validateResetToken: publicProcedure
    .input(validateResetTokenInput)
    .query(async ({ input }) => {
      return tmid()
        .use(withPrisma())
        .build(async ({ prisma }) => {
          const result = await validateResetToken(prisma, input.token);

          if (!result.valid) {
            return { valid: false, error: result.error };
          }

          return { valid: true };
        });
    }),

  /**
   * Reset password with a valid token
   * Creates a new session after successful reset
   */
  resetPassword: publicProcedure
    .input(resetPasswordInput)
    .mutation(async ({ input }) => {
      return tmid()
        .use(withPrisma())
        .build(async ({ prisma }) => {
          const result = await resetPassword(
            prisma,
            input.token,
            input.password,
          );

          if (!result.success) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                result.error === "invalid_token"
                  ? "Invalid or expired reset link"
                  : result.error === "expired_token"
                    ? "This reset link has expired"
                    : result.error === "used_token"
                      ? "This reset link has already been used"
                      : "Unable to reset password",
            });
          }

          return { success: true };
        });
    }),
});
