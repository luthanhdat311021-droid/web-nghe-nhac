import React from 'react';
import {
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
  Loader2,
  AlertCircle,
  RotateCcw,
  RotateCw,
} from 'lucide-react';
import {
  usePlayerStore,
  useCurrentSong,
  useIsPlaying,
  useIsBuffering,
  usePlaybackError,
  usePlayerControls,
} from '../../store/playerStore.js';
import { useAuthStore } from '../../store/authStore.js';
import { useFavoriteStore } from '../../store/favoriteStore.js';
import { ProgressBar } from './ProgressBar.js';
import { VolumeControl } from './VolumeControl.js';
import { LyricsModal } from './LyricsModal.js';
import { QueueDrawer } from './QueueDrawer.js';
import { FullScreenPlayer } from './FullScreenPlayer.js';
import { Link } from 'react-router-dom';

// Mini Progress Line isolated from BottomPlayer container re-renders
const MobileMiniProgress: React.FC = () => {
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  return (
    <div className="w-full h-[2px] bg-white/10 rounded-full overflow-hidden mt-1.5">
      <div
        className="h-full bg-white rounded-full transition-all"
        style={{ width: `${progressPercent}%` }}
      />
    </div>
  );
};

// Desktop Progress Scrubber isolated from BottomPlayer container re-renders
const DesktopProgressScrubber: React.FC = () => {
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const buffered = usePlayerStore((s) => s.buffered);
  const seek = usePlayerStore((s) => s.seek);

  return (
    <div className="w-full">
      <ProgressBar
        currentTime={currentTime}
        duration={duration}
        buffered={buffered}
        onSeek={seek}
      />
    </div>
  );
};

