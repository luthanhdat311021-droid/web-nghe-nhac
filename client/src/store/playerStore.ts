import { create } from 'zustand';
import { Song } from '../types/index.js';
import { songService } from '../services/song.service.js';
import { isYouTubeSource, getSongYoutubeId } from '../utils/youtube.js';
import { getMediaUrl } from '../utils/media.js';
import { isNativeAudioAvailable, nativeAudio } from '../services/nativeAudio.js';

type RepeatMode = 'off' | 'all' | 'one';

let playbackRequestId = 0;

interface PlayerState {
  audio: HTMLAudioElement | null;
  currentSong: Song | null;
  isPlaying: boolean;
  isBuffering: boolean;
  playbackError: string | null;
  currentTime: number;
  duration: number;
  buffered: number;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  repeatMode: RepeatMode;
  isShuffle: boolean;
  queue: Song[];
  queueIndex: number;
  isLyricsOpen: boolean;
  isQueueOpen: boolean;
  isFullScreenPlayerOpen: boolean;

  // Actions
  initAudio: () => void;
  playSong: (song: Song, newQueue?: Song[]) => void;
  togglePlay: () => void;
  pause: () => void;
  resume: () => void;
  nextSong: () => void;
  previousSong: () => void;
  seek: (time: number) => void;
  seekRelative: (seconds: number) => void;
  setPlaybackRate: (rate: number) => void;
  cyclePlaybackRate: () => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  addToQueue: (song: Song) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  toggleLyrics: () => void;
  toggleQueue: () => void;
  openFullScreenPlayer: () => void;
  closeFullScreenPlayer: () => void;
  toggleFullScreenPlayer: () => void;
  setLikedStatus: (songId: string, isLiked: boolean) => void;
  clearError: () => void;
}

let audioElement: HTMLAudioElement | null = null;
let nativeStateTimer: ReturnType<typeof setInterval> | null = null;

const getAudioElement = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  if (!audioElement) {
    audioElement = document.getElementById('musicwave-html5-audio') as HTMLAudioElement;
    if (!audioElement) {
      audioElement = document.createElement('audio');
      audioElement.id = 'musicwave-html5-audio';
      audioElement.preload = 'auto';
      audioElement.crossOrigin = 'anonymous';
      (audioElement as any).preservesPitch = true;
      (audioElement as any).webkitPreservesPitch = true;
      (audioElement as any).mozPreservesPitch = true;
      audioElement.setAttribute('playsinline', 'true');
      audioElement.setAttribute('webkit-playsinline', 'true');
      document.body.appendChild(audioElement);
    }
  }
  return audioElement;
};

