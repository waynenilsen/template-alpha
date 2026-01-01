import { z } from "zod/v4";
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
});

// Export type definition of the API for client usage
export type AppRouter = typeof appRouter;
