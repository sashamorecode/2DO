import { api } from './api';
import { Todo } from './todos.api';

export interface BodyDoubleSession {
  id: string;
  requester_id: string;
  requester?: { id: string; username: string };
  todo_id?: string;
  todo?: Todo;
  message?: string;
  scheduled_at: string;
  created_at: string;
  updated_at: string;
  invitations?: BodyDoubleInvitation[];
}

export interface BodyDoubleInvitation {
  id: string;
  session_id: string;
  session?: BodyDoubleSession;
  invitee_id: string;
  invitee?: { id: string; username: string };
  status: 'pending' | 'accepted' | 'maybe' | 'declined';
  created_at: string;
  updated_at: string;
}

export interface CreateSessionInput {
  todo_id?: string;
  invitee_ids: string[];
  message?: string;
  scheduled_at: string;
}

export const bodyDoubleApi = {
  createSession: (data: CreateSessionInput) =>
    api.post<BodyDoubleSession>('/body-double/sessions', data).then((r) => r.data),

  listSessions: (role?: 'requester' | 'invitee') =>
    api
      .get<BodyDoubleSession[]>('/body-double/sessions', { params: { role } })
      .then((r) => r.data),

  getSession: (id: string) =>
    api.get<BodyDoubleSession>(`/body-double/sessions/${id}`).then((r) => r.data),

  respond: (invitationId: string, status: 'accepted' | 'maybe' | 'declined') =>
    api
      .patch<BodyDoubleInvitation & { created_todo?: Todo }>(
        `/body-double/invitations/${invitationId}/respond`,
        { status }
      )
      .then((r) => r.data),
};
