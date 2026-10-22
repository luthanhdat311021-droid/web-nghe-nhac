import { create } from 'zustand';
import api from '../services/api.js';
import { Song } from '../types/index.js';
import { useAudioFxStore } from './audioFxStore.js';

export interface JamMemberInfo {
  id: string;
  username: string;
  avatarUrl: string | null;
  isHost: boolean;
}

export interface JamMessageInfo {
  id: string;
  userId: string;
  kind: 'chat' | 'queue' | 'sticker';
  text: string;
  createdAt: string;
  user?: { id: string; username: string; avatarUrl: string | null };
}

export interface JamSnapshot {
  ended: boolean;
  code: string;
  hostId: string;
  isHost: boolean;
  song: Song | null;
  positionSec: number;
  isPlaying: boolean;
  stateAt: string;
  serverNow: string;
  members: JamMemberInfo[];
  messages: JamMessageInfo[];
  pendingSongs: Song[];
}

const SESSION_KEY = 'musicwave_jam_code';
const readSavedCode = () => {
  try { return sessionStorage.getItem(SESSION_KEY); } catch { return null; }
};
const saveCode = (code: string | null) => {
  try { code ? sessionStorage.setItem(SESSION_KEY, code) : sessionStorage.removeItem(SESSION_KEY); } catch {}
};

interface JamState {
  code: string | null;
  isHost: boolean;
  hostId: string | null;
  roomSong: Song | null;
  roomPlaying: boolean;
  members: JamMemberInfo[];
  messages: JamMessageInfo[];
  ended: boolean;
  error: string | null;
  createRoom: () => Promise<string>;
  joinRoom: (code: string) => void;
  leaveRoom: () => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  sendSticker: (sticker: string) => Promise<void>;
  postMessage: (body: { text: string } | { sticker: string }) => Promise<void>;
  addSong: (songId: string) => Promise<string>;
  applySnapshot: (snap: JamSnapshot) => void;
  markEnded: () => void;
  reset: () => void;
}

const empty = { isHost: false, hostId: null, roomSong: null, roomPlaying: false, members: [], messages: [], ended: false, error: null };

export const useJamStore = create<JamState>((set, get) => ({
  code: readSavedCode(),
  ...empty,

  createRoom: async () => {
    const res = await api.post('/jam');
    const code = res.data.data.code as string;
    saveCode(code);
    set({ ...empty, code, isHost: true });
    return code;
  },

  joinRoom: (raw) => {
    const code = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    if (!code || code === get().code) return;
    saveCode(code);
    set({ ...empty, code });
  },

  leaveRoom: async () => {
    const code = get().code;
    get().reset();
    if (code) await api.post(`/jam/${code}/leave`).catch(() => {});
  },

  sendMessage: (text) => get().postMessage({ text }),
  sendSticker: (sticker) => get().postMessage({ sticker }),

  postMessage: async (body) => {
    const code = get().code;
    if (!code) return;
    const res = await api.post(`/jam/${code}/messages`, body);
    const message = res.data.data as JamMessageInfo;
    set((s) => ({ messages: s.messages.some((m) => m.id === message.id) ? s.messages : [...s.messages, message] }));
  },

  addSong: async (songId) => {
    const code = get().code;
    if (!code) throw new Error('Not in a room');
    const res = await api.post(`/jam/${code}/queue`, { songId });
    return res.data.message as string;
  },

  applySnapshot: (snap) => {
    set((s) => {
      const known = new Set(s.messages.map((m) => m.id));
      const fresh = snap.messages.filter((m) => !known.has(m.id));
      return {
        isHost: snap.isHost,
        hostId: snap.hostId,
        roomSong: snap.song,
        roomPlaying: snap.isPlaying,
        members: snap.members,
        messages: fresh.length ? [...s.messages, ...fresh].slice(-200) : s.messages,
        ended: false,
        error: null,
      };
    });
    useAudioFxStore.getState().setCrossfadeBlocked(!snap.isHost);
  },

  markEnded: () => {
    saveCode(null);
    set({ ended: true, roomPlaying: false });
    useAudioFxStore.getState().setCrossfadeBlocked(false);
  },

  reset: () => {
    saveCode(null);
    set({ code: null, ...empty });
    useAudioFxStore.getState().setCrossfadeBlocked(false);
  },
}));
