import { QueryClient } from '@tanstack/react-query';
import { getIsOnline } from './networkStatus';
import { useOfflineQueue, QueuedMutation } from './offlineQueue';
import { todosApi, Todo, CreateTodoInput } from './todos.api';

/**
 * Offline-aware todo mutations.
 *
 * Each function follows the same pattern:
 * 1. Optimistically update the React Query cache immediately.
 * 2. If online → call the real API.
 * 3. If offline → enqueue the mutation for later sync.
 *
 * The local cache is always updated first — the UI never waits for the
 * network. This implements the "local-first" principle: the device is
 * always the source of truth for the user's own data.
 */

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Create a skeleton Todo for optimistic UI. */
function optimisticTodo(input: CreateTodoInput, userId: string): Todo {
  const now = new Date().toISOString();
  return {
    id: generateId(), // client-side ID — replaced by server ID after sync
    user_id: userId,
    title: input.title,
    description: input.description ?? '',
    priority: input.priority,
    deadline: input.deadline ?? null,
    planned_at: input.planned_at ?? null,
    is_private: input.is_private ?? false,
    status: 'pending',
    completed_at: null,
    tags: [], // tags are resolved on the next server fetch
    created_at: now,
    updated_at: now,
  };
}

/** Prepend a todo to the pending list cache. */
function prependToPendingCache(qc: QueryClient, todo: Todo): void {
  qc.setQueryData<Todo[]>(['todos', 'pending'], (old) => [todo, ...(old ?? [])]);
}

/** Remove a todo from all local caches. */
function removeFromCaches(qc: QueryClient, id: string): void {
  qc.setQueryData<Todo[]>(['todos', 'pending'], (old) => (old ?? []).filter((t) => t.id !== id));
  qc.setQueryData<Todo[]>(['todos', 'completed'], (old) => (old ?? []).filter((t) => t.id !== id));
  qc.removeQueries({ queryKey: ['todo', id] });
}

/** Update a todo in-place across caches. */
function updateInCaches(qc: QueryClient, updated: Todo): void {
  const updater = (old: Todo[] | undefined) =>
    (old ?? []).map((t) => (t.id === updated.id ? updated : t));
  qc.setQueryData<Todo[]>(['todos', 'pending'], updater);
  qc.setQueryData<Todo[]>(['todos', 'completed'], updater);
  qc.setQueryData<Todo>(['todo', updated.id], updated);
}

function enqueueTodoOp(
  op: QueuedMutation['op'],
  resourceId: string | undefined,
  payload: any
): void {
  useOfflineQueue.getState().enqueue({
    op,
    resource: 'todo',
    resourceId,
    payload,
    clientUpdatedAt: new Date().toISOString(),
  });
}

export interface OfflineTodoOps {
  createTodo: (input: CreateTodoInput) => Promise<Todo>;
  updateTodo: (id: string, input: CreateTodoInput) => Promise<Todo>;
  deleteTodo: (id: string) => Promise<void>;
  completeTodo: (id: string) => Promise<Todo>;
  reopenTodo: (id: string) => Promise<Todo>;
  refreshPendingCount: () => void;
}

/**
 * Hook that returns offline-aware todo mutation functions.
 * Needs access to QueryClient (from React context) and the user ID.
 */
