import { QueryClient } from '@tanstack/react-query';
import { getIsOnline } from './networkStatus';
import { useOfflineQueue } from './offlineQueue';
import { todosApi, Todo, CreateTodoInput } from './todos.api';
import { Tag } from './tags.api';

/**
 * Offline-aware todo mutations.
 *
 * Each function follows the same pattern:
 * 1. Optimistically update the React Query cache immediately.
 * 2. If online → call the real API.
 * 3. If offline (or the API call fails) → queue a full local snapshot for sync.
 *
 * The local cache/store is always updated first — the UI never waits for the
 * network. This implements the "local-first" principle: the device is always
 * the source of truth for the user's own data.
 *
 * Queued payloads use the server's sync shape and carry the client-generated
 * ID, so the server upserts under the same ID the device uses. There is no ID
 * remapping after sync.
 */

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Resolve selected tag IDs to Tag objects from the local cache. */
function resolveTags(qc: QueryClient, tagIds?: string[] | null): Tag[] {
  if (!tagIds || tagIds.length === 0) return [];
  const all = qc.getQueryData<Tag[]>(['tags']) ?? [];
  const byId = new Map(all.map((t) => [t.id, t]));
  return tagIds
    .map((id) => byId.get(id))
    .filter((t): t is Tag => t !== undefined);
}

/** Serialize a Todo into the server's SyncTodo shape. */
function toSyncTodo(todo: Todo, tagIds?: string[] | null): Record<string, unknown> {
  return {
    id: todo.id,
    title: todo.title,
    description: todo.description,
    priority: todo.priority,
    deadline: todo.deadline,
    planned_at: todo.planned_at,
    is_private: todo.is_private,
    status: todo.status,
    completed_at: todo.completed_at,
    tag_ids: tagIds ?? todo.tags.map((t) => t.id),
    client_updated_at: todo.updated_at,
  };
}

function enqueueTodoUpsert(todo: Todo, tagIds?: string[] | null): void {
  useOfflineQueue.getState().enqueue({
    op: 'upsert',
    resource: 'todo',
    resourceId: todo.id,
    payload: toSyncTodo(todo, tagIds),
    clientUpdatedAt: new Date().toISOString(),
  });
}

function enqueueTodoDelete(id: string): void {
  useOfflineQueue.getState().enqueue({
    op: 'delete',
    resource: 'todo',
    resourceId: id,
    payload: null,
    clientUpdatedAt: new Date().toISOString(),
  });
}

/** Create a skeleton Todo for optimistic UI. */
function optimisticTodo(input: CreateTodoInput, userId: string, qc: QueryClient): Todo {
  const now = new Date().toISOString();
  return {
    id: generateId(), // client-side ID — canonical after sync (upsert by ID)
    user_id: userId,
    title: input.title,
    description: input.description ?? '',
    priority: input.priority,
    deadline: input.deadline ?? null,
    planned_at: input.planned_at ?? null,
    is_private: input.is_private ?? false,
    status: 'pending',
    completed_at: null,
    tags: resolveTags(qc, input.tag_ids),
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

function findInCaches(qc: QueryClient, id: string): Todo | undefined {
  return (
    qc.getQueryData<Todo>(['todo', id]) ??
    qc.getQueryData<Todo[]>(['todos', 'pending'])?.find((t) => t.id === id) ??
    qc.getQueryData<Todo[]>(['todos', 'completed'])?.find((t) => t.id === id)
  );
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
    const optimistic = optimisticTodo(input, userId, qc);
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
        enqueueTodoUpsert(optimistic, input.tag_ids);
        return optimistic;
      }
    } else {
      enqueueTodoUpsert(optimistic, input.tag_ids);
      return optimistic;
    }
  }

  async function updateTodo(id: string, input: CreateTodoInput): Promise<Todo> {
    const existing = findInCaches(qc, id);
    const now = new Date().toISOString();

    const optimistic: Todo = {
      id,
      user_id: existing?.user_id ?? userId,
      title: input.title,
      description: input.description ?? existing?.description ?? '',
      priority: input.priority,
      deadline: input.deadline ?? null,
      planned_at: input.planned_at ?? null,
      is_private: input.is_private ?? false,
      status: existing?.status ?? 'pending',
      completed_at: existing?.completed_at ?? null,
      tags: resolveTags(qc, input.tag_ids),
      created_at: existing?.created_at ?? now,
      updated_at: now,
    };

    updateInCaches(qc, optimistic);

    if (getIsOnline()) {
      try {
        const server = await todosApi.update(id, input);
        updateInCaches(qc, server);
        return server;
      } catch {
        enqueueTodoUpsert(optimistic, input.tag_ids);
        return optimistic;
      }
    } else {
      enqueueTodoUpsert(optimistic, input.tag_ids);
      return optimistic;
    }
  }

  async function deleteTodo(id: string): Promise<void> {
    removeFromCaches(qc, id);

    if (getIsOnline()) {
      try {
        await todosApi.delete(id);
      } catch {
        enqueueTodoDelete(id);
      }
    } else {
      enqueueTodoDelete(id);
    }
  }

  async function completeTodo(id: string): Promise<Todo> {
    // Optimistically move from pending → completed.
    const pending = qc.getQueryData<Todo[]>(['todos', 'pending'])?.find((t) => t.id === id) ?? null;

    qc.setQueryData<Todo[]>(['todos', 'pending'], (old) =>
      (old ?? []).filter((t) => t.id !== id)
    );

    let completed: Todo | null = null;
    if (pending) {
      completed = {
        ...pending,
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      qc.setQueryData<Todo[]>(['todos', 'completed'], (old) => [completed!, ...(old ?? [])]);
      qc.setQueryData<Todo>(['todo', id], completed);
    }

    if (!completed) {
      // Nothing to complete locally — let the server be the judge when online.
      if (getIsOnline()) {
        return todosApi.complete(id);
      }
      throw new Error('todo not found');
    }

    if (getIsOnline()) {
      try {
        const server = await todosApi.complete(id);
        updateInCaches(qc, server);
        return server;
      } catch {
        enqueueTodoUpsert(completed);
        return completed;
      }
    } else {
      enqueueTodoUpsert(completed);
      return completed;
    }
  }

  async function reopenTodo(id: string): Promise<Todo> {
    const completed =
      qc.getQueryData<Todo[]>(['todos', 'completed'])?.find((t) => t.id === id) ?? null;

    qc.setQueryData<Todo[]>(['todos', 'completed'], (old) =>
      (old ?? []).filter((t) => t.id !== id)
    );

    let reopened: Todo | null = null;
    if (completed) {
      reopened = {
        ...completed,
        status: 'pending',
        completed_at: null,
        updated_at: new Date().toISOString(),
      };
      qc.setQueryData<Todo[]>(['todos', 'pending'], (old) => [reopened!, ...(old ?? [])]);
      qc.setQueryData<Todo>(['todo', id], reopened);
    }

    if (!reopened) {
      if (getIsOnline()) {
        return todosApi.reopen(id);
      }
      throw new Error('todo not found');
    }

    if (getIsOnline()) {
      try {
        const server = await todosApi.reopen(id);
        updateInCaches(qc, server);
        return server;
      } catch {
        enqueueTodoUpsert(reopened);
        return reopened;
      }
    } else {
      enqueueTodoUpsert(reopened);
      return reopened;
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
