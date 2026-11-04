import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Flame, Volume2, Sparkles, Headphones, AudioWaveform } from 'lucide-react';
import {
  DetectedPitch,
  LineMelody,
  pitchDistanceInSemitones,
  foldToOctaveOf,
  TargetMelodyNote,
} from '../../utils/pitchDetector.js';
import {
  KaraokeRank,
  KaraokeVerdict,
} from '../../hooks/useKaraokeScorer.js';

interface KaraokePitchVisualizerProps {
  isMicOn: boolean;
  onToggleMic: () => void;
  livePitch: DetectedPitch | null;
  currentNote: TargetMelodyNote | null;
  lastVerdict: KaraokeVerdict | null;
  totalScore: number;
  combo: number;
  currentRank: KaraokeRank;
  activeLineMelody: LineMelody | null;
  currentTime: number;
  isBeatOnly?: boolean;
  onToggleBeatMode?: () => void;
  isVoicePacing?: boolean;
  onToggleVoicePacing?: () => void;
  sungWordIndex?: number;
}

const RANK_COLORS: Record<KaraokeRank, { bg: string; text: string; glow: string }> = {
  SSS: { bg: 'bg-amber-400 text-black', text: 'text-amber-300', glow: 'shadow-[0_0_20px_rgba(251,191,36,0.6)]' },
  SS:  { bg: 'bg-amber-300 text-black', text: 'text-amber-200', glow: 'shadow-[0_0_15px_rgba(252,211,77,0.5)]' },
  S:   { bg: 'bg-emerald-400 text-black', text: 'text-emerald-300', glow: 'shadow-[0_0_15px_rgba(52,211,153,0.5)]' },
  A:   { bg: 'bg-cyan-400 text-black', text: 'text-cyan-300', glow: 'shadow-[0_0_12px_rgba(34,211,238,0.4)]' },
  B:   { bg: 'bg-indigo-400 text-white', text: 'text-indigo-300', glow: 'shadow-[0_0_10px_rgba(129,140,248,0.3)]' },
  C:   { bg: 'bg-neutral-600 text-white', text: 'text-neutral-400', glow: '' },
};

