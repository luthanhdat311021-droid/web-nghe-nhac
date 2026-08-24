import React from 'react';
import { Volume2, Volume1, VolumeX } from 'lucide-react';

interface VolumeControlProps {
  volume: number;
  isMuted: boolean;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
}

export const VolumeControl: React.FC<VolumeControlProps> = ({
  volume,
  isMuted,
  onVolumeChange,
  onToggleMute,
}) => {
  const currentVol = isMuted ? 0 : volume;

  const getIcon = () => {
    if (isMuted || volume === 0) return <VolumeX className="w-4 h-4 text-text-muted" />;
    if (volume < 0.5) return <Volume1 className="w-4 h-4 text-text-secondary" />;
    return <Volume2 className="w-4 h-4 text-text-secondary" />;
  };

  return (
    <div className="flex items-center gap-2 select-none">
      <button
        onClick={onToggleMute}
        aria-label={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
        className="p-1.5 rounded-full text-text-muted hover:text-white hover:bg-white/10 transition-colors active:scale-95"
      >
        {getIcon()}
      </button>

      <div className="relative w-20 md:w-24 h-1 bg-white/10 hover:h-1.5 rounded-full flex items-center group cursor-pointer transition-all">
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={currentVol}
          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
          aria-label="Âm lượng"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
        <div
          className="h-full bg-white rounded-full transition-all group-hover:bg-white"
          style={{ width: `${currentVol * 100}%` }}
        />
      </div>
    </div>
  );
};

