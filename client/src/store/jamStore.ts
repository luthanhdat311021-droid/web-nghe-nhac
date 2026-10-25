import { useMemo } from 'react';
import { create } from 'zustand';
import api from '../services/api.js';
import { Song } from '../types/index.js';
import { useAudioFxStore } from './audioFxStore.js';
import { usePlayerStore } from './playerStore.js';

export interface JamMemberInfo {
  id: string;
  username: string;
  avatarUrl: string | null;
  isHost: boolean;
  quizScore: number;
}

export interface JamQuizState {
  round: number;
  active: boolean;
  endsAt: string | null;
  options: { id: string; title: string; artistName: string }[];
  correctId: string | null; // guests receive it only after the round closes
  myChoiceId: string | null;
  myPoints: number | null;
}

export interface JamMessageInfo {
  id: string;
  userId: string;
  kind: 'chat' | 'queue' | 'sticker' | 'quiz';
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
  quiz: JamQuizState | null;
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
  quiz: JamQuizState | null;
  serverOffsetMs: number; // server clock minus local clock, for the quiz countdown
  startQuiz: () => Promise<void>;
  answerQuiz: (songId: string) => Promise<{ correct: boolean; points: number }>;
  revealQuiz: () => Promise<void>;
  resetQuiz: () => Promise<void>;
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

const empty = { isHost: false, hostId: null, roomSong: null, roomPlaying: false, members: [], messages: [], ended: false, error: null,
  quiz: null, serverOffsetMs: 0 };

export const useJamStore = create<JamState>((set, get) => ({
  code: readSavedCode(),
  ...empty,

  startQuiz: async () => {
    const code = get().code;
    if (!code) return;
    const res = await api.post(`/jam/${code}/quiz/start`);
    const song = res.data.data.song as Song;
    // The host's player is what the room hears; JamSync publishes it to every guest.
    usePlayerStore.getState().playSong(song, [song]);
  },

  answerQuiz: async (songId) => {
    const code = get().code;
    if (!code) throw new Error('Not in a room');
    const res = await api.post(`/jam/${code}/quiz/answer`, { songId });
    const result = res.data.data as { correct: boolean; points: number };
    set((s) => ({ quiz: s.quiz && { ...s.quiz, myChoiceId: songId, myPoints: result.points } }));
    return result;
  },

  revealQuiz: async () => {
    const code = get().code;
    if (code) await api.post(`/jam/${code}/quiz/reveal`);
  },

  resetQuiz: async () => {
    const code = get().code;
    if (code) await api.post(`/jam/${code}/quiz/reset`);
  },

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
        quiz: snap.quiz,
        serverOffsetMs: Date.parse(snap.serverNow) - Date.now(),
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

export const QUIZ_COVER = '/logo.png';

/** While a quiz round runs, guests must not see what the room is playing: swap in a mystery title and cover. */
export const useQuizMask = <T extends Song | null>(song: T): T => {
  const hide = useJamStore((s) => !!s.quiz?.active && !s.isHost && !!song && s.roomSong?.id === song.id);
  return useMemo(
    () => (hide && song
      ? { ...song, title: 'Bài hát bí ẩn', coverUrl: QUIZ_COVER, album: undefined,
          artist: song.artist && { ...song.artist, name: 'Đang đoán bài…' } }
      : song),
    [hide, song],
  );
};