export function useOfflineTodoOps(qc: QueryClient, userId: string): OfflineTodoOps {
  function refreshPendingCount(): void {
    // Triggered by components to update sync badge.
    // The offline store already tracks this; just re-sync counts.
  }

  async function createTodo(input: CreateTodoInput): Promise<Todo> {
    const optimistic = optimisticTodo(input, userId);
    prependToPendingCache(qc, optimistic);

    if (getIsOnline()) {
      try {
        const server = await todosApi.create(input);
        // Replace the optimistic todo with the server version.
        removeFromCaches(qc, optimistic.id);
        prependToPendingCache(qc, server);
        qc.setQueryData(['todo', server.id], server);
        return server;
      } catch {
        // API failed — keep optimistic copy and queue.
        enqueueTodoOp('create', optimistic.id, input);
        return optimistic;
      }
    } else {
      enqueueTodoOp('create', optimistic.id, input);
      return optimistic;
    }
  }

  async function updateTodo(id: string, input: CreateTodoInput): Promise<Todo> {
    // Build an optimistic merged todo from cache.
    const existing =
      qc.getQueryData<Todo>(['todo', id]) ??
      qc.getQueryData<Todo[]>(['todos', 'pending'])?.find((t) => t.id === id) ??
      qc.getQueryData<Todo[]>(['todos', 'completed'])?.find((t) => t.id === id);

    const optimistic: Todo = existing
      ? {
          ...existing,
          title: input.title,
          description: input.description ?? existing.description,
          priority: input.priority,
          deadline: input.deadline ?? null,
          planned_at: input.planned_at ?? null,
          is_private: input.is_private ?? false,
          updated_at: new Date().toISOString(),
        }
      : {
          id,
          user_id: userId,
          title: input.title,
          description: input.description ?? '',
          priority: input.priority,
          deadline: input.deadline ?? null,
          planned_at: input.planned_at ?? null,
          is_private: input.is_private ?? false,
          status: 'pending',
          completed_at: null,
          tags: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

    updateInCaches(qc, optimistic);

    if (getIsOnline()) {
      try {
        const server = await todosApi.update(id, input);
        updateInCaches(qc, server);
        return server;
      } catch {
        enqueueTodoOp('update', id, input);
        return optimistic;
      }
    } else {
      enqueueTodoOp('update', id, input);
      return optimistic;
    }
  }

  async function deleteTodo(id: string): Promise<void> {
    removeFromCaches(qc, id);

    if (getIsOnline()) {
      try {
        await todosApi.delete(id);
      } catch {
        enqueueTodoOp('delete', id, null);
      }
    } else {
      enqueueTodoOp('delete', id, null);
    }
  }

  async function completeTodo(id: string): Promise<Todo> {
    // Optimistically move from pending → completed.
    const pending =
      qc.getQueryData<Todo[]>(['todos', 'pending'])?.find((t) => t.id === id) ??
      null;

    qc.setQueryData<Todo[]>(['todos', 'pending'], (old) =>
      (old ?? []).filter((t) => t.id !== id)
    );

    if (pending) {
      const completed: Todo = {
        ...pending,
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      qc.setQueryData<Todo[]>(['todos', 'completed'], (old) => [
        completed,
        ...(old ?? []),
      ]);
      qc.setQueryData<Todo>(['todo', id], completed);
    }

    if (getIsOnline()) {
      try {
        const server = await todosApi.complete(id);
        updateInCaches(qc, server);
        return server;
      } catch {
        enqueueTodoOp('complete', id, null);
        return pending!;
      }
    } else {
      enqueueTodoOp('complete', id, null);
      return pending!;
    }
  }

  async function reopenTodo(id: string): Promise<Todo> {
    const completed =
      qc.getQueryData<Todo[]>(['todos', 'completed'])?.find((t) => t.id === id) ??
      null;

    qc.setQueryData<Todo[]>(['todos', 'completed'], (old) =>
      (old ?? []).filter((t) => t.id !== id)
    );

    if (completed) {
      const reopened: Todo = {
        ...completed,
        status: 'pending',
        completed_at: null,
        updated_at: new Date().toISOString(),
      };
      qc.setQueryData<Todo[]>(['todos', 'pending'], (old) => [
        reopened,
        ...(old ?? []),
      ]);
      qc.setQueryData<Todo>(['todo', id], reopened);
    }

    if (getIsOnline()) {
      try {
        const server = await todosApi.reopen(id);
        updateInCaches(qc, server);
        return server;
      } catch {
        enqueueTodoOp('reopen', id, null);
        return completed!;
      }
    } else {
      enqueueTodoOp('reopen', id, null);
      return completed!;
    }
  }

  return {
    createTodo,
    updateTodo,
    deleteTodo,
    completeTodo,
    reopenTodo,
    refreshPendingCount,
  };
}
