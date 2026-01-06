"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTRPC } from "@/trpc/client";

export interface UseTodoListReturn {
  // Data
  todos: Array<{
    id: string;
    title: string;
    description: string | null;
    completed: boolean;
    createdAt: Date;
    organizationId: string;
    createdById: string;
    createdBy: {
      id: string;
      email: string;
    };
  }>;
  stats: {
    total: number;
    completed: number;
    pending: number;
    completionRate: number;
  } | null;
  subscription: {
    id: string;
    status: string;
    interval: string | null;
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    plan: {
      slug: string;
      name: string;
      limits: {
        maxTodos: number;
        maxMembers: number;
      };
    };
    usage: {
      todos: {
        current: number;
        limit: number;
      };
      members: {
        current: number;
        limit: number;
      };
    };
    hasStripeSubscription: boolean;
  } | null;

  // Loading states
  isLoadingTodos: boolean;
  isLoadingStats: boolean;
  isLoadingSubscription: boolean;

  // Mutation states
  isCreatingTodo: boolean;
  isTogglingTodo: boolean;
  isDeletingTodo: boolean;

  // Form state
  newTodoTitle: string;
  isCreating: boolean;
  showLimitDialog: boolean;

  // Handlers
  onNewTodoTitleChange: (value: string) => void;
  onCreateTodo: (e: React.FormEvent) => void;
  onAddButtonClick: () => void;
  onCancelCreate: () => void;
  onToggleTodo: (id: string) => void;
  onDeleteTodo: (id: string) => void;
  onCloseLimitDialog: () => void;

  // Permissions
  canDelete: boolean;
}

export function useTodoList(userRole: string): UseTodoListReturn {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [newTodoTitle, setNewTodoTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [showLimitDialog, setShowLimitDialog] = useState(false);

  const canDelete = userRole === "owner" || userRole === "admin";

  // Fetch todos
  const todosQuery = useQuery(trpc.todo.list.queryOptions({ limit: 50 }));

  // Fetch stats
  const statsQuery = useQuery(trpc.todo.stats.queryOptions());

  // Fetch subscription with usage
  const subscriptionQuery = useQuery(
    trpc.subscription.getCurrent.queryOptions(),
  );

  // Create todo mutation
  const createMutation = useMutation(
    trpc.todo.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.todo.list.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.todo.stats.queryKey() });
        queryClient.invalidateQueries({
          queryKey: trpc.subscription.getCurrent.queryKey(),
        });
        setNewTodoTitle("");
        setIsCreating(false);
      },
    }),
  );

  // Show limit dialog when todo creation fails due to limit
  useEffect(() => {
    if (
      createMutation.error?.message?.includes("limit reached") ||
      createMutation.error?.message?.includes("Upgrade your plan")
    ) {
      setShowLimitDialog(true);
    }
  }, [createMutation.error]);

  // Toggle completion mutation
  const toggleMutation = useMutation(
    trpc.todo.toggleComplete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.todo.list.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.todo.stats.queryKey() });
      },
    }),
  );

  // Delete mutation
  const deleteMutation = useMutation(
    trpc.todo.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.todo.list.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.todo.stats.queryKey() });
        queryClient.invalidateQueries({
          queryKey: trpc.subscription.getCurrent.queryKey(),
        });
      },
    }),
  );

  const handleCreateTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoTitle.trim()) return;

    // Check if at limit before attempting
    const usage = subscriptionQuery.data?.usage;
    const limit = subscriptionQuery.data?.plan?.limits?.maxTodos ?? -1;
    if (limit !== -1 && usage && usage.todos.current >= limit) {
      setShowLimitDialog(true);
      return;
    }

    createMutation.mutate({ title: newTodoTitle.trim() });
  };

  const handleAddButtonClick = () => {
    // Check if at limit before showing form
    const usage = subscriptionQuery.data?.usage;
    const limit = subscriptionQuery.data?.plan?.limits?.maxTodos ?? -1;
    if (limit !== -1 && usage && usage.todos.current >= limit) {
      setShowLimitDialog(true);
      return;
    }
    setIsCreating(true);
  };

  const handleCancelCreate = () => {
    setIsCreating(false);
    setNewTodoTitle("");
  };

  const handleToggleTodo = (id: string) => {
    toggleMutation.mutate({ id });
  };

  const handleDeleteTodo = (id: string) => {
    deleteMutation.mutate({ id });
  };

  const handleCloseLimitDialog = () => {
    setShowLimitDialog(false);
  };

  return {
    // Data
    todos: todosQuery.data?.items ?? [],
    stats: statsQuery.data ?? null,
    subscription: subscriptionQuery.data ?? null,

    // Loading states
    isLoadingTodos: todosQuery.isLoading,
    isLoadingStats: statsQuery.isLoading,
    isLoadingSubscription: subscriptionQuery.isLoading,

    // Mutation states
    isCreatingTodo: createMutation.isPending,
    isTogglingTodo: toggleMutation.isPending,
    isDeletingTodo: deleteMutation.isPending,

    // Form state
    newTodoTitle,
    isCreating,
    showLimitDialog,

    // Handlers
    onNewTodoTitleChange: setNewTodoTitle,
    onCreateTodo: handleCreateTodo,
    onAddButtonClick: handleAddButtonClick,
    onCancelCreate: handleCancelCreate,
    onToggleTodo: handleToggleTodo,
    onDeleteTodo: handleDeleteTodo,
    onCloseLimitDialog: handleCloseLimitDialog,

    // Permissions
    canDelete,
  };
}
