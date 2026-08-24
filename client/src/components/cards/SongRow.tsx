import React, { useState, memo } from 'react';
import { Play, Pause, Heart, MoreVertical } from 'lucide-react';
import { Song } from '../../types/index.js';
import { usePlayerStore, useIsSongCurrent, useIsSongPlaying } from '../../store/playerStore.js';
import { useAuthStore } from '../../store/authStore.js';
import { useFavoriteStore } from '../../store/favoriteStore.js';
import { formatDuration } from '../../utils/format.js';
import { MobileActionSheet } from '../common/MobileActionSheet.js';
import { Link } from 'react-router-dom';

interface SongRowProps {
  song: Song;
  index?: number;
  queueContext?: Song[];
  showAlbum?: boolean;
  extraRight?: React.ReactNode;
  onRemove?: () => void;
}

const SongRowComponent: React.FC<SongRowProps> = ({
  song,
  index,
  queueContext,
  showAlbum = true,
  extraRight,
  onRemove,
}) => {
  const isCurrent = useIsSongCurrent(song.id);
  const isCurrentPlaying = useIsSongPlaying(song.id);
  
  const playSong = usePlayerStore((s) => s.playSong);
  const resume = usePlayerStore((s) => s.resume);

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLiked = useFavoriteStore((s) => s.isLiked(song.id, song.isLiked || false));
  const toggleFavoriteOptimistic = useFavoriteStore((s) => s.toggleFavoriteOptimistic);

  const [showSheet, setShowSheet] = useState(false);

  const handleRowClick = () => {
    if (isCurrent) {
      if (!isCurrentPlaying) {
        resume();
      }
    } else {
      playSong(song, queueContext);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleRowClick();
    }
  };

  const handleLikeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) return;

    // Instant optimistic toggle across the entire application
    toggleFavoriteOptimistic(song.id, isLiked, (newStatus) => {
      if (!newStatus && onRemove) {
        onRemove();
      }
    });
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowSheet(true);
  };

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={handleRowClick}
        onKeyDown={handleKeyDown}
        aria-label={`${isCurrentPlaying ? 'Pause' : 'Play'} ${song.title} by ${song.artist?.name || 'Artist'}`}
        className={`group flex items-center gap-2.5 sm:gap-3 px-2 py-1.5 sm:py-2 rounded-xl transition-colors duration-150 cursor-pointer select-none active:scale-[0.98] outline-none focus-visible:ring-1 focus-visible:ring-white/30 ${
          isCurrent
            ? 'bg-white/[0.08] border border-white/10'
            : 'hover:bg-white/[0.04] active:bg-white/[0.06] border border-transparent'
        }`}
      >
        {/* Index or Animated equalizer indicator */}
        <div className="w-5 sm:w-6 text-center text-xs font-medium text-text-muted flex-shrink-0 flex items-center justify-center">
          {isCurrentPlaying ? (
            <span className="flex items-end gap-0.5 h-3">
              <span className="w-0.5 bg-white animate-[bounce_0.8s_infinite] h-full rounded-full" />
              <span className="w-0.5 bg-white animate-[bounce_1.1s_infinite] h-2/3 rounded-full" />
              <span className="w-0.5 bg-white animate-[bounce_0.6s_infinite] h-4/5 rounded-full" />
            </span>
          ) : (
            <>
              <span className="group-hover:hidden hidden sm:inline text-text-muted">
                {index !== undefined ? `${index + 1}` : ''}
              </span>
              <span className="hidden group-hover:flex sm:hidden items-center justify-center">
                <Play className="w-3.5 h-3.5 fill-white text-white ml-0.5" />
              </span>
            </>
          )}
        </div>

        {/* Thumbnail Cover */}
        <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-lg overflow-hidden flex-shrink-0 bg-white/5 shadow-sm">
          <img
            src={song.coverUrl}
            alt={song.title}
            loading="lazy"
            className="w-full h-full object-cover"
          />
          {isCurrent && !isCurrentPlaying && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Pause className="w-3.5 h-3.5 text-white fill-current" />
            </div>
          )}
        </div>

        {/* Title & Artist */}
        <div className="min-w-0 flex-1">
          <h4
            className={`text-xs sm:text-sm font-semibold truncate transition-colors leading-tight ${
              isCurrent ? 'text-white font-bold' : 'text-text-primary group-hover:text-white'
            }`}
          >
            {song.title}
          </h4>
          {song.artist && (
            <Link
              to={`/artist/${song.artist.id}`}
              onClick={(e) => e.stopPropagation()}
              className="text-[11px] sm:text-xs text-text-muted hover:text-white transition-colors truncate block mt-0.5"
            >
              {song.artist.name}
            </Link>
          )}
        </div>

        {/* Album (Tablet & Desktop only) */}
        {showAlbum && song.album && (
          <div className="hidden md:block w-40 lg:w-48 text-xs text-text-muted truncate">
            <Link
              to={`/album/${song.album.id}`}
              onClick={(e) => e.stopPropagation()}
              className="hover:text-white transition-colors"
            >
              {song.album.title}
            </Link>
          </div>
        )}

        {/* Optional Extra Right Info (e.g. Played Time) */}
        {extraRight && (
          <div className="hidden md:flex items-center text-xs text-text-muted flex-shrink-0">
            {extraRight}
          </div>
        )}

        {/* Like & Duration & Menu Actions */}
        <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
          <button
            onClick={handleLikeClick}
            aria-label={isLiked ? 'Bỏ thích' : 'Yêu thích'}
            className={`p-1.5 rounded-lg transition-all duration-150 active:scale-90 flex items-center justify-center ${
              isLiked
                ? 'text-rose-500'
                : 'text-text-muted hover:text-white hover:bg-white/5 sm:opacity-0 sm:group-hover:opacity-100'
            }`}
          >
            <Heart className={`w-4 h-4 transition-transform ${isLiked ? 'fill-current scale-110' : ''}`} />
          </button>

          <span className="text-[11px] sm:text-xs font-mono text-text-muted w-8 sm:w-10 text-right hidden xs:inline-block">
            {formatDuration(song.duration)}
          </span>

          <button
            onClick={handleMenuClick}
            aria-label="Tùy chọn"
            className="p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/5 active:scale-90 transition-all flex items-center justify-center"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      <MobileActionSheet
        isOpen={showSheet}
        onClose={() => setShowSheet(false)}
        song={song}
        queueContext={queueContext}
      />
    </>
  );
};

export const SongRow = memo(SongRowComponent);
