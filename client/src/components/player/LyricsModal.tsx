import React, { useEffect, useRef, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Music2, Play, Pause, Minus, Plus, Loader2, Search, Sparkles, Languages, Mic, Trophy, Flag } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { usePlayerStore, useCurrentSong, useIsPlaying } from '../../store/playerStore.js';
import { useQuizMask, useJamStore } from '../../store/jamStore.js';
import { parseSyncedLyrics, toShiftedLrc, mergeTranslatedLyrics } from '../../utils/lyrics.js';
import { songService } from '../../services/song.service.js';
import { QUERY_KEYS, queryClient } from '../../services/queryClient.js';
import { adminService } from '../../services/admin.service.js';
import { useAuthStore } from '../../store/authStore.js';
import { Lyrics, LyricExplanation, SyncedLyricLine } from '../../types/index.js';
import { formatDuration } from '../../utils/format.js';
import { KaraokePitchVisualizer } from '../karaoke/KaraokePitchVisualizer.js';
import { KaraokeResultModal } from '../karaoke/KaraokeResultModal.js';
import { useKaraokeScorer, KaraokeScoreSummary } from '../../hooks/useKaraokeScorer.js';

// A line with no successor (or a long instrumental gap) is considered sung for at most this long.
const MAX_LINE_SECONDS = 6;
// Gaps longer than this show the "instrumental" dots instead of keeping the last line lit.
const BREAK_SECONDS = 5;

// The store's currentTime only ticks ~4 times per second; interpolate between ticks so the
// karaoke fill sweeps smoothly instead of jumping. Runs every frame without re-rendering:
// the caller writes to the DOM directly and only sets state when something visible changes.
const useSmoothClock = (onFrame: (time: number) => void) => {
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;
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
      onFrameRef.current(base + elapsed * (playbackRate || 1));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      unsubscribe();
    };
  }, []);
};

