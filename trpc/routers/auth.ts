import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";
import { getUserOrganizations, isMemberOf } from "../../lib/auth/authorization";
import {
  hashPassword,
  passwordSchema,
  verifyPassword,
} from "../../lib/auth/password";
import {
  createSession,
  deleteSession,
  switchOrganization,
} from "../../lib/auth/session";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../init";

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
 * Auth router - handles authentication and session management
 */
export const authRouter = createTRPCRouter({
  /**
   * Sign up a new user
   * Creates a user account with a personal organization and returns a session
   */
  signUp: publicProcedure
    .input(signUpInput)
    .mutation(async ({ ctx, input }) => {
      // Check if email is already taken
      const existingUser = await ctx.prisma.user.findUnique({
        where: { email: input.email },
      });

      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An account with this email already exists",
        });
      }

      // Hash password and create user with organization in a transaction
      const passwordHash = await hashPassword(input.password);

      const { user, organization, session } = await ctx.prisma.$transaction(
        async (tx) => {
          // Create user
          const newUser = await tx.user.create({
            data: {
              email: input.email,
              passwordHash,
            },
          });

          // Generate org name and slug from email
          const emailPrefix = input.email.split("@")[0];
          const orgName = `${emailPrefix}'s Organization`;
          const baseSlug = emailPrefix.toLowerCase().replace(/[^a-z0-9]/g, "-");
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
    }),

  /**
   * Sign in an existing user
   * Validates credentials and returns a session
   */
  signIn: publicProcedure
    .input(signInInput)
    .mutation(async ({ ctx, input }) => {
      // Find user by email
      const user = await ctx.prisma.user.findUnique({
        where: { email: input.email },
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
      const orgs = await getUserOrganizations(ctx.prisma, user.id);
      const defaultOrgId = orgs.length === 1 ? orgs[0].id : null;

      // Create session
      const session = await createSession(ctx.prisma, user.id, defaultOrgId);

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
    }),

  /**
   * Sign out - invalidate the current session
   */
  signOut: protectedProcedure.mutation(async ({ ctx }) => {
    await deleteSession(ctx.prisma, ctx.session.id);
    return { success: true };
  }),

  /**
   * Get current user info
   * Returns the authenticated user and their organizations
   */
  me: protectedProcedure.query(async ({ ctx }) => {
    const orgs = await getUserOrganizations(ctx.prisma, ctx.user.id);

    return {
      user: {
        id: ctx.user.id,
        email: ctx.user.email,
        isAdmin: ctx.user.isAdmin,
      },
      session: {
        id: ctx.session.id,
        currentOrgId: ctx.session.currentOrgId,
        expiresAt: ctx.session.expiresAt,
      },
      organizations: orgs,
    };
  }),

  /**
   * Switch organization context
   * Changes the active organization for the current session
   */
  switchOrg: protectedProcedure
    .input(switchOrgInput)
    .mutation(async ({ ctx, input }) => {
      // If setting to null, just clear the org context
      if (input.organizationId === null) {
        await switchOrganization(ctx.prisma, ctx.session.id, null);
        return {
          success: true,
          currentOrgId: null,
        };
      }

      // Verify user is a member of the target organization (unless admin)
      const isMember = await isMemberOf(
        ctx.prisma,
        ctx.user.id,
        input.organizationId,
      );

      if (!isMember && !ctx.user.isAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a member of this organization",
        });
      }

      // Switch organization
      const updated = await switchOrganization(
        ctx.prisma,
        ctx.session.id,
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
    }),

  /**
   * Get user's organizations
   * Returns all organizations the user is a member of
   */
  getOrganizations: protectedProcedure.query(async ({ ctx }) => {
    return getUserOrganizations(ctx.prisma, ctx.user.id);
  }),
});
