import { api } from './api';
import { Todo } from './todos.api';

export interface FriendFeedItem {
  user: { id: string; username: string };
  todos: Todo[];
}

export const feedApi = {
  get: (friendId?: string) =>
    api
      .get<FriendFeedItem[]>('/feed', { params: friendId ? { friend_id: friendId } : undefined })
      .then((r) => r.data),
};
