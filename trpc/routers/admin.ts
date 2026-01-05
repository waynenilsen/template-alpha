import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../init";

/**
 * Admin procedure - requires user to have isAdmin flag
 */
const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!ctx.user.isAdmin) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required",
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

/**
 * Admin router - admin-only operations
 */
export const adminRouter = createTRPCRouter({
  /**
   * Get dashboard stats for admins
   * Returns platform-wide statistics
   */
  dashboard: adminProcedure.query(async ({ ctx }) => {
    const [
      totalUsers,
      totalOrganizations,
      totalTodos,
      completedTodos,
      recentUsers,
      recentOrganizations,
    ] = await Promise.all([
      ctx.prisma.user.count(),
      ctx.prisma.organization.count(),
      ctx.prisma.todo.count(),
      ctx.prisma.todo.count({ where: { completed: true } }),
      ctx.prisma.user.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          isAdmin: true,
          createdAt: true,
        },
      }),
      ctx.prisma.organization.findMany({
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
          totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0,
      },
      recentUsers,
      recentOrganizations: recentOrganizations.map((org) => ({
        ...org,
        memberCount: org._count.members,
      })),
    };
  }),
});
