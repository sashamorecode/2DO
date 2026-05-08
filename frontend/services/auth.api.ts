import { api } from './api';

export interface AuthUser {
  id: string;
  username: string | null;
  email: string;
  timezone?: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

interface UpdateProfileInput {
  username?: string;
  timezone?: string;
}

export const authApi = {
  google: (idToken: string) =>
    api.post<AuthResponse>('/auth/google', { id_token: idToken }).then((r) => r.data),

  startEmailOTP: (email: string) =>
    api.post<{ ok: true }>('/auth/email/start', { email }).then((r) => r.data),

  verifyEmailOTP: (email: string, code: string) =>
    api.post<AuthResponse>('/auth/email/verify', { email, code }).then((r) => r.data),

  updateProfile: (input: string | UpdateProfileInput) => {
    const body = typeof input === 'string' ? { username: input } : input;
    return api.patch<{ user: AuthUser }>('/me', body).then((r) => r.data.user);
  },

  fetchMe: () => api.get<{ user: AuthUser }>('/me').then((r) => r.data.user),
};
