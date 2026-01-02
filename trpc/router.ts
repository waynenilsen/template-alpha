import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";
import { hashPassword, passwordSchema } from "../lib/auth/password";
import { createSession } from "../lib/auth/session";
import { prisma } from "../lib/db";
import { sendWelcomeEmail } from "../lib/email";
import { createTRPCRouter, publicProcedure } from "./init";

/**
 * Main application router
 * Add sub-routers here as the application grows
 */
export const appRouter = createTRPCRouter({
  /**
   * Health check procedure - returns server status and timestamp
   */
  health: publicProcedure.query(() => {
    return {
      status: "ok" as const,
      timestamp: new Date(),
    };
  }),

  /**
   * Greeting procedure - demonstrates input validation with Zod
   */
  greeting: publicProcedure
    .input(
      z.object({
        name: z.string().min(1).optional(),
      }),
    )
    .query(({ input }) => {
      return {
        message: `Hello, ${input.name ?? "World"}!`,
        timestamp: new Date(),
      };
    }),

  /**
   * Stats procedure - proof of concept returning mock data
   * This will be replaced with real database queries
   */
  stats: publicProcedure.query(() => {
    return {
      totalUsers: 42,
      totalTenants: 7,
      totalTodos: 156,
      completedTodos: 89,
      timestamp: new Date(),
    };
  }),

  /**
   * Signup procedure - creates a new user account
   * 1. Validates email and password
   * 2. Creates user with hashed password
   * 3. Creates a default organization
   * 4. Adds user as organization owner
   * 5. Creates a session
   * 6. Sends welcome email
   */
  signup: publicProcedure
    .input(
      z.object({
        email: z.email("Invalid email address"),
        password: passwordSchema,
        organizationName: z.string().min(1).max(100).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      // Check if email already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: input.email },
      });

      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An account with this email already exists",
        });
      }

      // Hash password
      const passwordHash = await hashPassword(input.password);

      // Generate organization slug from email or name
      const orgName =
        input.organizationName || `${input.email.split("@")[0]}'s Workspace`;
      const baseSlug = orgName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      // Add random suffix to ensure uniqueness
      const slug = `${baseSlug}-${Date.now().toString(36)}`;

      // Create user, organization, and membership in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create user
        const user = await tx.user.create({
          data: {
            email: input.email,
            passwordHash,
          },
        });

        // Create organization
        const organization = await tx.organization.create({
          data: {
            name: orgName,
            slug,
          },
        });

        // Add user as organization owner
        await tx.organizationMember.create({
          data: {
            userId: user.id,
            organizationId: organization.id,
            role: "owner",
          },
        });

        // Create session
        const session = await createSession(tx, user.id, organization.id);

        return { user, organization, session };
      });

      // Send welcome email (don't block on this)
      sendWelcomeEmail(input.email).catch((err) => {
        console.error("Failed to send welcome email:", err);
      });

      return {
        success: true,
        sessionId: result.session.id,
        user: {
          id: result.user.id,
          email: result.user.email,
        },
        organization: {
          id: result.organization.id,
          name: result.organization.name,
          slug: result.organization.slug,
        },
      };
    }),
});

// Export type definition of the API for client usage
export type AppRouter = typeof appRouter;
