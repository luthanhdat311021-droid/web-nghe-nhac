import React, { useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Music2 } from 'lucide-react';
import { usePlayerStore, useCurrentSong } from '../../store/playerStore.js';
import { parseSyncedLyrics } from '../../utils/lyrics.js';

export const LyricsModal: React.FC = () => {
  const isLyricsOpen = usePlayerStore((s) => s.isLyricsOpen);
  const currentSong = useCurrentSong();
  const currentTime = usePlayerStore((s) => s.currentTime);
  const toggleLyrics = usePlayerStore((s) => s.toggleLyrics);
  const seek = usePlayerStore((s) => s.seek);

  const activeLineRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const syncedLines = useMemo(() => {
    if (!currentSong?.lyrics?.syncedLyrics) return [];
    return parseSyncedLyrics(currentSong.lyrics.syncedLyrics);
  }, [currentSong?.lyrics?.syncedLyrics]);

  // Find active lyric line index
  const activeIndex = useMemo(() => {
    if (syncedLines.length === 0) return -1;
    for (let i = syncedLines.length - 1; i >= 0; i--) {
      if (currentTime >= syncedLines[i].time) {
        return i;
      }
    }
    return 0;
  }, [currentTime, syncedLines]);

  // Auto-scroll active lyric line into center
  useEffect(() => {
    if (activeLineRef.current && containerRef.current && isLyricsOpen) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeIndex, isLyricsOpen]);

  if (!isLyricsOpen || !currentSong) return null;

  const hasLyrics = syncedLines.length > 0 || !!currentSong.lyrics?.plainLyrics;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: '100%' }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed inset-0 z-50 bg-background-darker/95 backdrop-blur-2xl flex flex-col overflow-hidden"
      >
        {/* Top bar header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            <img
              src={currentSong.coverUrl}
              alt={currentSong.title}
              className="w-12 h-12 rounded-xl object-cover shadow-lg border border-white/10"
            />
            <div className="min-w-0">
              <h3 className="font-bold text-white text-base md:text-lg truncate">
                {currentSong.title}
              </h3>
              <p className="text-xs md:text-sm text-text-secondary truncate">
                {currentSong.artist?.name}
              </p>
            </div>
          </div>

          <button
            onClick={toggleLyrics}
            aria-label="Close Lyrics"
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors active:scale-90"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Lyrics Body */}
        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto px-6 py-12 md:py-20 flex flex-col items-center select-none"
        >
          {!hasLyrics ? (
            <div className="my-auto text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 mx-auto flex items-center justify-center text-text-muted">
                <Music2 className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-semibold text-white">
                Chưa có lời bài hát cho bài này.
              </h4>
              <p className="text-xs text-text-muted">
                Thưởng thức giai điệu và âm nhạc!
              </p>
            </div>
          ) : syncedLines.length > 0 ? (
            <div className="max-w-2xl w-full space-y-6 md:space-y-8 text-center my-auto py-10">
              {syncedLines.map((line, idx) => {
                const isActive = idx === activeIndex;
                const isPassed = idx < activeIndex;

                return (
                  <motion.div
                    key={idx}
                    ref={isActive ? activeLineRef : null}
                    onClick={() => seek(line.time)}
                    className={`cursor-pointer transition-all duration-200 transform font-bold leading-relaxed px-4 py-2 rounded-2xl ${
                      isActive
                        ? 'text-white text-2xl md:text-4xl scale-105 font-extrabold'
                        : isPassed
                        ? 'text-text-muted text-lg md:text-2xl hover:text-white/80'
                        : 'text-white/30 text-lg md:text-2xl hover:text-white/60'
                    }`}
                  >
                    {line.text}
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="max-w-xl w-full text-center my-auto whitespace-pre-line text-lg md:text-xl text-text-secondary leading-loose">
              {currentSong.lyrics?.plainLyrics}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
