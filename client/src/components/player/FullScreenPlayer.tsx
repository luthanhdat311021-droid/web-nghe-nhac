import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Mic2,
  ListMusic,
  Heart,
  Volume2,
  VolumeX,
  MoreVertical,
  Radio,
  Loader2,
  RotateCcw,
  RotateCw,
  Gauge,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  usePlayerStore,
  useCurrentSong,
  useIsPlaying,
  useIsBuffering,
  usePlayerControls,
} from '../../store/playerStore.js';
import { useAuthStore } from '../../store/authStore.js';
import { useFavoriteStore } from '../../store/favoriteStore.js';
import { ProgressBar } from './ProgressBar.js';
import { MobileActionSheet } from '../common/MobileActionSheet.js';

// Isolated Fullscreen Progress bar
const FullScreenProgressBar: React.FC = () => {
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const buffered = usePlayerStore((s) => s.buffered);
  const seek = usePlayerStore((s) => s.seek);

  return (
    <div className="pt-1">
      <ProgressBar
        currentTime={currentTime}
        duration={duration}
        buffered={buffered}
        onSeek={seek}
      />
    </div>
  );
};

export const FullScreenPlayer: React.FC = () => {
  const isFullScreenPlayerOpen = usePlayerStore((s) => s.isFullScreenPlayerOpen);
  const currentSong = useCurrentSong();
  const isPlaying = useIsPlaying();
  const isBuffering = useIsBuffering();

  const {
    repeatMode,
    isShuffle,
    playbackRate,
    togglePlay,
    nextSong,
    previousSong,
    toggleShuffle,
    toggleRepeat,
    setPlaybackRate,
    seekRelative,
  } = usePlayerControls();

  const volume = usePlayerStore((s) => s.volume);
  const isMuted = usePlayerStore((s) => s.isMuted);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const closeFullScreenPlayer = usePlayerStore((s) => s.closeFullScreenPlayer);
  const toggleLyrics = usePlayerStore((s) => s.toggleLyrics);
  const toggleQueue = usePlayerStore((s) => s.toggleQueue);

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLiked = useFavoriteStore((s) => s.isLiked(currentSong?.id || '', currentSong?.isLiked || false));
  const toggleFavoriteOptimistic = useFavoriteStore((s) => s.toggleFavoriteOptimistic);

  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

  if (!isFullScreenPlayerOpen || !currentSong) return null;

  const handleLikeClick = () => {
    if (!isAuthenticated || !currentSong) return;
    toggleFavoriteOptimistic(currentSong.id, isLiked);
  };

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="fixed inset-0 z-50 bg-[#0c0d12] flex flex-col justify-between overflow-y-auto no-scrollbar select-none"
        >
          {/* Subtle Ambient Background */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-25">
            <img
              src={currentSong.coverUrl}
              alt=""
              className="w-full h-full object-cover filter blur-3xl scale-125 transform"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#0c0d12]/70 via-[#0c0d12]/90 to-[#0c0d12]" />
          </div>

          {/* 1. Top Navigation Bar */}
          <div className="relative z-10 pt-[calc(env(safe-area-inset-top)+0.75rem)] px-5 flex items-center justify-between flex-shrink-0">
            <button
              onClick={closeFullScreenPlayer}
              aria-label="Collapse Player"
              className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 active:scale-90 text-white flex items-center justify-center transition-all touch-target"
            >
              <ChevronDown className="w-6 h-6" />
            </button>

            <div className="text-center min-w-0 max-w-[200px] xs:max-w-[240px]">
              <span className="text-[10px] uppercase font-bold tracking-widest text-text-muted block">
                Đang phát từ
              </span>
              <span className="text-xs font-bold text-white truncate block">
                {currentSong.album?.title || 'MusicWave'}
              </span>
            </div>

            <button
              onClick={() => setShowMenu(true)}
              aria-label="Track Options"
              className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 active:scale-90 text-white flex items-center justify-center transition-all touch-target"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>

          {/* 2. Center: Large Clean Album Art */}
          <div className="relative z-10 px-6 py-3 my-auto flex flex-col items-center justify-center">
            <motion.div
              animate={{ scale: isPlaying ? 1 : 0.95 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="relative w-full max-w-[280px] xs:max-w-[320px] aspect-square rounded-2xl overflow-hidden shadow-2xl shadow-black/80 border border-white/10"
            >
              <img
                src={currentSong.coverUrl}
                alt={currentSong.title}
                className="w-full h-full object-cover"
              />

              {/* YouTube stream indicator if applicable */}
              {(currentSong.sourceType === 'youtube' || currentSong.youtubeId) && (
                <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-[10px] font-bold text-red-400 flex items-center gap-1 border border-white/10">
                  <Radio className="w-3 h-3" />
                  YouTube
                </div>
              )}
            </motion.div>
          </div>

          {/* 3. Bottom Section: Info, Scrubber, Controls, Speed, Tools */}
          <div className="relative z-10 px-6 pb-[calc(env(safe-area-inset-bottom)+1rem)] space-y-3.5 max-w-md mx-auto w-full flex-shrink-0">
            {/* Song Info & Favorite */}
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-bold text-white truncate tracking-tight">
                  {currentSong.title}
                </h2>
                {currentSong.artist && (
                  <Link
                    to={`/artist/${currentSong.artist.id}`}
                    onClick={closeFullScreenPlayer}
                    className="text-sm font-medium text-text-secondary hover:text-white transition-colors truncate block mt-0.5"
                  >
                    {currentSong.artist.name}
                  </Link>
                )}
              </div>

              <button
                onClick={handleLikeClick}
                aria-label={isLiked ? 'Bỏ thích' : 'Yêu thích'}
                className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-90 touch-target ${
                  isLiked
                    ? 'text-rose-500'
                    : 'text-text-muted hover:text-white'
                }`}
              >
                <Heart className={`w-6 h-6 transition-transform ${isLiked ? 'fill-current scale-110' : ''}`} />
              </button>
            </div>

            {/* Scrubber Progress Bar (Isolated) */}
            <FullScreenProgressBar />

            {/* Primary Controls with 10s Seek */}
            <div className="flex items-center justify-between px-1 pt-0.5">
              <button
                onClick={toggleShuffle}
                aria-label={isShuffle ? 'Tắt trộn bài' : 'Bật trộn bài'}
                className={`p-2 rounded-full transition-colors active:scale-90 touch-target ${
                  isShuffle ? 'text-primary-400' : 'text-text-muted hover:text-white'
                }`}
              >
                <Shuffle className="w-5 h-5" />
              </button>

              {/* Seek -10s */}
              <button
                onClick={() => seekRelative(-10)}
                aria-label="Tua lùi 10s"
                title="Tua lùi 10s"
                className="p-2 rounded-full text-white/80 hover:text-white transition-all active:scale-90 touch-target relative"
              >
                <RotateCcw className="w-5 h-5" />
                <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold font-mono text-white pointer-events-none mt-0.5">
                  10
                </span>
              </button>

              <button
                onClick={previousSong}
                aria-label="Bài trước"
                className="p-2 rounded-full text-white hover:text-neutral-200 transition-all active:scale-90 touch-target"
              >
                <SkipBack className="w-6 h-6 fill-current" />
              </button>

              {/* Master Play Button */}
              <button
                onClick={togglePlay}
                aria-label={isPlaying ? 'Tạm dừng' : 'Phát'}
                className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-transform touch-target relative select-none"
              >
                {isBuffering && isPlaying ? (
                  <Loader2 className="w-6 h-6 text-black animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-6 h-6 fill-current" />
                ) : (
                  <Play className="w-6 h-6 fill-current ml-0.5" />
                )}
              </button>

              <button
                onClick={nextSong}
                aria-label="Bài tiếp theo"
                className="p-2 rounded-full text-white hover:text-neutral-200 transition-all active:scale-90 touch-target"
              >
                <SkipForward className="w-6 h-6 fill-current" />
              </button>

              {/* Seek +10s */}
              <button
                onClick={() => seekRelative(10)}
                aria-label="Tua tới 10s"
                title="Tua nhanh 10s"
                className="p-2 rounded-full text-white/80 hover:text-white transition-all active:scale-90 touch-target relative"
              >
                <RotateCw className="w-5 h-5" />
                <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold font-mono text-white pointer-events-none mt-0.5">
                  10
                </span>
              </button>

              <button
                onClick={toggleRepeat}
                aria-label={`Lặp lại: ${repeatMode}`}
                className={`p-2 rounded-full transition-colors active:scale-90 touch-target ${
                  repeatMode !== 'off' ? 'text-primary-400' : 'text-text-muted hover:text-white'
                }`}
              >
                {repeatMode === 'one' ? (
                  <Repeat1 className="w-5 h-5" />
                ) : (
                  <Repeat className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* Playback Speed Pill Selector Bar */}
            <div className="flex items-center justify-between bg-white/[0.04] p-1 rounded-xl border border-white/[0.06]">
              <div className="flex items-center gap-1.5 px-2 text-text-muted">
                <Gauge className="w-3.5 h-3.5 text-primary-400" />
                <span className="text-[11px] font-medium">Tốc độ:</span>
              </div>
              <div className="flex items-center gap-1 flex-1 justify-end">
                {SPEED_OPTIONS.map((rate) => {
                  const isActive = playbackRate === rate;
                  return (
                    <button
                      key={rate}
                      onClick={() => setPlaybackRate(rate)}
                      className={`px-2 py-1 rounded-lg text-[11px] font-mono font-bold transition-all active:scale-90 ${
                        isActive
                          ? 'bg-primary-500 text-white shadow-sm shadow-primary-500/50'
                          : 'text-text-muted hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {rate}x
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Secondary Tools Bar (Volume, Lyrics, Queue) */}
            <div className="flex items-center justify-between pt-1 border-t border-white/[0.07] px-1">
              <button
                onClick={() => setShowVolumeSlider(!showVolumeSlider)}
                aria-label="Volume"
                className={`p-2 rounded-full transition-colors touch-target ${
                  showVolumeSlider ? 'text-white' : 'text-text-muted hover:text-white'
                }`}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>

              {/* Collapsible Mobile Volume Slider */}
              {showVolumeSlider && (
                <div className="flex-1 mx-3 flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="w-full h-1.5 accent-white cursor-pointer"
                  />
                </div>
              )}

              <div className="flex items-center gap-1.5 ml-auto">
                <button
                  onClick={toggleLyrics}
                  aria-label="Lyrics"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-text-secondary hover:text-white border border-white/[0.08] transition-colors active:scale-95"
                >
                  <Mic2 className="w-3.5 h-3.5" />
                  <span>Lời bài hát</span>
                </button>

                <button
                  onClick={toggleQueue}
                  aria-label="Queue"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-text-secondary hover:text-white border border-white/[0.08] transition-colors active:scale-95"
                >
                  <ListMusic className="w-3.5 h-3.5" />
                  <span>Danh sách phát</span>
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <MobileActionSheet
        isOpen={showMenu}
        onClose={() => setShowMenu(false)}
        song={currentSong}
      />
    </>
  );
};
