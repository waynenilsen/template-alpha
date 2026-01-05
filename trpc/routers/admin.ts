import { adminOnly, auth, tmid, withPrisma } from "../../lib/trpc";
import { createTRPCRouter, publicProcedure } from "../init";

/**
 * Admin router - admin-only operations
 */
export const adminRouter = createTRPCRouter({
  /**
   * Get dashboard stats for admins
   * Returns platform-wide statistics
   */
  dashboard: publicProcedure.query(async () => {
    return tmid()
      .use(withPrisma())
      .use(auth())
      .use(adminOnly())
      .build(async ({ prisma }) => {
        const [
          totalUsers,
          totalOrganizations,
          totalTodos,
          completedTodos,
          recentUsers,
          recentOrganizations,
        ] = await Promise.all([
          prisma.user.count(),
          prisma.organization.count(),
          prisma.todo.count(),
          prisma.todo.count({ where: { completed: true } }),
          prisma.user.findMany({
            take: 5,
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              email: true,
              isAdmin: true,
              createdAt: true,
            },
          }),
          prisma.organization.findMany({
            take: 5,
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              name: true,
              slug: true,
              createdAt: true,
              _count: {
                select: {
                  members: true,
                },
              },
            },
          }),
        ]);

        return {
          stats: {
            totalUsers,
            totalOrganizations,
            totalTodos,
            completedTodos,
            completionRate:
              totalTodos > 0
                ? Math.round((completedTodos / totalTodos) * 100)
                : 0,
          },
          recentUsers,
          recentOrganizations: recentOrganizations.map((org) => ({
            ...org,
            memberCount: org._count.members,
          })),
        };
      });
  }),
});
