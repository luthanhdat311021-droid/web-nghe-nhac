import React, { useRef, useState, useCallback } from 'react';
import { formatDuration } from '../../utils/format.js';

interface ProgressBarProps {
  currentTime: number;
  duration: number;
  buffered?: number;
  onSeek: (time: number) => void;
}

export const ProgressBar = React.memo(({
  currentTime,
  duration,
  buffered = 0,
  onSeek,
}: ProgressBarProps) => {
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPos, setHoverPos] = useState<number>(0);
  const isDraggingRef = useRef<boolean>(false);

  const safeDuration = duration > 0 ? duration : 1;
  const progressPercent = Math.min(100, Math.max(0, (currentTime / safeDuration) * 100));
  const bufferedPercent = Math.min(100, Math.max(0, (buffered / safeDuration) * 100));

  const calculateTimeFromClientX = useCallback((clientX: number) => {
    if (!progressBarRef.current) return 0;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return pos * duration;
  }, [duration]);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current) return;
    const seekTime = calculateTimeFromClientX(e.clientX);
    onSeek(seekTime);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPos(e.clientX - rect.left);
    setHoverTime(pos * duration);
  };

  const handleMouseLeave = () => {
    setHoverTime(null);
  };

  // Mobile Touch scrubbing
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length > 0) {
      isDraggingRef.current = true;
      const seekTime = calculateTimeFromClientX(e.touches[0].clientX);
      onSeek(seekTime);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isDraggingRef.current && e.touches.length > 0) {
      const seekTime = calculateTimeFromClientX(e.touches[0].clientX);
      onSeek(seekTime);
    }
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
  };

  return (
    <div className="flex items-center gap-2.5 w-full select-none touch-none">
      <span className="text-[11px] font-mono text-text-muted w-9 text-right">
        {formatDuration(currentTime)}
      </span>

      <div
        ref={progressBarRef}
        onClick={handleSeek}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="group relative flex-1 h-5 flex items-center cursor-pointer py-1 touch-target"
      >
        {/* Track Background */}
        <div className="relative w-full h-1 group-hover:h-1.5 rounded-full bg-white/10 overflow-hidden transition-all">
          {/* Buffered track */}
          <div
            className="absolute left-0 top-0 h-full bg-white/20 rounded-full transition-all"
            style={{ width: `${bufferedPercent}%` }}
          />
          {/* Active progress */}
          <div
            className="absolute left-0 top-0 h-full bg-white rounded-full transition-all group-hover:bg-white"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Scrubber Knob */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white shadow-md shadow-black/60 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity"
          style={{ left: `${progressPercent}%` }}
        />

        {/* Hover Tooltip */}
        {hoverTime !== null && (
          <div
            className="absolute -top-7 px-2 py-0.5 rounded bg-background-elevated border border-white/10 text-[10px] font-mono text-white pointer-events-none transform -translate-x-1/2 shadow-lg"
            style={{ left: `${hoverPos}px` }}
          >
            {formatDuration(hoverTime)}
          </div>
        )}
      </div>

      <span className="text-[11px] font-mono text-text-muted w-9 text-left">
        {formatDuration(duration)}
      </span>
    </div>
  );
});


