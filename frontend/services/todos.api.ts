import { api } from './api';
import { Priority } from '../constants/priorities';

export interface Todo {
  id: string;
  user_id: string;
  title: string;
  description: string;
  priority: Priority;
  deadline: string | null;
  status: 'pending' | 'completed';
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTodoInput {
  title: string;
  description?: string;
  priority: Priority;
  deadline?: string | null;
}

export const todosApi = {
  list: (params?: { status?: string; priority?: string }) =>
    api.get<Todo[]>('/todos', { params }).then((r) => r.data),

  create: (data: CreateTodoInput) =>
    api.post<Todo>('/todos', data).then((r) => r.data),

  update: (id: string, data: CreateTodoInput) =>
    api.put<Todo>(`/todos/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    api.delete(`/todos/${id}`).then((r) => r.data),

  complete: (id: string) =>
    api.patch<Todo>(`/todos/${id}/complete`).then((r) => r.data),
};
