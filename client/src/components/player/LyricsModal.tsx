import React, { useEffect, useRef, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Music2, Play, Pause, Minus, Plus, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { usePlayerStore, useCurrentSong, useIsPlaying } from '../../store/playerStore.js';
import { useQuizMask } from '../../store/jamStore.js';
import { parseSyncedLyrics } from '../../utils/lyrics.js';
import { songService } from '../../services/song.service.js';
import { QUERY_KEYS } from '../../services/queryClient.js';
import { formatDuration } from '../../utils/format.js';

// A line with no successor (or a long instrumental gap) is considered sung for at most this long.
const MAX_LINE_SECONDS = 6;
// Gaps longer than this show the "instrumental" dots instead of keeping the last line lit.
const BREAK_SECONDS = 5;

// The store's currentTime only ticks ~4 times per second; interpolate between ticks so the
// karaoke fill sweeps smoothly instead of jumping.
const useSmoothTime = () => {
  const [time, setTime] = useState(() => usePlayerStore.getState().currentTime);
  useEffect(() => {
    let frame = 0;
    let base = usePlayerStore.getState().currentTime;
    let baseAt = performance.now();
    const unsubscribe = usePlayerStore.subscribe((s, prev) => {
      if (s.currentTime !== prev.currentTime) {
        base = s.currentTime;
        baseAt = performance.now();
      }
    });
    const tick = () => {
      const { isPlaying, isBuffering, playbackRate } = usePlayerStore.getState();
      const elapsed = isPlaying && !isBuffering ? Math.min(1, (performance.now() - baseAt) / 1000) : 0;
      setTime(base + elapsed * (playbackRate || 1));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      unsubscribe();
    };
  }, []);
  return time;
};

const KaraokeBody: React.FC = () => {
  const currentSong = useCurrentSong()!;
  const isPlaying = useIsPlaying();
  const duration = usePlayerStore((s) => s.duration);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const seek = usePlayerStore((s) => s.seek);
  const smoothTime = useSmoothTime();

  // Songs played from lists don't carry lyrics; fetch the detail record when needed.
  const { data: detail, isLoading } = useQuery({
    queryKey: QUERY_KEYS.songDetail(currentSong.id),
    queryFn: () => songService.getSongById(currentSong.id),
    enabled: currentSong.lyrics === undefined,
    staleTime: 1000 * 60 * 5,
  });
  const lyrics = currentSong.lyrics ?? detail?.lyrics;

  const [offset, setOffset] = useState(0);
  useEffect(() => setOffset(0), [currentSong.id]);
  const time = smoothTime + offset;

  const lines = useMemo(() => parseSyncedLyrics(lyrics?.syncedLyrics), [lyrics?.syncedLyrics]);

  let activeIndex = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (time >= lines[i].time) {
      activeIndex = i;
      break;
    }
  }
  const lineEnd = (i: number) => Math.min(lines[i + 1]?.time ?? Infinity, lines[i].time + MAX_LINE_SECONDS);
  const nextTime = lines[activeIndex + 1]?.time ?? (activeIndex === -1 ? lines[0]?.time : undefined);
  const inBreak =
    lines.length > 0 &&
    nextTime !== undefined &&
    (activeIndex === -1 || time >= lineEnd(activeIndex)) &&
    nextTime - (activeIndex === -1 ? 0 : lineEnd(activeIndex)) >= BREAK_SECONDS;
  const breakStart = activeIndex === -1 ? 0 : lineEnd(activeIndex);
  const breakProgress = inBreak && nextTime !== undefined ? (time - breakStart) / (nextTime - breakStart) : 0;

  // Auto-scroll keeps the active line centred, but yields to the user for a few seconds after they scroll.
  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);
  const userScrollUntil = useRef(0);
  useEffect(() => {
    if (Date.now() < userScrollUntil.current) return;
    activeLineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeIndex]);
  const onUserScroll = () => {
    userScrollUntil.current = Date.now() + 4000;
  };

  if (isLoading && !lyrics) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-muted">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div
        ref={containerRef}
        onWheel={onUserScroll}
        onTouchMove={onUserScroll}
        className="flex-1 overflow-y-auto no-scrollbar px-6 flex flex-col items-center select-none [mask-image:linear-gradient(to_bottom,transparent,black_15%,black_85%,transparent)]"
      >
        {!lyrics?.plainLyrics && lines.length === 0 ? (
          <div className="my-auto text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 mx-auto flex items-center justify-center text-text-muted">
              <Music2 className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-semibold text-white">Chưa có lời bài hát cho bài này.</h4>
            <p className="text-xs text-text-muted">Thưởng thức giai điệu và âm nhạc!</p>
          </div>
        ) : lines.length > 0 ? (
          <div className="max-w-3xl w-full space-y-5 md:space-y-7 text-left py-[40vh]">
            {lines.map((line, idx) => {
              const isActive = idx === activeIndex && !inBreak;
              const isPassed = idx < activeIndex || (idx === activeIndex && inBreak);
              const progress = isActive
                ? Math.min(1, Math.max(0, (time - line.time) / Math.max(0.5, lineEnd(idx) - line.time)))
                : isPassed ? 1 : 0;
              return (
                <React.Fragment key={idx}>
                  {inBreak && idx === activeIndex + 1 && (
                    <div ref={activeLineRef} className="flex items-center gap-3 py-2" aria-label="Đoạn nhạc dạo">
                      {[0, 1, 2].map((d) => (
                        <span
                          key={d}
                          className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-white transition-opacity duration-300 animate-pulse"
                          style={{ opacity: breakProgress > d / 3 ? 1 : 0.2 }}
                        />
                      ))}
                    </div>
                  )}
                  <div
                    ref={isActive ? activeLineRef : null}
                    onClick={() => seek(Math.max(0, line.time - offset))}
                    className={`cursor-pointer origin-left font-extrabold leading-snug tracking-tight transition-all duration-300 text-2xl md:text-4xl ${
                      isActive ? 'scale-100 blur-0' : isPassed ? 'scale-95 opacity-60 hover:opacity-90' : 'scale-95 opacity-40 blur-[1px] hover:opacity-80 hover:blur-0'
                    }`}
                    style={{
                      backgroundImage: `linear-gradient(90deg, #ffffff ${progress * 100}%, rgba(255,255,255,0.35) ${progress * 100}%)`,
                      WebkitBackgroundClip: 'text',
                      backgroundClip: 'text',
                      color: 'transparent',
                      textShadow: isActive ? '0 0 24px rgba(255,255,255,0.25)' : undefined,
                    }}
                  >
                    {line.text}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        ) : (
          <div className="max-w-xl w-full text-center my-auto py-16 whitespace-pre-line text-lg md:text-xl text-text-secondary leading-loose">
            {lyrics?.plainLyrics}
          </div>
        )}
      </div>

      {/* Bottom transport: play/pause, scrubber, sync offset */}
      <div className="relative z-10 flex-shrink-0 px-6 pt-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] max-w-3xl w-full mx-auto space-y-3">
        <div className="flex items-center gap-3 text-[11px] font-mono text-text-muted">
          <span className="w-10 text-right">{formatDuration(Math.floor(smoothTime))}</span>
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.5}
            value={Math.min(smoothTime, duration || 1)}
            onChange={(e) => seek(parseFloat(e.target.value))}
            aria-label="Tua bài hát"
            className="flex-1 h-1 accent-white cursor-pointer"
          />
          <span className="w-10">{formatDuration(duration)}</span>
        </div>
        <div className="flex items-center justify-between">
          {lines.length > 0 ? (
            <div className="flex items-center gap-1 text-xs text-text-muted" title="Chỉnh lời nhanh/chậm hơn nhạc">
              <button onClick={() => setOffset((o) => o - 0.25)} aria-label="Lời chậm lại" className="p-2 rounded-full hover:bg-white/10 hover:text-white">
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-20 text-center font-mono">
                {offset === 0 ? 'Đồng bộ' : `${offset > 0 ? '+' : ''}${offset.toFixed(2)}s`}
              </span>
              <button onClick={() => setOffset((o) => o + 0.25)} aria-label="Lời nhanh hơn" className="p-2 rounded-full hover:bg-white/10 hover:text-white">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : <span />}
          <button
            onClick={togglePlay}
            aria-label={isPlaying ? 'Tạm dừng' : 'Phát'}
            className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-transform"
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
          </button>
          <span className="w-[120px]" />
        </div>
      </div>
    </>
  );
};

export const LyricsModal: React.FC = () => {
  const isLyricsOpen = usePlayerStore((s) => s.isLyricsOpen);
  const playing = useCurrentSong();
  const currentSong = useQuizMask(playing);
  const toggleLyrics = usePlayerStore((s) => s.toggleLyrics);

  useEffect(() => {
    if (!isLyricsOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && toggleLyrics();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isLyricsOpen, toggleLyrics]);

  if (!isLyricsOpen || !currentSong) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed inset-0 z-[60] bg-[#07080c] flex flex-col overflow-hidden"
    >
      {/* Living background: the cover art, heavily blurred and slowly drifting */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.img
          src={currentSong.coverUrl}
          alt=""
          className="absolute w-[160%] h-[160%] -left-[30%] -top-[30%] object-cover blur-[90px] opacity-60 saturate-150"
          animate={{ rotate: [0, 8, -6, 0], scale: [1, 1.08, 1.03, 1] }}
          transition={{ duration: 40, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="absolute inset-0 bg-black/45" />
      </div>

      <div className="relative z-10 flex items-center justify-between px-6 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-3 flex-shrink-0 max-w-3xl w-full mx-auto">
        <div className="flex items-center gap-4 min-w-0">
          <img src={currentSong.coverUrl} alt={currentSong.title} className="w-12 h-12 rounded-xl object-cover shadow-lg border border-white/10" />
          <div className="min-w-0">
            <h3 className="font-bold text-white text-base md:text-lg truncate">{currentSong.title}</h3>
            <p className="text-xs md:text-sm text-white/60 truncate">{currentSong.artist?.name}</p>
          </div>
        </div>
        <button
          onClick={toggleLyrics}
          aria-label="Đóng lời bài hát"
          className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors active:scale-90"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="relative z-10 flex-1 flex flex-col min-h-0">
        {currentSong === playing ? (
          <KaraokeBody key={currentSong.id} />
        ) : (
          <p className="m-auto px-6 text-center text-white/70">Đang chơi đoán bài: lời bài hát tạm ẩn đến khi công bố đáp án.</p>
        )}
      </div>
    </motion.div>
  );
};
