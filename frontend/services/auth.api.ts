import { api } from './api';

export interface AuthResponse {
  token: string;
  user: { id: string; username: string };
}

export const authApi = {
  register: (data: { username: string; email: string; password: string }) =>
    api.post<AuthResponse>('/auth/register', data).then((r) => r.data),

  login: (data: { email: string; password: string }) =>
    api.post<AuthResponse>('/auth/login', data).then((r) => r.data),
};