const KaraokeBody: React.FC = () => {
  const currentSong = useCurrentSong()!;
  const isPlaying = useIsPlaying();
  const duration = usePlayerStore((s) => s.duration);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const seek = usePlayerStore((s) => s.seek);
  const currentTime = usePlayerStore((s) => s.currentTime);

  // Songs played from lists don't carry lyrics; fetch the detail record when needed.
  const { data: detail, isLoading } = useQuery({
    queryKey: QUERY_KEYS.songDetail(currentSong.id),
    queryFn: () => songService.getSongById(currentSong.id),
    enabled: currentSong.lyrics === undefined,
    staleTime: 1000 * 60 * 5,
  });
  const [foundLyrics, setFoundLyrics] = useState<Lyrics | null>(null);
  const lyrics = foundLyrics || (currentSong.lyrics ?? detail?.lyrics);
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  const [searching, setSearching] = useState(false);
  const [searchNote, setSearchNote] = useState('');
  const autoFindLyrics = async () => {
    setSearching(true);
    setSearchNote('');
    try {
      const saved = await adminService.autoLyrics(currentSong.id);
      setFoundLyrics(saved);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.songDetail(currentSong.id) });
    } catch (err: any) {
      setSearchNote(err.response?.data?.message || 'Không tìm được lời bài hát.');
    } finally {
      setSearching(false);
    }
  };

  const [offset, setOffset] = useState(0);
  // Tap-to-sync: the next tapped line is taken as "being sung right now" and the offset is set from it.
  const [syncMode, setSyncMode] = useState(false);
  // Chế độ "Lời sai chữ": bấm vào một câu để báo sai
  const [wrongTextMode, setWrongTextMode] = useState(false);
  const [reportedWrongIndices, setReportedWrongIndices] = useState<number[]>([]);
  const [savingOffset, setSavingOffset] = useState(false);
  const [offsetNote, setOffsetNote] = useState('');
  const [listeningWithOffsetSec, setListeningWithOffsetSec] = useState(0);
  const lastSubmittedOffsetRef = useRef<number>(0);

  // Parallel translation state
  const [showTranslation, setShowTranslation] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState('');
  const [translatedCache, setTranslatedCache] = useState<SyncedLyricLine[] | null>(null);

  // AI Storytelling state
  const [selectedStoryLine, setSelectedStoryLine] = useState<string | null>(null);
  const [storyData, setStoryData] = useState<LyricExplanation | null>(null);
  const [isLoadingStory, setIsLoadingStory] = useState(false);
  const [storyError, setStoryError] = useState('');

  useEffect(() => {
    setOffset(0);
    setSyncMode(false);
    setWrongTextMode(false);
    setReportedWrongIndices([]);
    setOffsetNote('');
    setListeningWithOffsetSec(0);
    lastSubmittedOffsetRef.current = 0;
    setTranslatedCache(null);
    setTranslationError('');
    setSelectedStoryLine(null);
    setStoryData(null);
  }, [currentSong.id]);

  const baseLines = useMemo(() => parseSyncedLyrics(lyrics?.syncedLyrics), [lyrics?.syncedLyrics]);
  const lines = useMemo(() => {
    const rawTrans = translatedCache || lyrics?.translatedLyrics;
    return mergeTranslatedLyrics(baseLines, rawTrans);
  }, [baseLines, lyrics?.translatedLyrics, translatedCache]);

  const jamCode = useJamStore((s) => s.code);
  const [isKaraokeMode, setIsKaraokeMode] = useState(true);
  const [showResultModal, setShowResultModal] = useState(false);
  const [resultSummary, setResultSummary] = useState<KaraokeScoreSummary | null>(null);

  const time = currentTime + offset;

  const scorer = useKaraokeScorer({
    songId: currentSong.id,
    lines,
    currentTime: time,
    isPlaying,
    duration,
    onFinish: (summary) => {
      setResultSummary(summary);
      setShowResultModal(true);
      if (jamCode) {
        useJamStore.getState().submitKaraokeScore({
          songId: currentSong.id,
          totalScore: summary.totalScore,
          rank: summary.rank,
          perfectCount: summary.perfectCount,
          goodCount: summary.goodCount,
          missCount: summary.missCount,
          maxCombo: summary.maxCombo,
          isLive: false,
        });
      }
    },
  });

  // Tự động bật chế độ Chỉ cần Beat (tách giọng ca sĩ) khi mở màn hình Karaoke
  useEffect(() => {
    if (isKaraokeMode) {
      scorer.toggleBeatMode(true);
    } else {
      scorer.toggleBeatMode(false);
    }
    return () => {
      scorer.toggleBeatMode(false);
    };
  }, [isKaraokeMode, currentSong.id]);

  // Tự động đồng bộ điểm số realtime lên phòng Jam khi đang hát
  useEffect(() => {
    if (jamCode && scorer.totalScore > 0 && scorer.isMicOn) {
      useJamStore.getState().submitKaraokeScore({
        songId: currentSong.id,
        totalScore: scorer.totalScore,
        rank: scorer.currentRank,
        perfectCount: scorer.perfectCount,
        goodCount: scorer.goodCount,
        missCount: scorer.missCount,
        maxCombo: scorer.maxCombo,
        isLive: true,
      });
    }
  }, [scorer.totalScore, jamCode, currentSong.id]);
  const lineEnd = (i: number) => Math.min(lines[i + 1]?.time ?? Infinity, lines[i].time + MAX_LINE_SECONDS);

  // Only the line index, break state and dot count re-render; the fill sweep is written straight to the DOM.
  const [{ activeIndex, inBreak, breakDots }, setView] = useState({ activeIndex: -1, inBreak: false, breakDots: 0 });
  const smoothTimeRef = useRef(usePlayerStore.getState().currentTime);
  const fillRef = useRef<HTMLDivElement | null>(null);
  useSmoothClock((smoothTime) => {
    smoothTimeRef.current = smoothTime;
    const time = smoothTime + offset;
    let index = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (time >= lines[i].time) {
        index = i;
        break;
      }
    }
    const nextTime = lines[index + 1]?.time ?? (index === -1 ? lines[0]?.time : undefined);
    const breakStart = index === -1 ? 0 : lineEnd(index);
    const isBreak =
      lines.length > 0 &&
      nextTime !== undefined &&
      (index === -1 || time >= breakStart) &&
      nextTime - breakStart >= BREAK_SECONDS;
    const dots = isBreak && nextTime !== undefined ? Math.min(3, Math.ceil(((time - breakStart) / (nextTime - breakStart)) * 3)) : 0;
    setView((v) =>
      v.activeIndex === index && v.inBreak === isBreak && v.breakDots === dots
        ? v
        : { activeIndex: index, inBreak: isBreak, breakDots: dots }
    );
    if (index >= 0 && !isBreak && fillRef.current) {
      const progress =
        scorer.isMicOn && scorer.isVoicePacing
          ? scorer.voiceProgressRef.current
          : Math.min(1, Math.max(0, (time - lines[index].time) / Math.max(0.5, lineEnd(index) - lines[index].time)));
      fillRef.current.style.setProperty('--p', `${(progress * 100).toFixed(2)}%`);
    }
  });

  // Auto-scroll keeps the active line centred, but yields to the user for a few seconds after they scroll.
  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const userScrollUntil = useRef(0);
  useEffect(() => {
    if (Date.now() < userScrollUntil.current) return;
    activeLineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeIndex]);
  const onUserScroll = () => {
    userScrollUntil.current = Date.now() + 4000;
  };

  // Ghi nhận độ lệch người nghe chọn lên server (tự động cân khi có >= 3 người chỉnh giống nhau)
  const submitListenerOffset = async (chosenOffset: number) => {
    if (!currentSong?.id || Math.abs(chosenOffset) < 0.25) return;
    lastSubmittedOffsetRef.current = chosenOffset;
    try {
      const res = await songService.reportLyricOffset(currentSong.id, chosenOffset);
      if (res.data?.autoApplied && res.data.lyrics?.syncedLyrics) {
        setFoundLyrics(res.data.lyrics);
        setOffset(0);
        lastSubmittedOffsetRef.current = 0;
        setListeningWithOffsetSec(0);
        setOffsetNote(
          res.message ||
            `Đã có ≥3 người chỉnh giống bạn! Server đã tự áp độ lệch trung bình (${
              (res.data.appliedOffset || 0) > 0 ? '+' : ''
            }${res.data.appliedOffset}s) cho mọi người nghe sau.`
        );
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.songDetail(currentSong.id) });
      } else {
        const sign = chosenOffset > 0 ? '+' : '';
        setOffsetNote(
          `Đã ghi nhận độ lệch ${sign}${chosenOffset.toFixed(2)}s của bạn (${
            res.data?.pendingVotesCount || 1
          }/3 người đồng thuận để tự cân cho tất cả).`
        );
      }
    } catch (err: any) {
      console.warn('Không gửi được báo cáo độ lệch:', err);
    }
  };

  // Khi người nghe chỉnh độ lệch rồi nghe tiếp khoảng 20 giây -> tự động ghi nhận độ lệch lên server
  useEffect(() => {
    if (Math.abs(offset) < 0.25 || offset === lastSubmittedOffsetRef.current) {
      setListeningWithOffsetSec(0);
      return;
    }
    if (!isPlaying) return;

    const timer = setInterval(() => {
      setListeningWithOffsetSec((prev) => {
        const next = prev + 1;
        if (next >= 20) {
          clearInterval(timer);
          submitListenerOffset(offset);
          return 20;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [offset, isPlaying, currentSong.id]);

  // Báo "Lời sai chữ" cho một câu hát cụ thể
  const handleReportWrongLine = async (lineIdx: number, lineText: string) => {
    if (!currentSong?.id || !lineText.trim()) return;
    setWrongTextMode(false);
    setReportedWrongIndices((prev) => (prev.includes(lineIdx) ? prev : [...prev, lineIdx]));
    try {
      await songService.reportWrongLyric(currentSong.id, lineIdx, lineText);
      setOffsetNote(`Đã báo "Lời sai chữ" câu #${lineIdx + 1}. Bài hát đã vào danh sách cần sửa lời của Admin!`);
    } catch (err: any) {
      setOffsetNote(err.response?.data?.message || 'Không gửi được báo cáo lời sai chữ.');
    }
  };

  const onLineClick = (lineTime: number, lineIdx?: number, lineText?: string) => {
    if (wrongTextMode && typeof lineIdx === 'number' && lineText) {
      handleReportWrongLine(lineIdx, lineText);
    } else if (syncMode) {
      setOffset(Math.round((lineTime - smoothTimeRef.current) * 4) / 4);
      setSyncMode(false);
      setOffsetNote('');
    } else {
      seek(Math.max(0, lineTime - offset));
    }
  };

  // Toggle "Dịch song song"
  const toggleTranslation = async () => {
    if (!showTranslation) {
      setShowTranslation(true);
      setTranslationError('');
      const hasTranslation = lines.some((l) => Boolean(l.translation));
      if (!hasTranslation && currentSong?.id) {
        setIsTranslating(true);
        try {
          const res = await songService.translateLyrics(currentSong.id);
          if (res?.translatedLyrics) {
            setTranslatedCache(res.translatedLyrics);
          }
        } catch (err: any) {
          setTranslationError(err.response?.data?.message || 'Không thể dịch lời bài hát.');
        } finally {
          setIsTranslating(false);
        }
      }
    } else {
      setShowTranslation(false);
    }
  };

  // Handle opening AI Storytelling for a line
  const handleOpenStory = async (lineText: string) => {
    setSelectedStoryLine(lineText);
    setStoryData(null);
    setStoryError('');
    setIsLoadingStory(true);
    try {
      const res = await songService.explainLyric(currentSong.id, lineText);
      setStoryData(res);
    } catch (err: any) {
      setStoryError(err.response?.data?.message || 'Không thể giải mã câu hát.');
    } finally {
      setIsLoadingStory(false);
    }
  };

  // Admin: bake the offset into the stored timestamps so every listener gets the corrected timing.
  const saveOffset = async () => {
    setSavingOffset(true);
    try {
      const syncedLyrics = toShiftedLrc(lines, -offset);
      const form = new FormData();
      form.append('syncedLyrics', syncedLyrics);
      await adminService.updateSong(currentSong.id, form);
      setFoundLyrics({ ...(lyrics as Lyrics), syncedLyrics, isSynced: true });
      setOffset(0);
      setOffsetNote('Đã lưu, mọi người sẽ thấy lời khớp nhạc.');
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.songDetail(currentSong.id) });
    } catch (err: any) {
      setOffsetNote(err.response?.data?.message || 'Không lưu được.');
    } finally {
      setSavingOffset(false);
    }
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
      {/* Top action bar: Dịch song song & AI prompt */}
      {lines.length > 0 && (
        <div className="relative z-20 flex items-center justify-between px-6 py-2 max-w-3xl w-full mx-auto flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTranslation}
              disabled={isTranslating}
              aria-pressed={showTranslation}
              className={`px-3 py-1.5 rounded-full border text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 active:scale-95 ${
                showTranslation
                  ? 'bg-amber-300 text-black border-amber-300 font-bold shadow-md'
                  : 'border-white/15 text-white/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              {isTranslating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-current" />
              ) : (
                <Languages className="w-3.5 h-3.5" />
              )}
              <span>{isTranslating ? 'Đang dịch lời…' : 'Dịch song song'}</span>
            </button>
            {translationError && (
              <span className="text-[11px] text-red-300 truncate max-w-[200px]">{translationError}</span>
            )}
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-white/60">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Bấm ✨ để Gemini kể chuyện & giải thích câu hát</span>
          </div>
        </div>
      )}

      {/* Karaoke Pitch Visualizer HUD */}
      {isKaraokeMode && lines.length > 0 && (
        <div className="w-full px-6 max-w-3xl mx-auto pt-1 flex-shrink-0 z-20">
          <KaraokePitchVisualizer
            isMicOn={scorer.isMicOn}
            onToggleMic={scorer.isMicOn ? scorer.stopMic : scorer.startMic}
            livePitch={scorer.livePitch}
            currentNote={scorer.currentNote}
            lastVerdict={scorer.lastVerdict}
            totalScore={scorer.totalScore}
            combo={scorer.combo}
            currentRank={scorer.currentRank}
            activeLineMelody={activeIndex !== -1 ? scorer.lineMelodies[activeIndex] : null}
            currentTime={time}
            isBeatOnly={scorer.isBeatOnly}
            onToggleBeatMode={() => scorer.toggleBeatMode()}
            isVoicePacing={scorer.isVoicePacing}
            onToggleVoicePacing={scorer.toggleVoicePacing}
            sungWordIndex={scorer.sungWordIndex}
          />
          {scorer.micError && (
            <p className="text-xs text-rose-400 text-center -mt-2 mb-2 bg-rose-500/10 border border-rose-500/20 rounded-xl p-2">
              {scorer.micError}
            </p>
          )}
        </div>
      )}

      {/* Main lyrics scroll area */}
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
            {isAdmin && (
              <div className="pt-2 space-y-2">
                <button
                  onClick={autoFindLyrics}
                  disabled={searching}
                  className="inline-flex items-center gap-2 rounded-full bg-white text-black px-4 py-2 text-xs font-bold disabled:opacity-60 active:scale-95 transition-transform"
                >
                  {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  {searching ? 'Đang tìm lời…' : 'Tìm lời tự động'}
                </button>
                {searchNote && <p className="text-xs text-amber-200">{searchNote}</p>}
              </div>
            )}
          </div>
        ) : lines.length > 0 ? (
          <div className="max-w-3xl w-full space-y-6 md:space-y-8 text-left py-[35vh]">
            {lines.map((line, idx) => {
              const isActive = idx === activeIndex && !inBreak;
              const isPassed = idx < activeIndex || (idx === activeIndex && inBreak);
              return (
                <React.Fragment key={idx}>
                  {inBreak && idx === activeIndex + 1 && (
                    <div ref={activeLineRef} className="flex items-center gap-3 py-2" aria-label="Đoạn nhạc dạo">
                      {[0, 1, 2].map((d) => (
                        <span
                          key={d}
                          className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-white transition-opacity duration-300 animate-pulse"
                          style={{ opacity: breakDots > d ? 1 : 0.2 }}
                        />
                      ))}
                    </div>
                  )}
                  <div
                    ref={
                      isActive
                        ? (el) => {
                            activeLineRef.current = el;
                            fillRef.current = el;
                          }
                        : null
                    }
                    className="group relative flex items-start justify-between gap-3"
                  >
                    <div
                      onClick={() => onLineClick(line.time, idx, line.text)}
                      className={`cursor-pointer origin-left font-extrabold leading-snug tracking-tight transition-[opacity,transform] duration-300 ease-out will-change-transform text-2xl md:text-4xl flex-1 ${
                        wrongTextMode
                          ? 'hover:outline hover:outline-2 hover:outline-rose-400/80 rounded-lg px-1 '
                          : syncMode
                          ? 'hover:outline hover:outline-2 hover:outline-amber-300/70 rounded-lg px-1 '
                          : ''
                      }${
                        isActive ? 'scale-100' : isPassed ? 'scale-95 opacity-60 hover:opacity-90' : 'scale-95 opacity-40 hover:opacity-80'
                      }`}
                      style={
                        isActive && scorer.isMicOn && scorer.isVoicePacing
                          ? undefined
                          : ({
                              // Active line: --p is driven per frame by useSmoothClock.
                              ...(isActive ? {} : { '--p': isPassed ? '100%' : '0%' }),
                              backgroundImage: 'linear-gradient(90deg, #ffffff var(--p, 0%), rgba(255,255,255,0.35) var(--p, 0%))',
                              WebkitBackgroundClip: 'text',
                              backgroundClip: 'text',
                              color: 'transparent',
                            } as React.CSSProperties)
                      }
                    >
                      {isActive && scorer.isMicOn && scorer.isVoicePacing ? (
                        <div className="flex flex-wrap gap-x-2.5 gap-y-1">
                          {line.text
                            .split(/\s+/)
                            .filter(Boolean)
                            .map((word, wIdx, arr) => {
                              const totalW = Math.max(1, arr.length);
                              const wordStart = wIdx / totalW;
                              const wordEnd = (wIdx + 1) / totalW;
                              const vp = scorer.voiceProgress;
                              const wordFill =
                                vp >= wordEnd
                                  ? 100
                                  : vp <= wordStart
                                  ? 0
                                  : ((vp - wordStart) / (wordEnd - wordStart)) * 100;
                              const isCurrentWord =
                                vp >= wordStart && vp < wordEnd && Boolean(scorer.livePitch?.isVoiced);
                              return (
                                <span
                                  key={wIdx}
                                  className={`inline-block transition-transform duration-100 ${
                                    isCurrentWord
                                      ? 'scale-105 drop-shadow-[0_0_12px_rgba(52,211,153,0.85)]'
                                      : ''
                                  }`}
                                  style={{
                                    backgroundImage: `linear-gradient(90deg, #34d399 ${wordFill.toFixed(
                                      1
                                    )}%, rgba(255,255,255,0.32) ${wordFill.toFixed(1)}%)`,
                                    WebkitBackgroundClip: 'text',
                                    backgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    color: 'transparent',
                                  }}
                                >
                                  {word}
                                </span>
                              );
                            })}
                        </div>
                      ) : (
                        <div>{line.text}</div>
                      )}
                      {reportedWrongIndices.includes(idx) && (
                        <span
                          className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-400/30"
                          style={{ WebkitTextFillColor: '#fda4af', color: '#fda4af' }}
                        >
                          <Flag className="w-3 h-3" /> Đã báo lời sai chữ
                        </span>
                      )}
                      {/* Parallel translated Vietnamese line */}
                      {showTranslation && (
                        <div
                          className={`mt-1.5 font-medium tracking-normal transition-opacity duration-300 text-sm md:text-xl ${
                            isActive
                              ? 'text-amber-200 font-semibold opacity-100'
                              : isPassed
                              ? 'text-white/60 opacity-90'
                              : 'text-white/40 opacity-70'
                          }`}
                          style={{
                            WebkitTextFillColor: isActive ? '#fde68a' : 'rgba(255, 255, 255, 0.7)',
                            color: isActive ? '#fde68a' : 'rgba(255, 255, 255, 0.7)',
                          }}
                        >
                          {line.translation || (isTranslating ? 'Đang dịch…' : '')}
                        </div>
                      )}
                    </div>

                    {/* Action Buttons for this line: Báo lời sai chữ & AI Storytelling */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReportWrongLine(idx, line.text);
                        }}
                        title="Báo câu này bị sai chữ"
                        aria-label="Báo lời sai chữ câu này"
                        className={`p-2 rounded-xl transition-all duration-200 active:scale-90 flex items-center gap-1 ${
                          reportedWrongIndices.includes(idx)
                            ? 'opacity-100 bg-rose-500/20 text-rose-300 border border-rose-400/40'
                            : 'opacity-0 group-hover:opacity-100 bg-white/5 hover:bg-rose-500/20 text-white/60 hover:text-rose-200 border border-white/10'
                        }`}
                      >
                        <Flag className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenStory(line.text);
                        }}
                        title="Gemini kể chuyện & giải thích ý nghĩa câu hát"
                        aria-label="Kể chuyện câu hát này"
                        className={`p-2 rounded-xl transition-all duration-200 active:scale-90 flex items-center gap-1.5 ${
                          isActive
                            ? 'opacity-100 bg-amber-400/20 text-amber-300 border border-amber-300/40 shadow-sm'
                            : 'opacity-0 group-hover:opacity-100 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10'
                        }`}
                      >
                        <Sparkles className="w-4 h-4 text-amber-300" />
                        <span className="hidden sm:inline text-xs font-semibold text-amber-200/90">Ý nghĩa</span>
                      </button>
                    </div>
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
          <span className="w-10 text-right">{formatDuration(Math.floor(currentTime))}</span>
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.5}
            value={Math.min(currentTime, duration || 1)}
            onChange={(e) => seek(parseFloat(e.target.value))}
            aria-label="Tua bài hát"
            className="flex-1 h-1 accent-white cursor-pointer"
          />
          <span className="w-10">{formatDuration(duration)}</span>
        </div>
        {lines.length > 0 && (syncMode || wrongTextMode || offsetNote || offset !== 0) && (
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
            {syncMode && <span className="text-amber-200">Chạm vào dòng mà ca sĩ đang hát ngay lúc này…</span>}
            {wrongTextMode && <span className="text-rose-300 font-semibold">Chạm vào câu hát bị sai chữ để báo cho hệ thống…</span>}
            {!syncMode && !wrongTextMode && Math.abs(offset) >= 0.25 && offset !== lastSubmittedOffsetRef.current && (
              <div className="flex items-center gap-2">
                <span className="text-cyan-200">
                  Độ lệch {offset > 0 ? '+' : ''}
                  {offset.toFixed(2)}s (tự ghi nhận sau {Math.max(0, 20 - listeningWithOffsetSec)}s nghe)
                </span>
                <button
                  onClick={() => submitListenerOffset(offset)}
                  className="rounded-full bg-cyan-400/20 hover:bg-cyan-400/30 border border-cyan-400/40 text-cyan-200 px-2.5 py-0.5 font-semibold transition-colors"
                >
                  Gửi báo lệch ngay
                </button>
              </div>
            )}
            {!syncMode && !wrongTextMode && isAdmin && offset !== 0 && (
              <button
                onClick={saveOffset}
                disabled={savingOffset}
                className="rounded-full bg-amber-300 text-black px-3 py-1 font-bold disabled:opacity-60"
              >
                {savingOffset ? 'Đang lưu…' : 'Lưu độ lệch cho mọi người'}
              </button>
            )}
            {offsetNote && <span className="text-emerald-300 text-center">{offsetNote}</span>}
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          {lines.length > 0 ? (
            <div className="flex flex-wrap items-center gap-0.5 text-xs text-text-muted" title="Chỉnh lời nhanh/chậm hơn nhạc">
              <button onClick={() => setOffset((o) => o - 1)} aria-label="Lời chậm lại 1 giây" className="px-1.5 py-2 rounded-full hover:bg-white/10 hover:text-white font-mono">
                -1s
              </button>
              <button onClick={() => setOffset((o) => o - 0.25)} aria-label="Lời chậm lại" className="p-2 rounded-full hover:bg-white/10 hover:text-white">
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-16 text-center font-mono">
                {offset === 0 ? 'Đồng bộ' : `${offset > 0 ? '+' : ''}${offset.toFixed(2)}s`}
              </span>
              <button onClick={() => setOffset((o) => o + 0.25)} aria-label="Lời nhanh hơn" className="p-2 rounded-full hover:bg-white/10 hover:text-white">
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setOffset((o) => o + 1)} aria-label="Lời nhanh hơn 1 giây" className="px-1.5 py-2 rounded-full hover:bg-white/10 hover:text-white font-mono">
                +1s
              </button>
              <button
                onClick={() => {
                  setSyncMode((v) => !v);
                  setWrongTextMode(false);
                }}
                aria-pressed={syncMode}
                className={`ml-1 px-2.5 py-1 rounded-full border text-[11px] font-semibold ${
                  syncMode ? 'bg-amber-300 text-black border-amber-300' : 'border-white/15 text-white/80 hover:bg-white/10'
                }`}
              >
                Canh lời
              </button>
              <button
                onClick={() => {
                  setWrongTextMode((v) => !v);
                  setSyncMode(false);
                }}
                aria-pressed={wrongTextMode}
                title="Bấm vào đây rồi chạm vào câu hát bị sai chữ để báo lỗi"
                className={`ml-1 px-2.5 py-1 rounded-full border text-[11px] font-semibold flex items-center gap-1 ${
                  wrongTextMode
                    ? 'bg-rose-500 text-white border-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.4)]'
                    : 'border-white/15 text-white/80 hover:bg-white/10'
                }`}
              >
                <Flag className="w-3 h-3" />
                <span>Lời sai chữ</span>
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
          <div className="flex items-center justify-end gap-2 min-w-[120px]">
            {lines.length > 0 && (
              <button
                onClick={() => setIsKaraokeMode((v) => !v)}
                aria-label={isKaraokeMode ? 'Tắt chấm điểm' : 'Bật chấm điểm'}
                className={`px-3 py-1.5 rounded-full border text-xs font-bold transition-all flex items-center gap-1.5 ${
                  isKaraokeMode
                    ? 'bg-emerald-400 text-black border-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.4)]'
                    : 'border-white/20 text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
                <span>{isKaraokeMode ? 'Karaoke Bật' : 'Hát Karaoke'}</span>
              </button>
            )}

            {isKaraokeMode && scorer.totalScore > 0 && (
              <button
                onClick={() => {
                  scorer.finishSession();
                  setShowResultModal(true);
                }}
                title="Xem kết quả điểm"
                className="p-2 rounded-full bg-amber-400/20 border border-amber-300/40 text-amber-300 hover:bg-amber-400/30 transition-colors"
              >
                <Trophy className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <KaraokeResultModal
        isOpen={showResultModal}
        onClose={() => setShowResultModal(false)}
        summary={
          resultSummary || {
            songId: currentSong.id,
            totalScore: scorer.totalScore,
            rank: scorer.currentRank,
            perfectCount: scorer.perfectCount,
            goodCount: scorer.goodCount,
            missCount: scorer.missCount,
            maxCombo: scorer.maxCombo,
            completedAt: new Date(),
          }
        }
        onRestart={() => {
          scorer.resetScore();
          seek(0);
          setShowResultModal(false);
        }}
        onShareToJam={
          jamCode
            ? () => {
                useJamStore.getState().submitKaraokeScore({
                  songId: currentSong.id,
                  totalScore: scorer.totalScore,
                  rank: scorer.currentRank,
                  perfectCount: scorer.perfectCount,
                  goodCount: scorer.goodCount,
                  missCount: scorer.missCount,
                  maxCombo: scorer.maxCombo,
                  isLive: false,
                });
                setShowResultModal(false);
              }
            : undefined
        }
        isInJam={!!jamCode}
      />

      {/* AI Storytelling Modal / Bottom Sheet */}
      <AnimatePresence>
        {selectedStoryLine && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setSelectedStoryLine(null)}
          >
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 26, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-xl bg-[#12131d] border border-white/15 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-white/10 bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-400 to-purple-500 flex items-center justify-center text-black shadow-md">
                    <Sparkles className="w-5 h-5 fill-current" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base flex items-center gap-2">
                      Kể chuyện câu hát
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        Gemini AI
                      </span>
                    </h3>
                    <p className="text-xs text-text-muted truncate max-w-[280px]">
                      {currentSong.title} • {currentSong.artist?.name}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedStoryLine(null)}
                  className="p-2 rounded-full hover:bg-white/10 text-text-muted hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Selected Lyric Box */}
              <div className="p-5 pb-2">
                <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 border-l-4 border-l-amber-400">
                  <p className="text-[11px] uppercase font-bold tracking-wider text-amber-300 mb-1">
                    Câu hát đang nghe
                  </p>
                  <p className="text-lg md:text-xl font-bold text-white italic leading-snug">
                    “{selectedStoryLine}”
                  </p>
                </div>
              </div>

              {/* Story Content Area */}
              <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-3.5">
                {isLoadingStory ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                    <div className="relative">
                      <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
                      <Sparkles className="w-4 h-4 text-purple-400 absolute -top-1 -right-1 animate-pulse" />
                    </div>
                    <p className="text-sm font-semibold text-white/90">
                      Gemini đang giải mã ý nghĩa & cảm xúc câu hát…
                    </p>
                    <p className="text-xs text-text-muted">
                      Đang phân tích ca từ trong toàn bộ bối cảnh bài hát
                    </p>
                  </div>
                ) : storyError ? (
                  <div className="py-8 text-center space-y-3">
                    <p className="text-sm text-red-300">{storyError}</p>
                    <button
                      onClick={() => handleOpenStory(selectedStoryLine)}
                      className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-xs font-semibold text-white"
                    >
                      Thử lại
                    </button>
                  </div>
                ) : storyData ? (
                  <div className="space-y-3.5 pt-1">
                    {/* Meaning */}
                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1.5">
                      <div className="flex items-center gap-2 text-amber-300 font-semibold text-sm">
                        <span>💡</span>
                        <h4>Ý nghĩa ca từ</h4>
                      </div>
                      <p className="text-sm text-white/85 leading-relaxed whitespace-pre-line">
                        {storyData.meaning}
                      </p>
                    </div>

                    {/* Context */}
                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1.5">
                      <div className="flex items-center gap-2 text-sky-300 font-semibold text-sm">
                        <span>📖</span>
                        <h4>Bối cảnh bài hát</h4>
                      </div>
                      <p className="text-sm text-white/85 leading-relaxed whitespace-pre-line">
                        {storyData.context}
                      </p>
                    </div>

                    {/* Emotion */}
                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1.5">
                      <div className="flex items-center gap-2 text-rose-300 font-semibold text-sm">
                        <span>🎭</span>
                        <h4>Cảm xúc & Thông điệp</h4>
                      </div>
                      <p className="text-sm text-white/85 leading-relaxed whitespace-pre-line">
                        {storyData.emotion}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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
      {/* Background: the cover art, heavily blurred. Kept static: animating a 90px blur
          over the whole screen re-filters every frame and starves the lyrics animation. */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <img
          src={currentSong.coverUrl}
          alt=""
          className="absolute w-[160%] h-[160%] -left-[30%] -top-[30%] object-cover blur-[90px] opacity-60 saturate-150"
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
