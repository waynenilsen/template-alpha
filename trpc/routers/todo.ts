import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";
import { authorizeMinimumRole } from "../../lib/auth/authorization";
import {
  checkTodoLimit,
  LimitExceededError,
} from "../../lib/subscriptions/service";
import { createTRPCRouter, orgProcedure } from "../init";

/**
 * Input schema for creating a todo
 */
const createTodoInput = z.object({
  title: z.string().min(1, "Title is required").max(255, "Title is too long"),
  description: z.string().max(1000, "Description is too long").optional(),
});

/**
 * Input schema for updating a todo
 */
const updateTodoInput = z.object({
  id: z.string().cuid(),
  title: z
    .string()
    .min(1, "Title is required")
    .max(255, "Title is too long")
    .optional(),
  description: z
    .string()
    .max(1000, "Description is too long")
    .nullable()
    .optional(),
  completed: z.boolean().optional(),
});

/**
 * Input schema for getting a single todo
 */
const getTodoInput = z.object({
  id: z.string().cuid(),
});

/**
 * Input schema for listing todos
 */
const listTodosInput = z.object({
  completed: z.boolean().optional(),
  limit: z.number().min(1).max(100).default(50),
  cursor: z.string().cuid().optional(),
});

/**
 * Input schema for deleting a todo
 */
const deleteTodoInput = z.object({
  id: z.string().cuid(),
});

/**
 * Todo router - handles todo CRUD operations
 * All procedures are org-scoped - user must have an active organization
 */
export const todoRouter = createTRPCRouter({
  /**
   * Create a new todo
   * Enforces plan limits - free tier is limited to 10 todos
   */
  create: orgProcedure
    .input(createTodoInput)
    .mutation(async ({ ctx, input }) => {
      // Check subscription limits
      try {
        const limitCheck = await checkTodoLimit(ctx.prisma, ctx.organizationId);
        if (!limitCheck.allowed) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Todo limit reached (${limitCheck.current}/${limitCheck.limit}). Upgrade your plan for more todos.`,
          });
        }
      } catch (error) {
        // If the error is already a TRPCError, rethrow it
        if (error instanceof TRPCError) {
          throw error;
        }
        // If limit checking fails (e.g., no plans configured), allow the operation
        // This makes the system gracefully degrade before stripe:sync is run
        if (error instanceof LimitExceededError) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: error.message,
          });
        }
        // Log other errors but don't block the operation
        console.warn("Failed to check todo limit:", error);
      }

      const todo = await ctx.prisma.todo.create({
        data: {
          title: input.title,
          description: input.description ?? null,
          organizationId: ctx.organizationId,
          createdById: ctx.user.id,
        },
      });

      return todo;
    }),

  /**
   * Get a single todo by ID
   * User must be a member of the organization that owns the todo
   */
  get: orgProcedure.input(getTodoInput).query(async ({ ctx, input }) => {
    const todo = await ctx.prisma.todo.findUnique({
      where: { id: input.id },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    if (!todo) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Todo not found",
      });
    }

    // Verify todo belongs to the current organization
    if (todo.organizationId !== ctx.organizationId && !ctx.user.isAdmin) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You do not have access to this todo",
      });
    }

    return todo;
  }),

  /**
   * List todos for the current organization
   * Supports filtering by completion status and cursor-based pagination
   */
  list: orgProcedure.input(listTodosInput).query(async ({ ctx, input }) => {
    const todos = await ctx.prisma.todo.findMany({
      where: {
        organizationId: ctx.organizationId,
        ...(input.completed !== undefined
          ? { completed: input.completed }
          : {}),
      },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: input.limit + 1, // Fetch one extra to determine if there's a next page
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    });

    let nextCursor: string | undefined;
    if (todos.length > input.limit) {
      todos.pop(); // Remove extra item
      nextCursor = todos[todos.length - 1]?.id; // Cursor is last returned item
    }

    return {
      items: todos,
      nextCursor,
    };
  }),

  /**
   * Update a todo
   * User must be a member of the organization that owns the todo
   */
  update: orgProcedure
    .input(updateTodoInput)
    .mutation(async ({ ctx, input }) => {
      // First fetch the todo to verify ownership
      const existing = await ctx.prisma.todo.findUnique({
        where: { id: input.id },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Todo not found",
        });
      }

      // Verify todo belongs to the current organization
      if (existing.organizationId !== ctx.organizationId && !ctx.user.isAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have access to this todo",
        });
      }

      // Build update data
      const updateData: {
        title?: string;
        description?: string | null;
        completed?: boolean;
      } = {};

      if (input.title !== undefined) {
        updateData.title = input.title;
      }
      if (input.description !== undefined) {
        updateData.description = input.description;
      }
      if (input.completed !== undefined) {
        updateData.completed = input.completed;
      }

      const todo = await ctx.prisma.todo.update({
        where: { id: input.id },
        data: updateData,
        include: {
          createdBy: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      });

      return todo;
    }),

  /**
   * Delete a todo
   * Only admins and owners of the organization can delete todos
   */
  delete: orgProcedure
    .input(deleteTodoInput)
    .mutation(async ({ ctx, input }) => {
      // First fetch the todo to verify ownership
      const existing = await ctx.prisma.todo.findUnique({
        where: { id: input.id },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Todo not found",
        });
      }

      // Verify todo belongs to the current organization
      if (existing.organizationId !== ctx.organizationId && !ctx.user.isAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have access to this todo",
        });
      }

      // Check if user has permission to delete (admin role or higher, or internal admin)
      if (!ctx.user.isAdmin && ctx.membership) {
        const authResult = await authorizeMinimumRole(
          ctx.prisma,
          ctx.user.id,
          ctx.organizationId,
          "admin",
        );

        if (!authResult.authorized) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only organization admins can delete todos",
          });
        }
      }

      await ctx.prisma.todo.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),

  /**
   * Toggle todo completion status
   */
  toggleComplete: orgProcedure
    .input(getTodoInput)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.todo.findUnique({
        where: { id: input.id },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Todo not found",
        });
      }

      // Verify todo belongs to the current organization
      if (existing.organizationId !== ctx.organizationId && !ctx.user.isAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have access to this todo",
        });
      }

      const todo = await ctx.prisma.todo.update({
        where: { id: input.id },
        data: { completed: !existing.completed },
        include: {
          createdBy: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      });

      return todo;
    }),

  /**
   * Get todo stats for the current organization
   */
  stats: orgProcedure.query(async ({ ctx }) => {
    const [total, completed, pending] = await Promise.all([
      ctx.prisma.todo.count({
        where: { organizationId: ctx.organizationId },
      }),
      ctx.prisma.todo.count({
        where: { organizationId: ctx.organizationId, completed: true },
      }),
      ctx.prisma.todo.count({
        where: { organizationId: ctx.organizationId, completed: false },
      }),
    ]);

    return {
      total,
      completed,
      pending,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }),
});
