import { z } from "zod/v4";
import { tmid, withPrisma } from "../lib/trpc";
import { createTRPCRouter, publicProcedure } from "./init";
import {
  adminRouter,
  authRouter,
  avatarRouter,
  organizationRouter,
  subscriptionRouter,
  todoRouter,
  userRouter,
} from "./routers";

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
   * Stats procedure - returns platform statistics
   * Uses real database queries to count users, orgs, and todos
   */
  stats: publicProcedure.query(async () => {
    return tmid()
      .use(withPrisma())
      .build(async ({ prisma }) => {
        const [totalUsers, totalTenants, totalTodos, completedTodos] =
          await Promise.all([
            prisma.user.count(),
            prisma.organization.count(),
            prisma.todo.count(),
            prisma.todo.count({ where: { completed: true } }),
          ]);

        return {
          totalUsers,
          totalTenants,
          totalTodos,
          completedTodos,
          timestamp: new Date(),
        };
      });
  }),

  /**
   * Admin router - admin-only platform management
   */
  admin: adminRouter,

  /**
   * Auth router - authentication and session management
   */
  auth: authRouter,

  /**
   * Todo router - todo CRUD operations (org-scoped)
   */
  todo: todoRouter,

  /**
   * Organization router - organization and team management
   */
  organization: organizationRouter,

  /**
   * Subscription router - billing and plan management
   */
  subscription: subscriptionRouter,

  /**
   * User router - user profile and settings
   */
  user: userRouter,

  /**
   * Avatar router - avatar upload/download for users and orgs
   */
  avatar: avatarRouter,
});

// Export type definition of the API for client usage
export type AppRouter = typeof appRouter;