export const usePlayerStore = create<PlayerState>((set, get) => ({
  audio: null,
  currentSong: null,
  isPlaying: false,
  isBuffering: false,
  playbackError: null,
  currentTime: 0,
  duration: 0,
  buffered: 0,
  volume: 0.8,
  isMuted: false,
  playbackRate: 1.0,
  repeatMode: 'off',
  isShuffle: false,
  queue: [],
  queueIndex: -1,
  isLyricsOpen: false,
  isQueueOpen: false,
  isFullScreenPlayerOpen: false,

  initAudio: () => {
    const audio = getAudioElement();
    if (!audio) return;

    const currentRate = get().playbackRate || 1.0;
    audio.volume = get().volume;
    audio.muted = get().isMuted;
    audio.playbackRate = currentRate;
    audio.defaultPlaybackRate = currentRate;
    (audio as any).preservesPitch = true;
    (audio as any).webkitPreservesPitch = true;
    (audio as any).mozPreservesPitch = true;

    audio.onplay = () => {
      const rate = get().playbackRate || 1.0;
      audio.playbackRate = rate;
      (audio as any).preservesPitch = true;
      (audio as any).webkitPreservesPitch = true;
      set({ isPlaying: true, isBuffering: false, playbackError: null });
    };

    audio.onplaying = () => {
      set({ isPlaying: true, isBuffering: false, playbackError: null });
    };

    audio.onwaiting = () => {
      set({ isBuffering: true });
    };

    audio.onpause = () => {
      const cur = get().currentSong;
      if (!isYouTubeSource(cur)) {
        set({ isPlaying: false, isBuffering: false });
      }
    };

    audio.ontimeupdate = () => {
      set({ currentTime: audio.currentTime });
    };

    audio.onloadedmetadata = () => {
      const dur = audio.duration;
      if (dur && !isNaN(dur) && dur > 0) {
        set({ duration: Math.round(dur), isBuffering: false });
      }
    };

    audio.ondurationchange = () => {
      const dur = audio.duration;
      if (dur && !isNaN(dur) && dur > 0) {
        set({ duration: Math.round(dur) });
      }
    };

    audio.onprogress = () => {
      if (audio.buffered.length > 0) {
        set({ buffered: audio.buffered.end(audio.buffered.length - 1) });
      }
    };

    audio.onended = () => {
      const { repeatMode, nextSong } = get();
      if (repeatMode === 'one') {
        audio.currentTime = 0;
        audio.play().catch(console.error);
      } else {
        nextSong();
      }
    };

    audio.onerror = () => {
      const cur = get().currentSong;
      if (!isYouTubeSource(cur)) {
        console.warn('[MusicWave Audio] Playback error encountered on HTML5 audio');
        set({ isPlaying: false, isBuffering: false, playbackError: 'Không thể phát file âm thanh này.' });
      }
    };

    set({ audio });
  },

  playSong: (song: Song, newQueue?: Song[]) => {
    let audio = get().audio;
    if (!audio) {
      get().initAudio();
      audio = getAudioElement();
    }

    const state = get();
    const isTargetYouTube = isYouTubeSource(song);
    const targetYtId = getSongYoutubeId(song);

    // 1. If clicking the exact currently loaded song:
    if (state.currentSong?.id === song.id) {
      if (!state.isPlaying) {
        get().resume();
      }
      return; // Smooth continuous playback, do not restart
    }

    // 2. Different song -> update queue
    let updatedQueue = newQueue || state.queue;
    if (!newQueue && !updatedQueue.some((s) => s.id === song.id)) {
      updatedQueue = [...updatedQueue, song];
    }

    const index = updatedQueue.findIndex((s) => s.id === song.id);
    const reqId = ++playbackRequestId;

    // Optimistically update player state so UI responds instantly (< 16ms)
    set({
      currentSong: song,
      queue: updatedQueue,
      queueIndex: index !== -1 ? index : 0,
      currentTime: 0,
      duration: song.duration || 180,
      isPlaying: true,
      isBuffering: true,
      playbackError: null,
    });

    // 3. Dispatch to appropriate player engine
    if (isTargetYouTube && targetYtId) {
      // Clean HTML5 audio source completely to prevent background audio overlap
      if (audio) {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      }

      // Trigger YouTube Bridge immediately inside user click interaction
      if (typeof window !== 'undefined' && window.__musicwave_yt_load_and_play) {
        window.__musicwave_yt_load_and_play(targetYtId, reqId);
      }

      songService.recordPlay(song.id).catch(() => {});
    } else if (audio) {
      // Stop YouTube playback immediately
      if (typeof window !== 'undefined' && window.__musicwave_yt_stop) {
        window.__musicwave_yt_stop();
      }

      const currentRate = state.playbackRate || 1.0;
      audio.src = getMediaUrl(song.audioUrl);
      audio.currentTime = 0;
      audio.volume = state.isMuted ? 0 : state.volume;
      audio.muted = state.isMuted;
      audio.playbackRate = currentRate;
      audio.defaultPlaybackRate = currentRate;
      (audio as any).preservesPitch = true;
      (audio as any).webkitPreservesPitch = true;
      (audio as any).mozPreservesPitch = true;

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            if (audio) {
              audio.playbackRate = currentRate;
            }
            set({ isPlaying: true, isBuffering: false, playbackError: null });
            songService.recordPlay(song.id).catch(() => {});
          })
          .catch((err) => {
            console.warn('[MusicWave Player] Auto-play blocked or audio source error:', err);
            set({ isPlaying: false, isBuffering: false, playbackError: 'Không thể tải bài hát này.' });
          });
      }
    }
  },

  togglePlay: () => {
    const { isPlaying, currentSong, queue } = get();
    if (!currentSong) {
      if (queue.length > 0) {
        get().playSong(queue[0]);
      }
      return;
    }

    if (isPlaying) {
      get().pause();
    } else {
      get().resume();
    }
  },

  pause: () => {
    const { audio, currentSong } = get();
    const isYouTube = isYouTubeSource(currentSong);

    if (isYouTube) {
      if (typeof window !== 'undefined' && window.__musicwave_yt_pause) {
        window.__musicwave_yt_pause();
      }
    } else if (isNativeAudioAvailable()) {
      nativeAudio.pause().catch(() => {});
    } else if (audio) {
      audio.pause();
    }
    set({ isPlaying: false, isBuffering: false });
  },

  resume: () => {
    const { audio, currentSong, volume, isMuted, playbackRate } = get();
    if (!currentSong) return;

    const isYouTube = isYouTubeSource(currentSong);

    if (isYouTube) {
      if (typeof window !== 'undefined' && window.__musicwave_yt_play) {
        window.__musicwave_yt_play();
      }
      set({ isPlaying: true, isBuffering: false, playbackError: null });
    } else if (isNativeAudioAvailable()) {
      nativeAudio.resume().catch(() => {});
      set({ isPlaying: true, isBuffering: false, playbackError: null });
    } else if (audio) {
      const currentRate = playbackRate || 1.0;
      audio.volume = isMuted ? 0 : volume;
      audio.muted = isMuted;
      audio.playbackRate = currentRate;
      audio.defaultPlaybackRate = currentRate;
      (audio as any).preservesPitch = true;
      (audio as any).webkitPreservesPitch = true;
      (audio as any).mozPreservesPitch = true;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            if (audio) {
              audio.playbackRate = currentRate;
            }
            set({ isPlaying: true, isBuffering: false, playbackError: null });
          })
          .catch((err) => {
            console.warn('[MusicWave Player] Audio resume error:', err);
            set({ isPlaying: false, isBuffering: false });
          });
      }
    }
  },

  nextSong: () => {
    const { queue, queueIndex, isShuffle, repeatMode, playSong } = get();
    if (queue.length === 0) return;

    if (isShuffle) {
      const randomIndex = Math.floor(Math.random() * queue.length);
      playSong(queue[randomIndex]);
      return;
    }

    if (queueIndex < queue.length - 1) {
      playSong(queue[queueIndex + 1]);
    } else if (repeatMode === 'all') {
      playSong(queue[0]);
    } else {
      get().pause();
      set({ isPlaying: false, currentTime: 0 });
    }
  },

  previousSong: () => {
    const { queue, queueIndex, playSong, currentTime } = get();

    if (currentTime > 3) {
      get().seek(0);
      return;
    }

    if (queueIndex > 0) {
      playSong(queue[queueIndex - 1]);
    } else if (queue.length > 0) {
      playSong(queue[queue.length - 1]);
    }
  },

  seek: (time: number) => {
    const { audio, currentSong } = get();
    const isYouTube = isYouTubeSource(currentSong);

    if (isYouTube) {
      if (typeof window !== 'undefined' && window.__musicwave_yt_seek) {
        window.__musicwave_yt_seek(time);
      }
      set({ currentTime: time });
    } else if (isNativeAudioAvailable()) {
      nativeAudio.seek(time).catch(() => {});
      set({ currentTime: time });
    } else if (audio) {
      audio.currentTime = time;
      set({ currentTime: time });
    }
  },

  seekRelative: (seconds: number) => {
    const { currentTime, duration, seek } = get();
    const newTime = Math.max(0, Math.min(duration || Infinity, currentTime + seconds));
    seek(newTime);
  },

  setPlaybackRate: (rate: number) => {
    const clampedRate = Math.max(0.5, Math.min(2.0, rate));
    const { audio } = get();
    if (audio) {
      audio.playbackRate = clampedRate;
      audio.defaultPlaybackRate = clampedRate;
      (audio as any).preservesPitch = true;
      (audio as any).webkitPreservesPitch = true;
      (audio as any).mozPreservesPitch = true;
    }
    if (typeof window !== 'undefined' && window.__musicwave_yt_set_rate) {
      window.__musicwave_yt_set_rate(clampedRate);
    }
    set({ playbackRate: clampedRate });
  },

  cyclePlaybackRate: () => {
    const rates = [1.0, 1.25, 1.5, 2.0, 0.75];
    const currentRate = get().playbackRate;
    const currentIndex = rates.indexOf(currentRate);
    const nextRate = currentIndex !== -1 ? rates[(currentIndex + 1) % rates.length] : 1.0;
    get().setPlaybackRate(nextRate);
  },

  setVolume: (volume: number) => {
    const { audio } = get();
    const clamped = Math.max(0, Math.min(1, volume));
    if (audio) {
      audio.volume = clamped;
      audio.muted = clamped === 0;
    }
    if (typeof window !== 'undefined' && window.__musicwave_yt_set_volume) {
      window.__musicwave_yt_set_volume(clamped * 100);
    }
    if (isNativeAudioAvailable() && !isYouTubeSource(get().currentSong)) {
      nativeAudio.setVolume(clamped).catch(() => {});
    }
    set({ volume: clamped, isMuted: clamped === 0 });
  },

  toggleMute: () => {
    const { audio, isMuted, volume } = get();
    const nextMuted = !isMuted;
    if (audio) {
      audio.muted = nextMuted;
      if (!nextMuted && volume === 0) {
        audio.volume = 0.5;
      }
    }
    if (typeof window !== 'undefined') {
      if (nextMuted && window.__musicwave_yt_mute) {
        window.__musicwave_yt_mute();
      } else if (!nextMuted && window.__musicwave_yt_unmute) {
        window.__musicwave_yt_unmute();
      }
    }
    set({
      isMuted: nextMuted,
      volume: !nextMuted && volume === 0 ? 0.5 : volume,
    });
  },

  toggleShuffle: () => {
    set((state) => ({ isShuffle: !state.isShuffle }));
  },

  toggleRepeat: () => {
    set((state) => {
      const modes: RepeatMode[] = ['off', 'all', 'one'];
      const currentIdx = modes.indexOf(state.repeatMode);
      const nextMode = modes[(currentIdx + 1) % modes.length];
      return { repeatMode: nextMode };
    });
  },

  addToQueue: (song: Song) => {
    set((state) => ({
      queue: [...state.queue, song],
    }));
  },

  removeFromQueue: (index: number) => {
    set((state) => {
      const newQueue = [...state.queue];
      newQueue.splice(index, 1);
      return { queue: newQueue };
    });
  },

  clearQueue: () => {
    set({ queue: [], queueIndex: -1 });
  },

  toggleLyrics: () => {
    set((state) => ({ isLyricsOpen: !state.isLyricsOpen }));
  },

  toggleQueue: () => {
    set((state) => ({ isQueueOpen: !state.isQueueOpen }));
  },

  openFullScreenPlayer: () => {
    set({ isFullScreenPlayerOpen: true });
  },

  closeFullScreenPlayer: () => {
    set({ isFullScreenPlayerOpen: false });
  },

  toggleFullScreenPlayer: () => {
    set((state) => ({ isFullScreenPlayerOpen: !state.isFullScreenPlayerOpen }));
  },

  setLikedStatus: (songId: string, isLiked: boolean) => {
    set((state) => {
      const currentSong =
        state.currentSong?.id === songId
          ? { ...state.currentSong, isLiked }
          : state.currentSong;

      const queue = state.queue.map((s) =>
        s.id === songId ? { ...s, isLiked } : s
      );

      return { currentSong, queue };
    });
  },

  clearError: () => {
    set({ playbackError: null });
  },
}));

