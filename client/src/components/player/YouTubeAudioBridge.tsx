import React, { useEffect, useRef } from 'react';
import {
  usePlayerStore,
  useCurrentSong,
  useIsPlaying,
} from '../../store/playerStore.js';
import { isYouTubeSource, getSongYoutubeId } from '../../utils/youtube.js';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
    __musicwave_yt_play?: () => void;
    __musicwave_yt_pause?: () => void;
    __musicwave_yt_stop?: () => void;
    __musicwave_yt_seek?: (time: number) => void;
    __musicwave_yt_set_rate?: (rate: number) => void;
    __musicwave_yt_load_and_play?: (videoId: string, reqId?: number) => void;
    __musicwave_yt_set_volume?: (volume: number) => void;
    __musicwave_yt_mute?: () => void;
    __musicwave_yt_unmute?: () => void;
    __musicwave_yt_is_ready?: () => boolean;
  }
}

interface PendingRequest {
  videoId: string;
  reqId: number;
}

export const YouTubeAudioBridge: React.FC = () => {
  const currentSong = useCurrentSong();
  const isPlaying = useIsPlaying();
  const volume = usePlayerStore((s) => s.volume);
  const isMuted = usePlayerStore((s) => s.isMuted);

  const playerRef = useRef<any>(null);
  const isApiLoadedRef = useRef<boolean>(false);
  const activeRequestIdRef = useRef<number>(0);
  const pendingRequestRef = useRef<PendingRequest | null>(null);
  const currentLoadedVideoIdRef = useRef<string | null>(null);
  const intervalRef = useRef<any>(null);

  const isYouTube = isYouTubeSource(currentSong);
  const youtubeId = getSongYoutubeId(currentSong);

  // 1. Setup window bridge helpers (Exposed directly to playerStore for zero-latency execution)
  const setupWindowHelpers = () => {
    window.__musicwave_yt_is_ready = () => isApiLoadedRef.current;

    window.__musicwave_yt_set_rate = (rate: number) => {
      try {
        playerRef.current?.setPlaybackRate?.(rate);
      } catch (e) {}
    };

    window.__musicwave_yt_load_and_play = (videoId: string, reqId?: number) => {
      const targetReqId = reqId || Date.now();
      activeRequestIdRef.current = targetReqId;
      pendingRequestRef.current = { videoId, reqId: targetReqId };

      if (playerRef.current && isApiLoadedRef.current) {
        currentLoadedVideoIdRef.current = videoId;
        try {
          const state = usePlayerStore.getState();
          const rate = state.playbackRate || 1.0;
          // Synchronize volume and mute state
          if (state.isMuted) {
            playerRef.current.mute?.();
          } else {
            playerRef.current.unMute?.();
            playerRef.current.setVolume?.(state.volume * 100);
          }

          // Execute load and play immediately inside user gesture stack
          playerRef.current.loadVideoById({ videoId, startSeconds: 0 });
          playerRef.current.setPlaybackRate?.(rate);
          playerRef.current.playVideo?.();
        } catch (e) {
          console.warn('[MusicWave YT Bridge] loadVideoById error:', e);
        }
      }
    };

    window.__musicwave_yt_play = () => {
      try {
        const state = usePlayerStore.getState();
        const rate = state.playbackRate || 1.0;
        playerRef.current?.setPlaybackRate?.(rate);
        if (!state.isMuted) {
          playerRef.current?.unMute?.();
          playerRef.current?.setVolume?.(state.volume * 100);
        }
        playerRef.current?.playVideo?.();
      } catch (e) {}
    };

    window.__musicwave_yt_pause = () => {
      try {
        playerRef.current?.pauseVideo?.();
      } catch (e) {}
    };

    window.__musicwave_yt_stop = () => {
      currentLoadedVideoIdRef.current = null;
      pendingRequestRef.current = null;
      try {
        playerRef.current?.pauseVideo?.();
        playerRef.current?.stopVideo?.();
        playerRef.current?.mute?.();
        playerRef.current?.clearVideo?.();
      } catch (e) {}
    };

    window.__musicwave_yt_seek = (time: number) => {
      try {
        playerRef.current?.seekTo?.(time, true);
      } catch (e) {}
    };

    window.__musicwave_yt_set_volume = (vol: number) => {
      try {
        playerRef.current?.setVolume?.(vol);
      } catch (e) {}
    };

    window.__musicwave_yt_mute = () => {
      try {
        playerRef.current?.mute?.();
      } catch (e) {}
    };

    window.__musicwave_yt_unmute = () => {
      try {
        playerRef.current?.unMute?.();
      } catch (e) {}
    };
  };

  // 2. Pre-warm & Initialize YouTube IFrame API Singleton
  useEffect(() => {
    if (typeof window === 'undefined') return;

    setupWindowHelpers();

    const createPlayer = () => {
      if (window.YT && window.YT.Player && !playerRef.current) {
        try {
          const appOrigin =
            typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('capacitor')
              ? window.location.origin
              : 'https://musicwave-app.vercel.app';

          playerRef.current = new window.YT.Player('musicwave-yt-bridge', {
            height: '100%',
            width: '100%',
            host: 'https://www.youtube.com',
            playerVars: {
              autoplay: 1,
              controls: 0,
              disablekb: 1,
              enablejsapi: 1,
              fs: 0,
              modestbranding: 1,
              playsinline: 1,
              rel: 0,
              origin: appOrigin,
              widget_referrer: appOrigin,
            },
            events: {
              onReady: (event: any) => {
                isApiLoadedRef.current = true;
                const state = usePlayerStore.getState();
                const rate = state.playbackRate || 1.0;

                try {
                  event.target.setPlaybackRate?.(rate);
                } catch (e) {}

                event.target.setVolume(state.volume * 100);
                if (state.isMuted) {
                  event.target.mute();
                } else {
                  event.target.unMute();
                }

                // If a song was clicked while player was warming up, play it now!
                const pending = pendingRequestRef.current;
                const targetId = pending?.videoId || getSongYoutubeId(state.currentSong);

                if (targetId && state.isPlaying) {
                  currentLoadedVideoIdRef.current = targetId;
                  event.target.loadVideoById({ videoId: targetId, startSeconds: 0 });
                  try {
                    event.target.setPlaybackRate?.(rate);
                  } catch (e) {}
                  event.target.playVideo();
                }
              },
              onStateChange: (event: any) => {
                // 1 = PLAYING
                if (event.data === 1) {
                  const state = usePlayerStore.getState();
                  const rate = state.playbackRate || 1.0;
                  try {
                    event.target.setPlaybackRate?.(rate);
                  } catch (e) {}
                  usePlayerStore.setState({ isPlaying: true, isBuffering: false, playbackError: null });
                  const dur = event.target.getDuration();
                  if (dur && dur > 0) {
                    usePlayerStore.setState({ duration: Math.round(dur) });
                  }
                }
                // 0 = ENDED
                else if (event.data === 0) {
                  const { repeatMode, nextSong } = usePlayerStore.getState();
                  if (repeatMode === 'one') {
                    event.target.seekTo(0, true);
                    event.target.playVideo();
                  } else {
                    nextSong();
                  }
                }
                // 2 = PAUSED
                else if (event.data === 2) {
                  // Keep state synchronized
                }
                // 3 = BUFFERING
                else if (event.data === 3) {
                  usePlayerStore.setState({ isBuffering: true });
                  const dur = event.target.getDuration();
                  if (dur && dur > 0) {
                    usePlayerStore.setState({ duration: Math.round(dur) });
                  }
                }
                // 5 = CUED (Video is cued & ready -> trigger play immediately)
                else if (event.data === 5) {
                  if (usePlayerStore.getState().isPlaying) {
                    event.target.playVideo();
                  }
                }
                // -1 = UNSTARTED
                else if (event.data === -1) {
                  if (usePlayerStore.getState().isPlaying) {
                    event.target.playVideo();
                  }
                }
              },
              onError: (event: any) => {
                console.warn('[MusicWave YT Bridge] Playback error code:', event.data);
                currentLoadedVideoIdRef.current = null;
                try {
                  event.target.pauseVideo();
                  event.target.stopVideo();
                  event.target.mute();
                  event.target.clearVideo?.();
                } catch (e) {}
                
                usePlayerStore.setState({
                  isPlaying: false,
                  isBuffering: false,
                  playbackError: 'Video YouTube này không thể phát hoặc bị hạn chế bản quyền.',
                });
              },
            },
          });
        } catch (e) {
          console.warn('[MusicWave YT Bridge] Error creating YT player:', e);
        }
      }
    };

    if (!window.YT || !window.YT.Player) {
      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prevCallback) prevCallback();
        createPlayer();
      };

      if (!document.getElementById('musicwave-yt-iframe-script')) {
        const tag = document.createElement('script');
        tag.id = 'musicwave-yt-iframe-script';
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
      }
    } else {
      createPlayer();
    }
  }, []);

  // 3. Sync Song Changes (Handle dynamic state changes)
  useEffect(() => {
    if (isYouTube && youtubeId) {
      if (playerRef.current && isApiLoadedRef.current && playerRef.current.loadVideoById) {
        if (currentLoadedVideoIdRef.current !== youtubeId) {
          currentLoadedVideoIdRef.current = youtubeId;
          const state = usePlayerStore.getState();
          if (state.isMuted) {
            playerRef.current.mute?.();
          } else {
            playerRef.current.unMute?.();
            playerRef.current.setVolume?.(state.volume * 100);
          }
          playerRef.current.loadVideoById({ videoId: youtubeId, startSeconds: 0 });
          playerRef.current.playVideo();
          usePlayerStore.setState({ isPlaying: true, currentTime: 0, isBuffering: true, playbackError: null });
        }
      }
    } else if (!isYouTube && playerRef.current && isApiLoadedRef.current) {
      currentLoadedVideoIdRef.current = null;
      try {
        playerRef.current.pauseVideo?.();
        playerRef.current.stopVideo?.();
        playerRef.current.mute?.();
        playerRef.current.clearVideo?.();
      } catch (e) {}
    }
  }, [youtubeId, isYouTube]);

  // 4. Sync Play / Pause
  useEffect(() => {
    if (!isYouTube || !playerRef.current || !isApiLoadedRef.current) return;
    if (isPlaying) {
      playerRef.current.playVideo?.();
    } else {
      playerRef.current.pauseVideo?.();
    }
  }, [isPlaying, isYouTube]);

  // 5. Sync Volume & Mute
  useEffect(() => {
    if (!playerRef.current || !isApiLoadedRef.current) return;
    playerRef.current.setVolume?.(volume * 100);
    if (isMuted) {
      playerRef.current.mute?.();
    } else {
      playerRef.current.unMute?.();
    }
  }, [volume, isMuted]);

  // 6. High-Precision Time Updater (Only runs during active playback)
  useEffect(() => {
    if (isYouTube && isPlaying) {
      intervalRef.current = setInterval(() => {
        if (playerRef.current && isApiLoadedRef.current && playerRef.current.getCurrentTime) {
          try {
            const ct = playerRef.current.getCurrentTime() || 0;
            const dur = playerRef.current.getDuration() || currentSong?.duration || 0;
            usePlayerStore.setState({
              currentTime: ct,
              duration: dur > 0 ? Math.round(dur) : currentSong?.duration || 180,
            });
          } catch (e) {}
        }
      }, 250);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isYouTube, isPlaying, currentSong?.id]);

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        bottom: 0,
        right: 0,
        width: '1px',
        height: '1px',
        opacity: 0.01,
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'hidden',
      }}
    >
      <div id="musicwave-yt-bridge" style={{ width: '100%', height: '100%' }} />
    </div>
  );
};
