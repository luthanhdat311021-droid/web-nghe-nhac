import api from './api.js';
import { ApiResponse, HistoryItem } from '../types/index.js';

export const historyService = {
  async getHistory(limit?: number) {
    const res = await api.get<ApiResponse<HistoryItem[]>>('/history', { params: { limit } });
    return res.data.data;
  },

  async clearHistory() {
    const res = await api.delete<ApiResponse<null>>('/history');
    return res.data;
  },
};
