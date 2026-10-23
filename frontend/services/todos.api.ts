import { api } from './api';
import { Priority } from '../constants/priorities';
import { Tag } from './tags.api';
import { getQueue } from './offlineQueue';

export interface TodoStep {
  id: string;
  name: string;
  completed: boolean;
  position: number;
}

export interface Todo {
  id: string;
  user_id: string;
  tags: Tag[];
  steps?: TodoStep[];
  title: string;
  description: string;
  priority: Priority;
  sort_order?: number | null;
  deadline: string | null;
  planned_at: string | null;
  is_private: boolean;
  status: 'pending' | 'completed';
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTodoInput {
  title: string;
  description?: string;
  priority: Priority;
  tag_ids?: string[];
  deadline?: string | null;
  planned_at?: string | null;
  is_private?: boolean;
  steps?: Array<{ name: string; completed: boolean }>;
}

function withQueuedOrder(todo: Todo): Todo {
  const pending = getQueue().find((entry) => entry.resource === 'todo' && entry.resourceId === todo.id && entry.op === 'upsert');
  const rank = pending?.payload?.sort_order;
  return typeof rank === 'number' ? { ...todo, sort_order: rank } : todo;
}

export const todosApi = {
  list: (params?: { status?: string; priority?: string; urgency?: string; tag_ids?: string[] }) =>
    api
      .get<Todo[]>('/todos', {
        params: {
          status: params?.status,
          priority: params?.priority,
          urgency: params?.urgency,
          tag_ids: params?.tag_ids?.join(','),
        },
      })
      .then((r) => (r.data ?? []).map(withQueuedOrder)),

  get: (id: string) =>
    api.get<Todo>(`/todos/${id}`).then((r) => withQueuedOrder(r.data)),

  create: (data: CreateTodoInput) =>
    api.post<Todo>('/todos', data).then((r) => r.data),

  update: (id: string, data: CreateTodoInput) =>
    api.put<Todo>(`/todos/${id}`, data).then((r) => withQueuedOrder(r.data)),

  delete: (id: string) =>
    api.delete(`/todos/${id}`).then((r) => r.data),

  complete: (id: string) =>
    api.patch<Todo>(`/todos/${id}/complete`).then((r) => withQueuedOrder(r.data)),

  reopen: (id: string) =>
    api.patch<Todo>(`/todos/${id}/reopen`).then((r) => withQueuedOrder(r.data)),

  poke: (id: string) =>
    api.post<{ ok: boolean; delivered?: boolean }>(`/todos/${id}/poke`).then((r) => r.data),

  sync: (payload: SyncPayload) =>
    api.post<{ todos: Todo[]; tags: Tag[] }>('/sync', payload).then((r) => r.data),
};

/**
 * Batched local-first sync payload. Todos/tags are full snapshots keyed by
 * client-generated ID; the `deleted_*_ids` arrays are tombstones. The server
 * upserts the snapshots and removes the tombstones, scoped to the caller.
 */
export interface SyncPayload {
  todos: any[];
  tags: any[];
  deleted_todo_ids: string[];
  deleted_tag_ids: string[];
}
