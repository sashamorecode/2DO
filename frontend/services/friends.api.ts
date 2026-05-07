import { api } from './api';

export interface FriendItem {
  friendship_id: string;
  user: { id: string; username: string };
}

export interface FriendRequest {
  id: string;
  requester?: { id: string; username: string };
  addressee?: { id: string; username: string };
  status: string;
  created_at: string;
}

export const friendsApi = {
  list: () => api.get<FriendItem[]>('/friends').then((r) => r.data),

  incoming: () => api.get<FriendRequest[]>('/friends/requests').then((r) => r.data),

  sent: () => api.get<FriendRequest[]>('/friends/sent').then((r) => r.data),

  sendRequest: (addressee_id: string) =>
    api.post('/friends/request', { addressee_id }).then((r) => r.data),

  accept: (id: string) => api.patch(`/friends/${id}/accept`).then((r) => r.data),

  decline: (id: string) => api.patch(`/friends/${id}/decline`).then((r) => r.data),

  remove: (id: string) => api.delete(`/friends/${id}`).then((r) => r.data),

  searchUsers: (q: string) =>
    api.get<{ id: string; username: string }[]>('/users/search', { params: { q } }).then((r) => r.data),
};
