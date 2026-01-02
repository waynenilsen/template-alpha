/**
 * Todo factory for test harness
 */

import type { PrismaClient, Todo } from "../../../generated/prisma/client";
import type { CreateTodoOptions } from "../types";
import { generateUniqueId } from "../utils";

export function createTodoFactory(
  prisma: PrismaClient,
  prefix: string,
  todoIds: Set<string>,
) {
  return async (options: CreateTodoOptions): Promise<Todo> => {
    const uniqueId = generateUniqueId();
    const title = options.title ?? `${prefix}Todo ${uniqueId}`;

    const todo = await prisma.todo.create({
      data: {
        title,
        description: options.description ?? null,
        completed: options.completed ?? false,
        organizationId: options.organizationId,
        createdById: options.createdById,
      },
    });

    todoIds.add(todo.id);
    return todo;
  };
}
