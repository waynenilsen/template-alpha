"use client";

import { useTodoList } from "@/hooks/use-todo-list";
import { TodoListView } from "./todo-list-view";

export interface TodoListProps {
  userRole: string;
}

/**
 * TodoList - Connected wrapper component
 * Connects the useTodoList hook with the TodoListView presentation component
 */
export function TodoList({ userRole }: TodoListProps) {
  const todoListState = useTodoList(userRole);

  return <TodoListView {...todoListState} />;
}
