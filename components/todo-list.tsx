"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Circle, Loader2, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { UpgradeLimitDialog, UpgradeNudge } from "@/components/upgrade-nudge";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";

export interface TodoListProps {
  userRole: string;
}

export function TodoList({ userRole }: TodoListProps) {
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

  const todos = todosQuery.data?.items ?? [];
  const stats = statsQuery.data;
  const subscription = subscriptionQuery.data;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Upgrade nudge */}
      {subscription && (
        <UpgradeNudge
          current={subscription.usage.todos.current}
          limit={subscription.usage.todos.limit}
          planName={subscription.plan.name}
        />
      )}

      {/* Upgrade limit dialog */}
      {subscription && (
        <UpgradeLimitDialog
          open={showLimitDialog}
          onOpenChange={setShowLimitDialog}
          current={subscription.usage.todos.current}
          limit={subscription.usage.todos.limit}
          planName={subscription.plan.name}
        />
      )}

      {/* Header with inline stats */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold tracking-tight mb-1">Tasks</h2>
        {stats && (
          <div
            className="flex items-center gap-4 text-sm text-muted-foreground"
            data-testid="todo-stats"
          >
            <span data-testid="todo-stats-total">
              <span className="font-medium text-foreground">{stats.total}</span>{" "}
              total
            </span>
            <span className="text-border">•</span>
            <span data-testid="todo-stats-completed">
              <span className="font-medium text-green-600">
                {stats.completed}
              </span>{" "}
              done
            </span>
            <span className="text-border">•</span>
            <span data-testid="todo-stats-pending">
              <span className="font-medium text-amber-600">
                {stats.pending}
              </span>{" "}
              pending
            </span>
            {stats.total > 0 && (
              <>
                <span className="text-border">•</span>
                <span data-testid="todo-stats-progress">
                  <span className="font-medium text-foreground">
                    {stats.completionRate}%
                  </span>{" "}
                  complete
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Create todo input */}
      <div className="mb-6" data-testid="todo-create-card">
        {isCreating ? (
          <form
            onSubmit={handleCreateTodo}
            className="flex items-center gap-2"
            data-testid="todo-create-form"
          >
            <div className="flex-1 relative">
              <Circle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
              <Input
                placeholder="What needs to be done?"
                value={newTodoTitle}
                onChange={(e) => setNewTodoTitle(e.target.value)}
                disabled={createMutation.isPending}
                autoFocus
                className="pl-10 h-11 bg-transparent border-muted-foreground/20 focus-visible:border-primary"
                data-testid="todo-create-input"
              />
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={createMutation.isPending || !newTodoTitle.trim()}
              className="h-11 px-4"
              data-testid="todo-create-submit"
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Check className="h-4 w-4 mr-1.5" />
                  Add
                </>
              )}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setIsCreating(false);
                setNewTodoTitle("");
              }}
              disabled={createMutation.isPending}
              className="h-11 px-3"
              data-testid="todo-create-cancel"
            >
              <X className="h-4 w-4" />
            </Button>
          </form>
        ) : (
          <button
            type="button"
            onClick={handleAddButtonClick}
            className="w-full flex items-center gap-3 px-3 py-3 text-muted-foreground hover:text-foreground rounded-lg border border-dashed border-muted-foreground/25 hover:border-muted-foreground/40 transition-colors"
            data-testid="todo-add-button"
          >
            <Plus className="h-4 w-4" />
            <span className="text-sm">Add a task...</span>
          </button>
        )}
      </div>

      {/* Todo list */}
      <div data-testid="todo-list-card">
        {todosQuery.isLoading ? (
          <div
            className="flex items-center justify-center py-12"
            data-testid="todo-list-loading"
          >
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : todos.length === 0 ? (
          <div className="py-12 text-center" data-testid="todo-list-empty">
            <p className="text-muted-foreground">No tasks yet</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Add your first task to get started
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/50" data-testid="todo-list">
            {todos.map((todo) => (
              <div
                key={todo.id}
                className="group flex items-center gap-3 py-3 px-1 -mx-1 rounded-lg hover:bg-muted/50 transition-colors"
                data-testid={`todo-item-${todo.id}`}
                data-todo-id={todo.id}
                data-todo-completed={todo.completed}
              >
                <Checkbox
                  checked={todo.completed}
                  onCheckedChange={() => toggleMutation.mutate({ id: todo.id })}
                  disabled={toggleMutation.isPending}
                  className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                  data-testid={`todo-checkbox-${todo.id}`}
                />
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      "text-sm transition-colors",
                      todo.completed && "text-muted-foreground line-through",
                    )}
                    data-testid={`todo-title-${todo.id}`}
                  >
                    {todo.title}
                  </p>
                  {todo.description && (
                    <p
                      className="text-xs text-muted-foreground/70 truncate mt-0.5"
                      data-testid={`todo-description-${todo.id}`}
                    >
                      {todo.description}
                    </p>
                  )}
                </div>
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                    onClick={() => deleteMutation.mutate({ id: todo.id })}
                    disabled={deleteMutation.isPending}
                    data-testid={`todo-delete-${todo.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Progress indicator */}
      {stats && stats.total > 0 && (
        <div className="mt-8 pt-6 border-t border-border/50">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>Progress</span>
            <span>{stats.completionRate}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-green-600 rounded-full transition-all duration-300"
              style={{ width: `${stats.completionRate}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
