import { api } from './api';
import { Todo } from './todos.api';

export interface FriendFeedItem {
  user: { id: string; username: string };
  todos: Todo[];
}

export interface FriendTodoDetail {
  todo: Todo;
  owner: { id: string; username: string | null };
}

interface FeedParams {
  friendId?: string;
  status?: 'pending' | 'completed';
}

export const feedApi = {
  get: (params?: FeedParams) =>
    api
      .get<FriendFeedItem[]>('/feed', {
        params: {
          friend_id: params?.friendId,
          status: params?.status,
        },
      })
      .then((r) => r.data),

  getTodo: (id: string) =>
    api.get<FriendTodoDetail>(`/feed/todos/${id}`).then((r) => r.data),
};