export const BottomPlayer: React.FC = () => {
  const currentSong = useCurrentSong();
  const isPlaying = useIsPlaying();
  const isBuffering = useIsBuffering();
  const playbackError = usePlaybackError();

  const {
    repeatMode,
    isShuffle,
    playbackRate,
    togglePlay,
    nextSong,
    previousSong,
    toggleShuffle,
    toggleRepeat,
    cyclePlaybackRate,
    seekRelative,
  } = usePlayerControls();

  const volume = usePlayerStore((s) => s.volume);
  const isMuted = usePlayerStore((s) => s.isMuted);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const toggleMute = usePlayerStore((s) => s.toggleMute);

  const isLyricsOpen = usePlayerStore((s) => s.isLyricsOpen);
  const isQueueOpen = usePlayerStore((s) => s.isQueueOpen);
  const toggleLyrics = usePlayerStore((s) => s.toggleLyrics);
  const toggleQueue = usePlayerStore((s) => s.toggleQueue);
  const openFullScreenPlayer = usePlayerStore((s) => s.openFullScreenPlayer);

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLiked = useFavoriteStore((s) => s.isLiked(currentSong?.id || '', currentSong?.isLiked || false));
  const toggleFavoriteOptimistic = useFavoriteStore((s) => s.toggleFavoriteOptimistic);

  if (!currentSong) return null;

  const handleLikeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated || !currentSong) return;
    toggleFavoriteOptimistic(currentSong.id, isLiked);
  };

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. MOBILE MINI PLAYER (Floating directly above mobile bottom nav)         */}
      {/* ========================================================================= */}
      <div
        onClick={openFullScreenPlayer}
        className="md:hidden fixed left-2 right-2 bottom-[calc(56px+env(safe-area-inset-bottom)+0.35rem)] z-30 bg-[#141620]/98 rounded-xl p-2 shadow-2xl border border-white/10 cursor-pointer select-none active:scale-[0.99] transition-transform"
      >
        <div className="flex items-center justify-between gap-3">
          {/* Cover Artwork */}
          <div className="relative w-10 h-10 min-w-[40px] min-h-[40px] max-w-[40px] max-h-[40px] rounded-lg overflow-hidden flex-shrink-0 bg-white/5 shadow">
            <img
              src={currentSong.coverUrl}
              alt={currentSong.title}
              className="w-full h-full object-cover"
            />
            {isBuffering && isPlaying && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              </div>
            )}
          </div>

          {/* Song Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h4 className="text-xs font-bold text-white truncate leading-tight">
                {currentSong.title}
              </h4>
              {playbackRate !== 1.0 && (
                <span className="px-1 py-0.2 text-[9px] font-bold rounded bg-primary-500/20 text-primary-300 border border-primary-500/30 flex-shrink-0">
                  {playbackRate}x
                </span>
              )}
            </div>
            <p className="text-[11px] text-text-muted truncate mt-0.5">
              {playbackError ? (
                <span className="text-red-400 font-medium">{playbackError}</span>
              ) : isBuffering && isPlaying ? (
                <span className="text-primary-300 font-medium">Đang tải audio...</span>
              ) : (
                currentSong.artist?.name || 'Various Artists'
              )}
            </p>
          </div>

          {/* Touch Actions */}
          <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={handleLikeClick}
              aria-label={isLiked ? 'Bỏ thích' : 'Yêu thích'}
              className={`p-2 rounded-full transition-colors active:scale-90 touch-target flex items-center justify-center ${
                isLiked
                  ? 'text-rose-500'
                  : 'text-text-muted hover:text-white'
              }`}
            >
              <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
            </button>

            <button
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center shadow active:scale-90 transition-transform relative"
            >
              {isBuffering && isPlaying ? (
                <Loader2 className="w-4 h-4 text-black animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>

            <button
              onClick={nextSong}
              aria-label="Next Track"
              className="p-2 rounded-full text-text-secondary hover:text-white active:scale-90 transition-transform touch-target flex items-center justify-center"
            >
              <SkipForward className="w-4 h-4 fill-current" />
            </button>
          </div>
        </div>

        {/* Mini Progress Bar Line */}
        <MobileMiniProgress />
      </div>

      {/* ========================================================================= */}
      {/* 2. DESKTOP BOTTOM PLAYER (Tablets & Desktops: >= 768px)                    */}
      {/* ========================================================================= */}
      <div className="hidden md:block fixed bottom-0 left-0 right-0 z-40 bg-[#0c0d14]/98 border-t border-white/[0.08] px-6 py-2.5 shadow-2xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-6 h-14">
          
          {/* Left: Song Artwork & Info */}
          <div className="flex items-center gap-3 min-w-0 w-1/4">
            <Link
              to={`/song/${currentSong.id}`}
              className="relative w-12 h-12 min-w-[48px] min-h-[48px] max-w-[48px] max-h-[48px] rounded-lg overflow-hidden flex-shrink-0 group shadow border border-white/10 block bg-white/5"
            >
              <img
                src={currentSong.coverUrl}
                alt={currentSong.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              />
              {isBuffering && isPlaying && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                </div>
              )}
            </Link>

            <div className="min-w-0 flex-1">
              <Link
                to={`/song/${currentSong.id}`}
                className="block text-xs sm:text-sm font-bold text-white truncate hover:underline"
              >
                {currentSong.title}
              </Link>
              {playbackError ? (
                <div className="flex items-center gap-1 text-xs text-red-400 truncate">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{playbackError}</span>
                </div>
              ) : isBuffering && isPlaying ? (
                <span className="block text-xs text-primary-300 animate-pulse truncate">
                  Đang tải nhạc...
                </span>
              ) : currentSong.artist ? (
                <Link
                  to={`/artist/${currentSong.artist.id}`}
                  className="block text-xs text-text-muted truncate hover:text-white transition-colors"
                >
                  {currentSong.artist.name}
                </Link>
              ) : null}
            </div>

            <button
              onClick={handleLikeClick}
              aria-label={isLiked ? 'Bỏ thích' : 'Yêu thích'}
              className={`p-1.5 rounded-full transition-all active:scale-90 flex-shrink-0 ${
                isLiked
                  ? 'text-rose-500'
                  : 'text-text-muted hover:text-white'
              }`}
            >
              <Heart className={`w-4 h-4 transition-transform ${isLiked ? 'fill-current scale-110' : ''}`} />
            </button>
          </div>

          {/* Center: Controls & Progress Bar */}
          <div className="flex flex-col items-center flex-1 max-w-xl">
            {/* Control buttons */}
            <div className="flex items-center gap-3 mb-0.5">
              <button
                onClick={toggleShuffle}
                aria-label={isShuffle ? 'Tắt trộn bài' : 'Bật trộn bài'}
                className={`p-1.5 rounded-full transition-colors active:scale-95 ${
                  isShuffle
                    ? 'text-primary-400'
                    : 'text-text-muted hover:text-white'
                }`}
                title={isShuffle ? 'Trộn bài: Bật' : 'Trộn bài: Tắt'}
              >
                <Shuffle className="w-4 h-4" />
              </button>

              {/* Rewind 10s */}
              <button
                onClick={() => seekRelative(-10)}
                aria-label="Tua lùi 10 giây"
                title="Tua lùi 10s"
                className="p-1.5 rounded-full text-text-muted hover:text-white transition-colors active:scale-95 relative"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="absolute inset-0 flex items-center justify-center text-[7px] font-bold font-mono text-white pointer-events-none mt-0.5">
                  10
                </span>
              </button>

              <button
                onClick={previousSong}
                aria-label="Bài trước"
                className="p-1.5 rounded-full text-text-secondary hover:text-white transition-colors active:scale-95"
              >
                <SkipBack className="w-4 h-4 fill-current" />
              </button>

              <button
                onClick={togglePlay}
                aria-label={isPlaying ? 'Tạm dừng' : 'Phát'}
                className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center shadow hover:scale-105 active:scale-95 transition-transform relative select-none"
              >
                {isBuffering && isPlaying ? (
                  <Loader2 className="w-4 h-4 text-black animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-4 h-4 fill-current" />
                ) : (
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                )}
              </button>

              <button
                onClick={nextSong}
                aria-label="Bài tiếp theo"
                className="p-1.5 rounded-full text-text-secondary hover:text-white transition-colors active:scale-95"
              >
                <SkipForward className="w-4 h-4 fill-current" />
              </button>

              {/* Fast Forward 10s */}
              <button
                onClick={() => seekRelative(10)}
                aria-label="Tua tới 10 giây"
                title="Tua nhanh 10s"
                className="p-1.5 rounded-full text-text-muted hover:text-white transition-colors active:scale-95 relative"
              >
                <RotateCw className="w-4 h-4" />
                <span className="absolute inset-0 flex items-center justify-center text-[7px] font-bold font-mono text-white pointer-events-none mt-0.5">
                  10
                </span>
              </button>

              <button
                onClick={toggleRepeat}
                aria-label={`Lặp lại: ${repeatMode}`}
                className={`p-1.5 rounded-full transition-colors relative active:scale-95 ${
                  repeatMode !== 'off'
                    ? 'text-primary-400'
                    : 'text-text-muted hover:text-white'
                }`}
                title={`Lặp lại: ${repeatMode === 'one' ? '1 bài' : repeatMode === 'all' ? 'Tất cả' : 'Tắt'}`}
              >
                {repeatMode === 'one' ? (
                  <Repeat1 className="w-4 h-4" />
                ) : (
                  <Repeat className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Scrubber Progress Bar */}
            <DesktopProgressScrubber />
          </div>

          {/* Right: Extra Tools (Speed, Lyrics, Queue, Volume) */}
          <div className="flex items-center justify-end gap-2.5 w-1/4">
            {/* Speed Rate Button */}
            <button
              onClick={cyclePlaybackRate}
              aria-label={`Tốc độ phát: ${playbackRate}x`}
              title={`Tốc độ phát: ${playbackRate}x (Bấm để đổi tốc độ)`}
              className={`px-2 py-1 rounded-md text-xs font-mono font-bold transition-all active:scale-95 flex items-center justify-center ${
                playbackRate !== 1.0
                  ? 'bg-primary-500/20 text-primary-400 border border-primary-500/40 shadow-sm'
                  : 'text-text-muted hover:text-white hover:bg-white/10'
              }`}
            >
              {playbackRate}x
            </button>

            <button
              onClick={toggleLyrics}
              aria-label="Toggle Lyrics"
              className={`p-1.5 rounded-lg transition-colors ${
                isLyricsOpen
                  ? 'text-primary-400 bg-white/10'
                  : 'text-text-muted hover:text-white hover:bg-white/5'
              }`}
              title="Lyrics"
            >
              <Mic2 className="w-4 h-4" />
            </button>

            <button
              onClick={toggleQueue}
              aria-label="Toggle Play Queue"
              className={`p-1.5 rounded-lg transition-colors ${
                isQueueOpen
                  ? 'text-primary-400 bg-white/10'
                  : 'text-text-muted hover:text-white hover:bg-white/5'
              }`}
              title="Queue"
            >
              <ListMusic className="w-4 h-4" />
            </button>

            <VolumeControl
              volume={volume}
              isMuted={isMuted}
              onVolumeChange={setVolume}
              onToggleMute={toggleMute}
            />
          </div>
        </div>
      </div>


      {/* Full-Screen Player overlay for Mobile */}
      <FullScreenPlayer />

      {/* Synchronized Lyrics Overlay & Queue Drawer Modals */}
      <LyricsModal />
      <QueueDrawer />
    </>
  );
};
