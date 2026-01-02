import { z } from "zod/v4";
import { createTRPCRouter, publicProcedure } from "./init";
import { authRouter, todoRouter } from "./routers";

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
  stats: publicProcedure.query(async ({ ctx }) => {
    const [totalUsers, totalTenants, totalTodos, completedTodos] =
      await Promise.all([
        ctx.prisma.user.count(),
        ctx.prisma.organization.count(),
        ctx.prisma.todo.count(),
        ctx.prisma.todo.count({ where: { completed: true } }),
      ]);

    return {
      totalUsers,
      totalTenants,
      totalTodos,
      completedTodos,
      timestamp: new Date(),
    };
  }),

  /**
   * Auth router - authentication and session management
   */
  auth: authRouter,

  /**
   * Todo router - todo CRUD operations (org-scoped)
   */
  todo: todoRouter,
});

// Export type definition of the API for client usage
export type AppRouter = typeof appRouter;
