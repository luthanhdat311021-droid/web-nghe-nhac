import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  DetectedPitch,
  detectPitchFromBuffer,
  generateMelodyForLines,
  LineMelody,
  pitchDistanceInSemitones,
  TargetMelodyNote,
} from '../utils/pitchDetector.js';import { karaokeAudioEngine } from '../utils/vocalRemover.js';

// Shown instead of silently playing the original mix with vocals.
const BEAT_UNSUPPORTED =
  'Bài này không tách được giọng ca sĩ: nhạc phát từ YouTube hoặc máy chủ không cho phép xử lý âm thanh (iPhone cũng chưa hỗ trợ). Bạn vẫn hát và chấm điểm bình thường.';

// Per-line tallies, in analysis frames (~30 per second).
interface LineStats {
  frames: number;      // frames the line was on screen while playing
  voiced: number;      // ...in which the user was singing
  compared: number;    // ...in which both the user and the original singer had a clear pitch
  hits: number;        // compared frames within 1 semitone of the singer (any octave)
  perfects: number;    // compared frames within half a semitone
}
const emptyStats = (): LineStats => ({ frames: 0, voiced: 0, compared: 0, hits: 0, perfects: 0 });

// Below this the singer's pitch is unreadable in the mix (instruments, chords, silence). Measured on a real
// song: sung verses read ~0.62 median, instrumental intros ~0.49.
const SINGER_CLARITY = 0.6;
// The tap follows the player's volume slider; clarity does not, so only near-silence is rejected by level.
const SINGER_MIN_RMS = 0.002;
// Lines shorter than this (in frames) are skipped rather than judged on a handful of samples.
const MIN_LINE_FRAMES = 15;

/** PERFECT / GOOD / MISS for a finished line: pitch against the singer when it was readable, else timing only. */
export const judgeLine = (s: LineStats): KaraokeVerdictType | null => {
  if (s.frames < MIN_LINE_FRAMES) return null;
  const coverage = s.voiced / s.frames;
  if (s.compared >= 8) {
    const accuracy = s.hits / s.compared;
    const precise = s.perfects / s.compared;
    if (coverage >= 0.3 && (precise >= 0.45 || accuracy >= 0.65)) return 'PERFECT';
    if (coverage >= 0.2 && accuracy >= 0.3) return 'GOOD';
    return 'MISS';
  }
  // Singer not readable (YouTube source, dense mix): reward singing through the line on time.
  if (coverage >= 0.6) return 'PERFECT';
  if (coverage >= 0.3) return 'GOOD';
  return 'MISS';
};

export type KaraokeVerdictType = 'PERFECT' | 'GOOD' | 'MISS';

export interface KaraokeVerdict {
  type: KaraokeVerdictType;
  points: number;
  combo: number;
  lineIndex: number;
  timestamp: number;
}

export type KaraokeRank = 'SSS' | 'SS' | 'S' | 'A' | 'B' | 'C';

export interface KaraokeScoreSummary {
  songId: string;
  totalScore: number;
  rank: KaraokeRank;
  perfectCount: number;
  goodCount: number;
  missCount: number;
  maxCombo: number;
  completedAt: Date;
}

interface UseKaraokeScorerProps {
  songId?: string;
  lines: { time: number; text: string }[];
  currentTime: number;
  isPlaying: boolean;
  duration?: number;
  onVerdict?: (verdict: KaraokeVerdict) => void;
  onFinish?: (summary: KaraokeScoreSummary) => void;
}

export const calculateRank = (score: number, maxPossibleScore: number): KaraokeRank => {
  if (maxPossibleScore <= 0) return 'C';
  const ratio = score / maxPossibleScore;
  if (ratio >= 0.9) return 'SSS';
  if (ratio >= 0.8) return 'SS';
  if (ratio >= 0.7) return 'S';
  if (ratio >= 0.55) return 'A';
  if (ratio >= 0.4) return 'B';
  return 'C';
};

