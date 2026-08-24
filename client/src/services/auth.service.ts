import api from './api.js';
import { ApiResponse, User } from '../types/index.js';

export const authService = {
  async register(data: { username: string; email: string; password: string }) {
    const res = await api.post<ApiResponse<{ user: User; token: string }>>('/auth/register', data);
    return res.data.data;
  },

  async login(data: { identifier: string; password: string }) {
    const res = await api.post<ApiResponse<{ user: User; token: string }>>('/auth/login', data);
    return res.data.data;
  },

  async getMe() {
    const res = await api.get<ApiResponse<User>>('/auth/me');
    return res.data.data;
  },

  async updateProfile(data: { username?: string; bio?: string; avatarUrl?: string }) {
    const res = await api.put<ApiResponse<User>>('/auth/profile', data);
    return res.data.data;
  },

  async changePassword(data: { currentPassword: string; newPassword: string }) {
    const res = await api.post<ApiResponse<null>>('/auth/change-password', data);
    return res.data;
  },

  async requestPasswordReset(email: string) {
    const res = await api.post<ApiResponse<{ cooldownSeconds: number; devOtp?: string; isDevMode?: boolean }>>('/auth/forgot-password/request', {
      email,
    });
    return res.data;
  },

  async verifyPasswordResetOtp(email: string, otp: string) {
    const res = await api.post<ApiResponse<{ resetToken: string }>>('/auth/forgot-password/verify-otp', {
      email,
      otp,
    });
    return res.data;
  },

  async resetPassword(data: { resetToken: string; newPassword: string; confirmPassword: string }) {
    const res = await api.post<ApiResponse<null>>('/auth/forgot-password/reset', data);
    return res.data;
  },
};
