/**
 * Local Storage Search History Manager
 * MusicWave AI Smart Search Engine
 */

const STORAGE_KEY = 'musicwave_search_history_v1';
const MAX_HISTORY_ITEMS = 10;

export const searchHistoryUtil = {
  getHistory(): string[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  addSearch(query: string): string[] {
    const clean = String(query || '').trim();
    if (!clean) return this.getHistory();

    try {
      const current = this.getHistory();
      // Remove duplicate
      const filtered = current.filter((item) => item.toLowerCase() !== clean.toLowerCase());
      // Insert at front
      const updated = [clean, ...filtered].slice(0, MAX_HISTORY_ITEMS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    } catch {
      return [];
    }
  },

  removeSearch(query: string): string[] {
    const clean = String(query || '').trim();
    try {
      const current = this.getHistory();
      const updated = current.filter((item) => item.toLowerCase() !== clean.toLowerCase());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    } catch {
      return [];
    }
  },

  clearAll(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  },
};
