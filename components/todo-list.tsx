"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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

  const canDelete = userRole === "owner" || userRole === "admin";

  // Fetch todos
  const todosQuery = useQuery(trpc.todo.list.queryOptions({ limit: 50 }));

  // Fetch stats
  const statsQuery = useQuery(trpc.todo.stats.queryOptions());

  // Create todo mutation
  const createMutation = useMutation(
    trpc.todo.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.todo.list.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.todo.stats.queryKey() });
        setNewTodoTitle("");
        setIsCreating(false);
      },
    }),
  );

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
      },
    }),
  );

  const handleCreateTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoTitle.trim()) return;
    createMutation.mutate({ title: newTodoTitle.trim() });
  };

  const todos = todosQuery.data?.items ?? [];
  const stats = statsQuery.data;

  return (
    <div className="space-y-6">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Completed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats.completed}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">
                {stats.pending}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completionRate}%</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Create todo form */}
      <Card>
        <CardContent className="pt-6">
          {isCreating ? (
            <form onSubmit={handleCreateTodo} className="flex gap-2">
              <Input
                placeholder="What needs to be done?"
                value={newTodoTitle}
                onChange={(e) => setNewTodoTitle(e.target.value)}
                disabled={createMutation.isPending}
                autoFocus
              />
              <Button
                type="submit"
                size="icon"
                disabled={createMutation.isPending || !newTodoTitle.trim()}
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => {
                  setIsCreating(false);
                  setNewTodoTitle("");
                }}
                disabled={createMutation.isPending}
              >
                <X className="h-4 w-4" />
              </Button>
            </form>
          ) : (
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={() => setIsCreating(true)}
            >
              <Plus className="h-4 w-4" />
              Add a todo
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Todo list */}
      <Card>
        <CardHeader>
          <CardTitle>Todos</CardTitle>
        </CardHeader>
        <CardContent>
          {todosQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : todos.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No todos yet. Create one to get started!
            </div>
          ) : (
            <div className="space-y-2">
              {todos.map((todo) => (
                <div
                  key={todo.id}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <Checkbox
                    checked={todo.completed}
                    onCheckedChange={() =>
                      toggleMutation.mutate({ id: todo.id })
                    }
                    disabled={toggleMutation.isPending}
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "text-sm font-medium truncate",
                        todo.completed && "text-muted-foreground line-through",
                      )}
                    >
                      {todo.title}
                    </p>
                    {todo.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {todo.description}
                      </p>
                    )}
                  </div>
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteMutation.mutate({ id: todo.id })}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
