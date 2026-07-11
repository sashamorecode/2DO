import { api } from './api';

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface CreateTagInput {
  name: string;
  color: string;
}

export const tagsApi = {
  list: () => api.get<Tag[]>('/tags').then((r) => r.data),

  create: (data: CreateTagInput) =>
    api.post<Tag>('/tags', data).then((r) => r.data),

  update: (id: string, data: CreateTagInput) =>
    api.put<Tag>(`/tags/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    api.delete<{ ok: boolean }>(`/tags/${id}`).then((r) => r.data),
};
