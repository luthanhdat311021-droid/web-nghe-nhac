import { create } from 'zustand';
import { User } from '../types/index.js';
import { authService } from '../services/auth.service.js';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isLogoutModalOpen: boolean;
  login: (data: { identifier: string; password: string }) => Promise<void>;
  register: (data: { username: string; email: string; password: string }) => Promise<void>;
  logout: () => void;
  openLogoutModal: () => void;
  closeLogoutModal: () => void;
  fetchMe: () => Promise<void>;
  updateUser: (user: User) => void;
}

const getStoredToken = () => localStorage.getItem('musicwave_token');
const getStoredUser = (): User | null => {
  const userStr = localStorage.getItem('musicwave_user');
  if (userStr) {
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }
  return null;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: getStoredUser(),
  token: getStoredToken(),
  isAuthenticated: !!getStoredToken(),
  isLoading: false,
  isLogoutModalOpen: false,

  login: async (credentials) => {
    set({ isLoading: true });
    try {
      const { user, token } = await authService.login(credentials);
      localStorage.setItem('musicwave_token', token);
      localStorage.setItem('musicwave_user', JSON.stringify(user));
      set({ user, token, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  register: async (data) => {
    set({ isLoading: true });
    try {
      const { user, token } = await authService.register(data);
      localStorage.setItem('musicwave_token', token);
      localStorage.setItem('musicwave_user', JSON.stringify(user));
      set({ user, token, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  openLogoutModal: () => {
    set({ isLogoutModalOpen: true });
  },

  closeLogoutModal: () => {
    set({ isLogoutModalOpen: false });
  },

  logout: () => {
    localStorage.removeItem('musicwave_token');
    localStorage.removeItem('musicwave_user');
    set({ user: null, token: null, isAuthenticated: false, isLogoutModalOpen: false });
  },

  fetchMe: async () => {
    const token = getStoredToken();
    if (!token) return;

    try {
      const user = await authService.getMe();
      localStorage.setItem('musicwave_user', JSON.stringify(user));
      set({ user, isAuthenticated: true });
    } catch (error) {
      get().logout();
    }
  },

  updateUser: (user: User) => {
    localStorage.setItem('musicwave_user', JSON.stringify(user));
    set({ user });
  },
}));
