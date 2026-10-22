import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Users } from 'lucide-react';
import api from '../../services/api.js';
import { useJamStore, JamSnapshot } from '../../store/jamStore.js';
import { usePlayerStore } from '../../store/playerStore.js';
import { useAuthStore } from '../../store/authStore.js';

const POLL_MS = 2000;
const HOST_HEARTBEAT_MS = 5000;
const DRIFT_TOLERANCE_SEC = 2;

/**
 * Keeps this device in step with its Jam room while the user browses anywhere in the app.
 * Host: publishes play/pause/seek/song changes. Guest: mirrors the host's state and corrects drift.
 */
export const JamSync: React.FC = () => {
  const code = useJamStore((s) => s.code);
  const ended = useJamStore((s) => s.ended);
  const isHost = useJamStore((s) => s.isHost);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const location = useLocation();

  // ---- Polling loop (everyone) -------------------------------------------------
  useEffect(() => {
    if (!code || ended || !isAuthenticated) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let since: string | null = null;
    // A guest only tries each room song once, so a refused admission (e.g. daily limit) isn't retried every poll.
    let attemptedSongId: string | null = null;

    const followHost = (snap: JamSnapshot, rttMs: number) => {
      const player = usePlayerStore.getState();
      if (player.isAuthorizing) return;
      if (!snap.song) {
        if (player.isPlaying) player.pause();
        return;
      }
      if (player.currentSong?.id !== snap.song.id) {
        if (attemptedSongId === snap.song.id) return;
        attemptedSongId = snap.song.id;
        player.playSong(snap.song, [snap.song]);
        return;
      }
      if (snap.isPlaying && !player.isPlaying && !player.playbackError) player.resume();
      if (!snap.isPlaying && player.isPlaying) player.pause();
      const elapsed = snap.isPlaying ? (Date.parse(snap.serverNow) - Date.parse(snap.stateAt) + rttMs / 2) / 1000 : 0;
      const expected = snap.positionSec + elapsed;
      const fresh = usePlayerStore.getState();
      if (fresh.duration > 0 && !fresh.isBuffering && Math.abs(fresh.currentTime - expected) > DRIFT_TOLERANCE_SEC) {
        fresh.seek(Math.max(0, Math.min(expected, fresh.duration - 1)));
      }
    };

    const poll = async () => {
      const startedAt = Date.now();
      try {
        const res = await api.get(`/jam/${code}`, { params: since ? { since } : {} });
        if (stopped) return;
        const snap = res.data.data as JamSnapshot;
        if (snap.ended) {
          useJamStore.getState().markEnded();
          return;
        }
        useJamStore.getState().applySnapshot(snap);
        if (snap.messages.length) since = snap.messages[snap.messages.length - 1].createdAt;
        if (snap.isHost) {
          const player = usePlayerStore.getState();
          snap.pendingSongs.forEach((song) => player.addToQueue(song));
          if (!player.currentSong && snap.pendingSongs.length) player.playSong(snap.pendingSongs[0], snap.pendingSongs);
        } else {
          followHost(snap, Date.now() - startedAt);
        }
      } catch (error: any) {
        if (error.response?.status === 401) useJamStore.getState().reset();
      }
      if (!stopped) timer = setTimeout(poll, POLL_MS);
    };
    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [code, ended, isAuthenticated]);

  // ---- Host publishing -----------------------------------------------------------
  useEffect(() => {
    if (!code || ended || !isHost) return;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let lastSent = { songId: '' as string | null, isPlaying: false, position: 0, at: 0 };

    const publish = () => {
      const p = usePlayerStore.getState();
      const state = {
        songId: p.currentSong?.id ?? null,
        positionSec: Math.max(0, p.currentTime || 0),
        isPlaying: p.isPlaying && !p.isAuthorizing && !p.isBuffering,
      };
      lastSent = { songId: state.songId, isPlaying: state.isPlaying, position: state.positionSec, at: Date.now() };
      api.put(`/jam/${code}/state`, state).catch(() => {});
    };
    const schedule = () => {
      clearTimeout(debounce);
      debounce = setTimeout(publish, 400);
    };

    publish();
    const unsubscribe = usePlayerStore.subscribe((s, prev) => {
      const songChanged = s.currentSong?.id !== prev.currentSong?.id;
      const playChanged = (s.isPlaying && !s.isBuffering) !== (prev.isPlaying && !prev.isBuffering);
      // A seek shows up as currentTime moving far from where steady playback would put it.
      const predicted = lastSent.position + (lastSent.isPlaying ? (Date.now() - lastSent.at) / 1000 : 0);
      const seeked = s.currentSong?.id === lastSent.songId && Math.abs(s.currentTime - predicted) > DRIFT_TOLERANCE_SEC;
      if (songChanged || playChanged || seeked) schedule();
    });
    const heartbeat = setInterval(() => {
      if (usePlayerStore.getState().isPlaying) publish();
    }, HOST_HEARTBEAT_MS);
    return () => {
      unsubscribe();
      clearTimeout(debounce);
      clearInterval(heartbeat);
    };
  }, [code, ended, isHost]);

  if (!code || location.pathname.startsWith('/jam')) return null;
  return (
    <Link
      to={`/jam/${code}`}
      className="fixed z-40 right-3 md:right-6 bottom-[calc(56px+68px+env(safe-area-inset-bottom)+0.75rem)] md:bottom-24 flex items-center gap-2 rounded-full bg-emerald-400 text-black pl-3 pr-4 py-2 text-xs font-bold shadow-lg shadow-emerald-500/30 hover:scale-105 active:scale-95 transition-transform"
    >
      <span className="relative flex w-2 h-2">
        <span className="absolute inline-flex w-full h-full rounded-full bg-black/60 animate-ping" />
        <span className="relative inline-flex w-2 h-2 rounded-full bg-black" />
      </span>
      <Users className="w-4 h-4" />
      {ended ? 'Phòng đã kết thúc' : `Nghe chung · ${code}`}
    </Link>
  );
};
