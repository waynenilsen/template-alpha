import { Check, Circle, Loader2, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { UpgradeLimitDialog } from "@/components/upgrade-limit-dialog";
import { UpgradeNudge } from "@/components/upgrade-nudge";
import { cn } from "@/lib/utils";

export interface TodoItem {
  id: string;
  title: string;
  description: string | null;
  completed: boolean;
}

export interface TodoStats {
  total: number;
  completed: number;
  pending: number;
  completionRate: number;
}

export interface TodoSubscription {
  usage: {
    todos: {
      current: number;
      limit: number;
    };
  };
  plan: {
    name: string;
  };
}

export interface TodoListViewProps {
  // Data
  todos: TodoItem[];
  stats: TodoStats | null;
  subscription: TodoSubscription | null;

  // Loading states
  isLoadingTodos: boolean;

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

export function TodoListView({
  todos,
  stats,
  subscription,
  isLoadingTodos,
  isCreatingTodo,
  isTogglingTodo,
  isDeletingTodo,
  newTodoTitle,
  isCreating,
  showLimitDialog,
  onNewTodoTitleChange,
  onCreateTodo,
  onAddButtonClick,
  onCancelCreate,
  onToggleTodo,
  onDeleteTodo,
  onCloseLimitDialog,
  canDelete,
}: TodoListViewProps) {
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
          onOpenChange={onCloseLimitDialog}
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
            onSubmit={onCreateTodo}
            className="flex items-center gap-2"
            data-testid="todo-create-form"
          >
            <div className="flex-1 relative">
              <Circle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
              <Input
                placeholder="What needs to be done?"
                value={newTodoTitle}
                onChange={(e) => onNewTodoTitleChange(e.target.value)}
                disabled={isCreatingTodo}
                autoFocus
                className="pl-10 h-11 bg-transparent border-muted-foreground/20 focus-visible:border-primary"
                data-testid="todo-create-input"
              />
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={isCreatingTodo || !newTodoTitle.trim()}
              className="h-11 px-4"
              data-testid="todo-create-submit"
            >
              {isCreatingTodo ? (
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
              onClick={onCancelCreate}
              disabled={isCreatingTodo}
              className="h-11 px-3"
              data-testid="todo-create-cancel"
            >
              <X className="h-4 w-4" />
            </Button>
          </form>
        ) : (
          <button
            type="button"
            onClick={onAddButtonClick}
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
        {isLoadingTodos ? (
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
                  onCheckedChange={() => onToggleTodo(todo.id)}
                  disabled={isTogglingTodo}
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
                    onClick={() => onDeleteTodo(todo.id)}
                    disabled={isDeletingTodo}
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
