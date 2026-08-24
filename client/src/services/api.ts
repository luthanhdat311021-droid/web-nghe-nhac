import axios from 'axios';
import { Capacitor } from '@capacitor/core';

const getBaseURL = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
    return envUrl.trim();
  }
  if (Capacitor.isNativePlatform()) {
    return 'https://musicwave-app.vercel.app/api';
  }
  return '/api';
};

const api = axios.create({
  baseURL: getBaseURL(),
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('musicwave_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Token expired or invalid
      const hasToken = localStorage.getItem('musicwave_token');
      if (hasToken && !window.location.pathname.includes('/login')) {
        localStorage.removeItem('musicwave_token');
        localStorage.removeItem('musicwave_user');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