export const KaraokePitchVisualizer: React.FC<KaraokePitchVisualizerProps> = ({
  isMicOn,
  onToggleMic,
  livePitch,
  currentNote,
  lastVerdict,
  totalScore,
  combo,
  currentRank,
  activeLineMelody,
  currentTime,
  isBeatOnly = false,
  onToggleBeatMode,
  isVoicePacing = true,
  onToggleVoicePacing,
  sungWordIndex = -1,
}) => {
  const rankStyle = RANK_COLORS[currentRank] || RANK_COLORS.C;

  // Tính khoảng cách nốt mục tiêu so với nốt người dùng
  const pitchMatch = useMemo(() => {
    if (!livePitch?.isVoiced || !currentNote) return null;
    const diff = pitchDistanceInSemitones(livePitch.midi, currentNote.midi);
    return {
      diff,
      isPerfect: diff <= 0.5,
      isGood: diff <= 1,
    };
  }, [livePitch, currentNote]);

  // The stage is a window of ±7 semitones around the singer's note (or the user's, before the singer is heard).
  // The user's note is moved to the singer's octave, since any octave counts as correct.
  const centerMidi = currentNote?.midi ?? livePitch?.midi ?? 64;
  const MIN_MIDI = centerMidi - 7;
  const MIDI_RANGE = 14;
  const userMidi = livePitch ? (currentNote ? foldToOctaveOf(livePitch.midi, currentNote.midi) : livePitch.midi) : null;

  // Đổi MIDI sang phần trăm vị trí theo chiều dọc (trục Y từ dưới lên), chừa hàng chữ ở đáy
  const midiToPercentY = (midi: number) => {
    const k = Math.max(0, Math.min(1, (midi - MIN_MIDI) / MIDI_RANGE));
    return 24 + k * 64;
  };

  return (
    <div className="w-full max-w-3xl mx-auto mb-4 bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/10 rounded-2xl p-3 sm:p-4 shadow-2xl backdrop-blur-xl relative overflow-hidden">
      {/* Background Neon Grid / Glow */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-transparent" />

      {/* Top HUD: Score, Combo, Rank, Mic Toggle, Beat Mode, Voice Pacing */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onToggleMic}
            className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 ${
              isMicOn
                ? 'bg-emerald-400 text-black shadow-[0_0_15px_rgba(52,211,153,0.5)]'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {isMicOn ? (
              <>
                <Mic className="w-3.5 h-3.5 animate-pulse" />
                <span>Đang Hát</span>
              </>
            ) : (
              <>
                <MicOff className="w-3.5 h-3.5 text-rose-300" />
                <span>Bắt Đầu Hát</span>
              </>
            )}
          </button>

          {onToggleBeatMode && (
            <button
              onClick={onToggleBeatMode}
              title={isBeatOnly ? 'Đang tắt giọng ca sĩ gốc, chỉ phát nhạc Beat' : 'Bấm để tách giọng ca sĩ, chỉ giữ nhạc Beat'}
              className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 border transition-all active:scale-95 ${
                isBeatOnly
                  ? 'bg-cyan-400/20 text-cyan-200 border-cyan-400/50 shadow-[0_0_12px_rgba(34,211,238,0.35)]'
                  : 'bg-white/5 text-white/70 border-white/15 hover:bg-white/15 hover:text-white'
              }`}
            >
              <Headphones className="w-3.5 h-3.5" />
              <span>{isBeatOnly ? 'Chỉ Beat (Tách lời)' : 'Beat + Lời gốc'}</span>
            </button>
          )}

          {isMicOn && onToggleVoicePacing && (
            <button
              onClick={onToggleVoicePacing}
              title="Khi bật: bạn hát tới đâu chữ sẽ sáng chạy tới đó"
              className={`px-2.5 py-1.5 rounded-full text-[11px] font-semibold flex items-center gap-1.5 border transition-all active:scale-95 ${
                isVoicePacing
                  ? 'bg-amber-400/20 text-amber-200 border-amber-400/40'
                  : 'bg-white/5 text-white/60 border-white/10 hover:text-white'
              }`}
            >
              <AudioWaveform className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isVoicePacing ? 'Chữ chạy theo giọng' : 'Chữ chạy tự động'}</span>
            </button>
          )}

          {isMicOn && (
            <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-300">
              <Volume2 className="w-3.5 h-3.5" />
              <div className="w-10 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-emerald-400 transition-all duration-75"
                  style={{ width: `${Math.min(100, (livePitch?.volume || 0) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Center: Total Score & Combo */}
        <div className="flex items-center gap-3">
          {combo >= 2 && (
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 1 }}
              className="flex items-center gap-1 text-xs font-black text-amber-300 bg-amber-400/15 border border-amber-300/30 rounded-full px-2.5 py-0.5"
            >
              <Flame className="w-3.5 h-3.5 fill-current" />
              <span>COMBO x{combo}</span>
            </motion.div>
          )}

          <div className="text-right">
            <span className="text-[10px] uppercase font-bold tracking-wider text-text-muted block">Điểm</span>
            <span className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white">
              {totalScore.toLocaleString()}
            </span>
          </div>

          {/* Rank Badge */}
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm ${rankStyle.bg} ${rankStyle.glow}`}
          >
            {currentRank}
          </div>
        </div>
      </div>

      {/* Main Pitch Stage (Pitch Guide Bars & User Pitch Pointer) */}
      <div className="relative z-10 h-28 sm:h-32 w-full mt-3 rounded-xl bg-black/40 border border-white/5 overflow-hidden flex flex-col justify-between p-2">
        {/* Singer's note right now: the line the user aims for */}
        {isMicOn && currentNote && (
          <div
            className="absolute left-0 right-0 z-10 pointer-events-none flex items-center transition-[bottom] duration-150"
            style={{ bottom: `${midiToPercentY(currentNote.midi)}%` }}
          >
            <div className="flex-1 h-[3px] rounded-full bg-amber-300/70 shadow-[0_0_10px_rgba(252,211,77,0.6)]" />
            <span className="ml-1 mr-2 text-[9px] font-bold text-amber-200">Ca sĩ</span>
          </div>
        )}

        {/* Target Note Blocks of Current Line */}
        {activeLineMelody && (
          <div className="absolute inset-0 px-4 py-2 pointer-events-none">
            {activeLineMelody.notes.map((note, nIdx) => {
              const isCurrent =
                isMicOn && isVoicePacing
                  ? nIdx === Math.max(0, sungWordIndex)
                  : currentTime >= note.startSec && currentTime < note.startSec + note.durationSec;
              const isPassed =
                isMicOn && isVoicePacing
                  ? nIdx < sungWordIndex
                  : currentTime >= note.startSec + note.durationSec;
              // Tọa độ X tương đối trong dòng
              const lineDur = Math.max(1, activeLineMelody.endSec - activeLineMelody.startSec);
              const xStartPercent =
                ((note.startSec - activeLineMelody.startSec) / lineDur) * 100;
              const widthPercent = (note.durationSec / lineDur) * 100;

              return (
                <div
                  key={note.id}
                  className={`absolute h-4 sm:h-5 rounded-md flex items-center justify-center text-[10px] font-bold transition-all duration-150 ${
                    isCurrent
                      ? pitchMatch?.isGood
                        ? 'bg-gradient-to-r from-emerald-400 to-cyan-300 text-black shadow-[0_0_15px_rgba(52,211,153,0.8)] scale-105 z-20'
                        : 'bg-gradient-to-r from-amber-400 to-rose-400 text-black shadow-[0_0_10px_rgba(251,191,36,0.5)] z-20'
                      : isPassed
                      ? 'bg-emerald-400/25 text-emerald-200/70'
                      : 'bg-white/10 text-white/70 border border-white/10'
                  }`}
                  style={{
                    bottom: '4%',
                    left: `${Math.max(2, Math.min(92, xStartPercent))}%`,
                    width: `${Math.max(6, Math.min(40, widthPercent - 1))}%`,
                  }}
                >
                  <span className="truncate px-1">{note.word}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* User Realtime Pitch Dot & Particle Wave */}
        {isMicOn && livePitch?.isVoiced && userMidi !== null && (
          <motion.div
            className="absolute z-30 flex items-center"
            style={{
              bottom: `${midiToPercentY(userMidi)}%`,
              left: '48%',
            }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          >
            {/* Glow Dot */}
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[9px] shadow-lg transition-colors ${
                pitchMatch?.isPerfect
                  ? 'bg-amber-300 text-black shadow-[0_0_20px_#fde047]'
                  : pitchMatch?.isGood
                  ? 'bg-emerald-400 text-black shadow-[0_0_15px_#34d399]'
                  : 'bg-cyan-400 text-black shadow-[0_0_10px_#22d3ee]'
              }`}
            >
              {livePitch.noteName}
            </div>

            {pitchMatch?.isPerfect && (
              <Sparkles className="w-4 h-4 text-amber-300 ml-1 animate-spin" />
            )}
          </motion.div>
        )}

        {/* Center Prompt when Mic is Off */}
        {!isMicOn && (
          <div className="absolute inset-0 flex items-center justify-center text-center p-4 bg-black/40 backdrop-blur-sm">
            <p className="text-xs text-white/80">
              🎤 Bấm <strong>Bắt Đầu Hát</strong> để tự động tách giọng ca sĩ (chỉ giữ Beat) và lời sẽ sáng chạy theo đúng giọng hát của bạn!
            </p>
          </div>
        )}

        {/* Floating Verdict Notification (PERFECT / GOOD / MISS) */}
        <AnimatePresence>
          {lastVerdict && (
            <motion.div
              key={lastVerdict.timestamp}
              initial={{ scale: 0.4, opacity: 0, y: 10 }}
              animate={{ scale: [1.2, 1], opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: -20 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="absolute top-2 right-3 z-40 flex items-center gap-2 pointer-events-none"
            >
              <div
                className={`px-3 py-1 rounded-xl font-black text-xs sm:text-sm tracking-wider uppercase shadow-xl ${
                  lastVerdict.type === 'PERFECT'
                    ? 'bg-amber-400 text-black shadow-[0_0_20px_rgba(251,191,36,0.8)] border border-amber-200'
                    : lastVerdict.type === 'GOOD'
                    ? 'bg-emerald-400 text-black shadow-[0_0_15px_rgba(52,211,153,0.7)]'
                    : 'bg-neutral-800 text-neutral-400 border border-white/10'
                }`}
              >
                {lastVerdict.type}! {lastVerdict.points > 0 ? `+${lastVerdict.points}` : ''}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom Current Note Display */}
        <div className="relative z-10 flex items-center justify-between text-[11px] text-text-muted">
          <span>
            {currentNote ? (
              <span className="text-white/80">
                Nốt ca sĩ: <strong className="text-amber-300">{currentNote.noteName}</strong>
                {currentNote.word ? ` (${currentNote.word})` : ''}
              </span>
            ) : activeLineMelody ? (
              'Đang nghe giai điệu ca sĩ…'
            ) : (
              'Đang chờ nhạc dạo…'
            )}
          </span>
          <span>
            {livePitch?.isVoiced ? (
              <span className="text-emerald-300 font-mono">
                Giọng bạn: <strong>{livePitch.noteName}</strong> ({Math.round(livePitch.freq)} Hz)
              </span>
            ) : (
              <span className="text-white/40">Hát vào mic…</span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
};

