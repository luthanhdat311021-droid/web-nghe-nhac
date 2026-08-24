import React, { useState, memo } from 'react';
import { Play, Pause, MoreVertical } from 'lucide-react';
import { Song } from '../../types/index.js';
import { usePlayerStore, useIsSongCurrent, useIsSongPlaying } from '../../store/playerStore.js';
import { MobileActionSheet } from '../common/MobileActionSheet.js';

interface SongCardProps {
  song: Song;
  queueContext?: Song[];
  className?: string;
}

const SongCardComponent: React.FC<SongCardProps> = ({ song, queueContext, className = '' }) => {
  const isCurrent = useIsSongCurrent(song.id);
  const isCurrentPlaying = useIsSongPlaying(song.id);

  const playSong = usePlayerStore((s) => s.playSong);
  const resume = usePlayerStore((s) => s.resume);
  const togglePlay = usePlayerStore((s) => s.togglePlay);

  const [showSheet, setShowSheet] = useState(false);

  const handleCardClick = () => {
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
      handleCardClick();
    }
  };

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isCurrent) {
      togglePlay();
    } else {
      playSong(song, queueContext);
    }
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setShowSheet(true);
  };

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={handleKeyDown}
        aria-label={`${isCurrentPlaying ? 'Pause' : 'Play'} ${song.title} by ${song.artist?.name || 'Artist'}`}
        className={`group relative rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] hover:border-white/[0.12] p-2.5 sm:p-3 transition-colors duration-150 cursor-pointer select-none active:scale-[0.98] outline-none focus-visible:ring-1 focus-visible:ring-white/30 ${className}`}
      >
        {/* Cover Artwork with Play Button */}
        <div className="relative aspect-square w-full rounded-lg overflow-hidden mb-2 bg-white/5 shadow-sm">
          <img
            src={song.coverUrl}
            alt={song.title}
            loading="lazy"
            className="w-full h-full object-cover"
          />

          {/* Desktop Hover Overlay */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-150 hidden sm:flex items-center justify-center">
            <button
              onClick={handlePlayClick}
              aria-label={isCurrentPlaying ? 'Pause' : 'Play'}
              className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow hover:scale-105 active:scale-95 transition-transform"
            >
              {isCurrentPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>
          </div>

          {/* Mobile Always-Visible Play/Pause Badge */}
          <div className="sm:hidden absolute bottom-1.5 right-1.5">
            <button
              onClick={handlePlayClick}
              aria-label={isCurrentPlaying ? 'Pause' : 'Play'}
              className="w-7 h-7 rounded-full bg-black/70 backdrop-blur text-white flex items-center justify-center shadow active:scale-90"
            >
              {isCurrentPlaying ? (
                <Pause className="w-3 h-3 fill-current" />
              ) : (
                <Play className="w-3 h-3 fill-current ml-0.5" />
              )}
            </button>
          </div>

          {/* Playing Status Indicator */}
          {isCurrent && (
            <div className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded bg-black/80 backdrop-blur text-[9px] font-semibold text-white uppercase tracking-wider flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              {isCurrentPlaying ? 'Đang phát' : 'Tạm dừng'}
            </div>
          )}
        </div>

        {/* Info & Touch Actions */}
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0 flex-1">
            <h4
              className={`font-semibold text-xs sm:text-sm truncate transition-colors leading-tight ${
                isCurrent ? 'text-white font-bold' : 'text-text-primary group-hover:text-white'
              }`}
            >
              {song.title}
            </h4>
            {song.artist && (
              <span className="block text-[11px] sm:text-xs text-text-muted truncate mt-0.5">
                {song.artist.name}
              </span>
            )}
          </div>

          <button
            onClick={handleMenuClick}
            aria-label="Tùy chọn"
            className="p-1.5 -mr-1 rounded-lg text-text-muted hover:text-white hover:bg-white/5 active:scale-90 transition-all"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile Action Sheet Modal */}
      <MobileActionSheet
        isOpen={showSheet}
        onClose={() => setShowSheet(false)}
        song={song}
        queueContext={queueContext}
      />
    </>
  );
};

export const SongCard = memo(SongCardComponent);
