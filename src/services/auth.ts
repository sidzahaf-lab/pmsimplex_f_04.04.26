// frontend/src/services/auth.ts
import { apiClient } from './api';

export const AuthAPI = {
  login: (email: string, password: string) => 
    apiClient.post('/auth/login', { email, password }),
  
  refreshToken: (refreshToken: string) =>
    apiClient.post('/auth/refresh-token', { refreshToken }),
  
  logout: (refreshToken: string) =>
    apiClient.post('/auth/logout', { refreshToken }),
  
  logoutAll: () =>
    apiClient.post('/auth/logout-all'),
  
  getMe: () => 
    apiClient.get('/auth/me'),
  
  changePassword: (currentPassword: string, newPassword: string) =>
    apiClient.post('/auth/change-password', { currentPassword, newPassword }),
};