// =========================================================================
// ATOMIC REACT HOOKS & SELECTORS FOR ZERO UNNECESSARY RE-RENDERS
// =========================================================================

export const useCurrentSong = () => usePlayerStore((state) => state.currentSong);
export const useIsPlaying = () => usePlayerStore((state) => state.isPlaying);
export const useIsBuffering = () => usePlayerStore((state) => state.isBuffering);
export const usePlaybackError = () => usePlayerStore((state) => state.playbackError);
export const usePlaybackRate = () => usePlayerStore((state) => state.playbackRate);

export const useIsSongCurrent = (songId?: string) =>
  usePlayerStore((state) => Boolean(songId && state.currentSong?.id === songId));

export const useIsSongPlaying = (songId?: string) =>
  usePlayerStore((state) => Boolean(songId && state.currentSong?.id === songId && state.isPlaying));

export const usePlayerProgress = () =>
  usePlayerStore((state) => ({
    currentTime: state.currentTime,
    duration: state.duration,
    buffered: state.buffered,
    seek: state.seek,
    seekRelative: state.seekRelative,
  }));

export const usePlayerControls = () =>
  usePlayerStore((state) => ({
    isPlaying: state.isPlaying,
    isBuffering: state.isBuffering,
    playbackError: state.playbackError,
    playbackRate: state.playbackRate,
    repeatMode: state.repeatMode,
    isShuffle: state.isShuffle,
    togglePlay: state.togglePlay,
    pause: state.pause,
    resume: state.resume,
    nextSong: state.nextSong,
    previousSong: state.previousSong,
    toggleShuffle: state.toggleShuffle,
    toggleRepeat: state.toggleRepeat,
    setPlaybackRate: state.setPlaybackRate,
    cyclePlaybackRate: state.cyclePlaybackRate,
    seekRelative: state.seekRelative,
  }));