export const useKaraokeScorer = ({
  songId,
  lines,
  currentTime,
  isPlaying,
  duration = 240,
  onVerdict,
  onFinish,
}: UseKaraokeScorerProps) => {
  const [isMicOn, setIsMicOn] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [livePitch, setLivePitch] = useState<DetectedPitch | null>(null);
  const [currentNote, setCurrentNote] = useState<TargetMelodyNote | null>(null);
  const [lastVerdict, setLastVerdict] = useState<KaraokeVerdict | null>(null);
  const [totalScore, setTotalScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [perfectCount, setPerfectCount] = useState(0);
  const [goodCount, setGoodCount] = useState(0);
  const [missCount, setMissCount] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  // Chế độ "Chỉ cần Beat (Tách giọng ca sĩ)" & "Hát tới đâu lời chạy tới đó"
  const [isBeatOnly, setIsBeatOnly] = useState(false);
  const [isVoicePacing, setIsVoicePacing] = useState(true);
  const [voiceProgress, setVoiceProgress] = useState(0);
  const [sungWordIndex, setSungWordIndex] = useState(-1);
  const voiceProgressRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);

  // Sinh danh sách nốt giai điệu mục tiêu cho bài hát
  const lineMelodies = useMemo<LineMelody[]>(() => {
    if (!songId || lines.length === 0) return [];
    return generateMelodyForLines(songId, lines, duration);
  }, [songId, lines, duration]);

  // Audio Context & Stream refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);

  // Thống kê từng dòng đang hát
  const currentLineIndexRef = useRef<number>(-1);
  const lineStatsRef = useRef<LineStats>(emptyStats());
  // The analysis loop runs per animation frame; it reads the latest playback time from a ref instead of
  // restarting every time the player reports a new currentTime (~4 times a second).
  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;

  // Bật / tắt chế độ Chỉ cần Beat (Vocal Remover)
  const toggleBeatMode = useCallback((forceState?: boolean) => {
    const next = typeof forceState === 'boolean' ? forceState : !karaokeAudioEngine.isBeatOnly();
    const ok = karaokeAudioEngine.setBeatOnly(next);
    setIsBeatOnly(next && ok);
    if (!ok) {
      karaokeAudioEngine.setBeatOnly(false);
      setMicError(BEAT_UNSUPPORTED);
    }
  }, []);

  // Bật / tắt chế độ lời chạy theo giọng hát
  const toggleVoicePacing = useCallback(() => {
    setIsVoicePacing((prev) => !prev);
  }, []);

  // Khởi động microphone và Web Audio API (tự động bật Beat-only & Voice Pacing)
  const startMic = useCallback(async () => {
    try {
      setMicError(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Trình duyệt không hỗ trợ thu âm từ micro.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048; // Đủ mẫu cho phân tích tần số giọng người
      source.connect(analyser);

      audioContextRef.current = ctx;
      mediaStreamRef.current = stream;
      analyserRef.current = analyser;
      setIsMicOn(true);

      // Khi bấm bắt đầu hát Karaoke -> Tự động tách lời ca sĩ (chỉ giữ Beat) & bật bám lời theo giọng
      const beatOk = karaokeAudioEngine.setBeatOnly(true);
      setIsBeatOnly(beatOk);
      if (!beatOk) {
        karaokeAudioEngine.setBeatOnly(false);
        setMicError(BEAT_UNSUPPORTED);
      }
      setIsVoicePacing(true);
    } catch (err: any) {
      console.error('Lỗi truy cập micro:', err);
      const msg =
        err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
          ? 'Bạn đã từ chối cấp quyền truy cập micro. Vui lòng cho phép quyền trong trình duyệt.'
          : err.message || 'Không thể kết nối với micro.';
      setMicError(msg);
      setIsMicOn(false);
    }
  }, []);

  // Tắt microphone và giải phóng AudioContext
  const stopMic = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setIsMicOn(false);
    setLivePitch(null);
    setCurrentNote(null);
    voiceProgressRef.current = 0;
    setVoiceProgress(0);
    setSungWordIndex(-1);
    karaokeAudioEngine.setBeatOnly(false);
    setIsBeatOnly(false);
  }, []);

  // Reset điểm số
  const resetScore = useCallback(() => {
    setTotalScore(0);
    setCombo(0);
    setMaxCombo(0);
    setPerfectCount(0);
    setGoodCount(0);
    setMissCount(0);
    setLastVerdict(null);
    setIsFinished(false);
    currentLineIndexRef.current = -1;
    lineStatsRef.current = emptyStats();
  }, []);

  // Đánh giá và chấm điểm cho dòng vừa hoàn thành
  const evaluateLine = useCallback(
    (lineIdx: number) => {
      if (lineIdx < 0 || lineIdx >= lineMelodies.length) return;
      const judged = judgeLine(lineStatsRef.current);
      lineStatsRef.current = emptyStats();
      // Too short to judge (or skipped by seeking): no verdict, combo untouched.
      if (!judged) return;
      const verdictType: KaraokeVerdictType = judged;
      let points = 0;

      setCombo((prevCombo) => {
        let nextCombo = 0;
        if (verdictType === 'PERFECT') {
          nextCombo = prevCombo + 1;
          const comboMultiplier = Math.min(2.0, 1 + nextCombo * 0.1);
          points = Math.round(1000 * comboMultiplier);
          setPerfectCount((c) => c + 1);
        } else if (verdictType === 'GOOD') {
          nextCombo = prevCombo + 1;
          points = 600;
          setGoodCount((c) => c + 1);
        } else {
          nextCombo = 0;
          points = 0;
          setMissCount((c) => c + 1);
        }

        setMaxCombo((m) => Math.max(m, nextCombo));
        setTotalScore((s) => s + points);

        const verdict: KaraokeVerdict = {
          type: verdictType,
          points,
          combo: nextCombo,
          lineIndex: lineIdx,
          timestamp: Date.now(),
        };
        setLastVerdict(verdict);
        if (onVerdict) onVerdict(verdict);

        return nextCombo;
      });
    },
    [lineMelodies, onVerdict]
  );

  const evaluateLineRef = useRef(evaluateLine);
  evaluateLineRef.current = evaluateLine;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  // Vòng lặp phân tích: giọng người hát (micro) so với giọng ca sĩ gốc đọc trực tiếp từ bài hát.
  useEffect(() => {
    if (!isMicOn || !analyserRef.current || !audioContextRef.current) return;

    const analyser = analyserRef.current;
    const sampleRate = audioContextRef.current.sampleRate;
    const buffer = new Float32Array(analyser.fftSize);
    let reference: AnalyserNode | null = null;
    let referenceBuffer: Float32Array<ArrayBuffer> | null = null;
    let referenceCheckedAt = 0;
    let frame = 0;

    const tick = () => {
      animFrameRef.current = requestAnimationFrame(tick);
      // Two autocorrelations per frame are heavy on phones; ~30 analyses per second is plenty for singing.
      if (frame++ % 2) return;
      const currentTime = currentTimeRef.current;

      analyser.getFloatTimeDomainData(buffer);
      const pitch = detectPitchFromBuffer(buffer, sampleRate);
      setLivePitch(pitch);

      // The playing <audio> element changes between songs; look the reference tap up again now and then.
      const now = performance.now();
      if (now - referenceCheckedAt > 1000) {
        referenceCheckedAt = now;
        reference = karaokeAudioEngine.getReferenceAnalyser();
        if (reference && referenceBuffer?.length !== reference.fftSize) referenceBuffer = new Float32Array(reference.fftSize);
      }
      let singer: DetectedPitch | null = null;
      if (reference && referenceBuffer && isPlayingRef.current) {
        reference.getFloatTimeDomainData(referenceBuffer);
        const p = detectPitchFromBuffer(referenceBuffer, reference.context.sampleRate, SINGER_MIN_RMS);
        if (p && p.clarity >= SINGER_CLARITY) singer = p;
      }

      let activeLineIdx = -1;
      let word: TargetMelodyNote | null = null;
      for (let i = 0; i < lineMelodies.length; i++) {
        const line = lineMelodies[i];
        if (currentTime >= line.startSec && currentTime < line.endSec) {
          activeLineIdx = i;
          word = line.notes.find((n) => currentTime >= n.startSec && currentTime < n.startSec + n.durationSec) || line.notes[0];
          break;
        }
      }

      // The target shown and judged is the singer's real note, labelled with the word being sung.
      const target: TargetMelodyNote | null =
        singer && activeLineIdx !== -1
          ? {
              id: word?.id || 'singer',
              word: word?.word || '',
              startSec: currentTime,
              durationSec: 0,
              midi: singer.midi,
              noteName: singer.noteName,
              freq: singer.freq,
            }
          : null;
      setCurrentNote(target);

      const dt = lastFrameTimeRef.current > 0 ? Math.min(0.1, (now - lastFrameTimeRef.current) / 1000) : 1 / 30;
      lastFrameTimeRef.current = now;

      // Leaving a line (to the next one or to an instrumental gap) scores it.
      if (currentLineIndexRef.current !== activeLineIdx) {
        if (currentLineIndexRef.current !== -1) {
          evaluateLineRef.current(currentLineIndexRef.current);
        }
        lineStatsRef.current = emptyStats();
        voiceProgressRef.current = 0;
        setVoiceProgress(0);
        setSungWordIndex(-1);
        currentLineIndexRef.current = activeLineIdx;
      }

      // Nếu người dùng đang hát -> thu thập frame thống kê & đẩy chữ chạy theo giọng hát
      if (activeLineIdx !== -1 && isPlayingRef.current) {
        const activeLine = lineMelodies[activeLineIdx];
        const totalWords = Math.max(1, activeLine.notes.length);
        const stats = lineStatsRef.current;
        stats.frames++;

        if (pitch?.isVoiced) {
          let speedBoost = 1.0;
          stats.voiced++;
          if (target) {
            stats.compared++;
            const diff = pitchDistanceInSemitones(pitch.midi, target.midi);
            if (diff <= 0.5) {
              stats.perfects++;
              stats.hits++;
              speedBoost = 1.15;
            } else if (diff <= 1) {
              stats.hits++;
              speedBoost = 1.08;
            }
          }

          // Tính tốc độ chạy chữ dựa trên thời lượng câu hát khi người dùng phát ra âm thanh
          const effectiveLineDuration = Math.max(1.2, (activeLine.endSec - activeLine.startSec) * 0.72);
          const step = (dt / effectiveLineDuration) * speedBoost;
          const nextProgress = Math.min(1, voiceProgressRef.current + step);
          voiceProgressRef.current = nextProgress;
          setVoiceProgress(nextProgress);
          setSungWordIndex(Math.min(totalWords - 1, Math.floor(nextProgress * totalWords)));
        }
        // Khi người dùng ngưng hát (!pitch?.isVoiced), voiceProgressRef giữ nguyên vị trí hiện tại!
      }
    };

    lastFrameTimeRef.current = performance.now();
    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isMicOn, lineMelodies]);

  // Khi bài hát gần kết thúc (hoặc kết thúc), tổng kết kết quả
  const finishSession = useCallback(() => {
    if (isFinished) return;
    if (currentLineIndexRef.current !== -1) {
      evaluateLine(currentLineIndexRef.current);
    }

    const maxScore = Math.max(1000, lineMelodies.length * 1000);
    const rank = calculateRank(totalScore, maxScore);

    const summary: KaraokeScoreSummary = {
      songId: songId || '',
      totalScore,
      rank,
      perfectCount,
      goodCount,
      missCount,
      maxCombo,
      completedAt: new Date(),
    };

    setIsFinished(true);
    if (onFinish) onFinish(summary);
  }, [
    isFinished,
    lineMelodies.length,
    totalScore,
    songId,
    perfectCount,
    goodCount,
    missCount,
    maxCombo,
    evaluateLine,
    onFinish,
  ]);

  // Tự động finish khi bài hát phát xong
  useEffect(() => {
    if (
      isMicOn &&
      duration > 0 &&
      currentTime >= duration - 1.5 &&
      !isFinished &&
      totalScore > 0
    ) {
      finishSession();
    }
  }, [isMicOn, currentTime, duration, isFinished, totalScore, finishSession]);

  // Dọn dẹp tài nguyên khi unmount
  useEffect(() => {
    return () => {
      stopMic();
    };
  }, [stopMic]);

  const maxPossibleScore = Math.max(1000, lineMelodies.length * 1000);
  const currentRank = calculateRank(totalScore, maxPossibleScore);

  return {
    isMicOn,
    micError,
    startMic,
    stopMic,
    resetScore,
    livePitch,
    currentNote,
    lastVerdict,
    totalScore,
    combo,
    maxCombo,
    perfectCount,
    goodCount,
    missCount,
    currentRank,
    isFinished,
    finishSession,
    lineMelodies,
    isBeatOnly,
    toggleBeatMode,
    isVoicePacing,
    toggleVoicePacing,
    voiceProgress,
    voiceProgressRef,
    sungWordIndex,
  };
};
