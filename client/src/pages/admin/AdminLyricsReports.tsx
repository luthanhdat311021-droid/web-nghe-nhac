import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sparkles,
  Flag,
  Clock,
  CheckCircle2,
  Play,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Music2,
  Wand2,
} from 'lucide-react';
import { adminService } from '../../services/admin.service.js';
import { usePlayerStore } from '../../store/playerStore.js';
import { formatDuration } from '../../utils/format.js';
import { getMediaUrl } from '../../utils/media.js';
import { QUERY_KEYS } from '../../services/queryClient.js';

export const AdminLyricsReports: React.FC = () => {
  const queryClient = useQueryClient();
  const playSong = usePlayerStore((s) => s.playSong);
  const isLyricsOpen = usePlayerStore((s) => s.isLyricsOpen);
  const toggleLyrics = usePlayerStore((s) => s.toggleLyrics);

  const [activeAiSongId, setActiveAiSongId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['admin', 'lyrics-reports'],
    queryFn: () => adminService.getLyricsReports(),
  });

  const reanalyzeMutation = useMutation({
    mutationFn: async (songId: string) => {
      setActiveAiSongId(songId);
      setActionMessage(null);
      return adminService.reanalyzeSongLyrics(songId);
    },
    onSuccess: (res, songId) => {
      setActiveAiSongId(null);
      setActionMessage({
        type: 'success',
        text: res.message || 'Đã chạy lại AI phân tích lời thành công!',
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'lyrics-reports'] });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.songDetail(songId) });
    },
    onError: (err: any) => {
      setActiveAiSongId(null);
      setActionMessage({
        type: 'error',
        text: err.response?.data?.message || err.message || 'Không thể chạy lại AI phân tích lời.',
      });
    },
  });

  const applyOffsetMutation = useMutation({
    mutationFn: async ({ songId, offsetSec }: { songId: string; offsetSec: number }) => {
      setActionMessage(null);
      return adminService.applyReportedOffset(songId, offsetSec);
    },
    onSuccess: (res, vars) => {
      setActionMessage({
        type: 'success',
        text: res.message || 'Đã áp dụng độ lệch trung bình cho bài hát!',
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'lyrics-reports'] });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.songDetail(vars.songId) });
    },
    onError: (err: any) => {
      setActionMessage({
        type: 'error',
        text: err.response?.data?.message || 'Không thể áp dụng độ lệch.',
      });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async (songId: string) => {
      setActionMessage(null);
      return adminService.resolveLyricsReports(songId);
    },
    onSuccess: (res) => {
      setActionMessage({
        type: 'success',
        text: res.message || 'Đã đánh dấu xử lý xong bài hát.',
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'lyrics-reports'] });
    },
  });

  const handlePreviewSong = (song: any) => {
    playSong(song);
    if (!isLyricsOpen) {
      toggleLyrics();
    }
  };

  const summary = data?.summary || {
    songsNeedFixCount: 0,
    pendingOffsetCount: 0,
    pendingWrongTextCount: 0,
    autoAppliedCount: 0,
  };
  const items = data?.items || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Flag className="w-7 h-7 text-amber-400" />
            <span>Bài cần sửa lời</span>
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary mt-1">
            Tổng hợp lượt báo lời lệch nhịp & lời sai chữ từ người nghe. Khi có ≥ 3 người chỉnh độ lệch gần giống nhau, hệ thống tự động cân chỉnh cho mọi người nghe sau.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isRefetching}
          className="self-start sm:self-auto px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white flex items-center gap-2 transition-all active:scale-95"
        >
          <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin text-amber-400' : ''}`} />
          <span>Làm mới</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl bg-background-surface/70 border border-white/10 p-4 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-400/15 border border-amber-400/30 text-amber-300 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-text-muted font-semibold">Bài chờ sửa lời</p>
            <p className="text-2xl font-black text-white">{summary.songsNeedFixCount}</p>
          </div>
        </div>

        <div className="rounded-2xl bg-background-surface/70 border border-white/10 p-4 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-cyan-400/15 border border-cyan-400/30 text-cyan-300 flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-text-muted font-semibold">Báo lệch nhịp</p>
            <p className="text-2xl font-black text-white">{summary.pendingOffsetCount}</p>
          </div>
        </div>

        <div className="rounded-2xl bg-background-surface/70 border border-white/10 p-4 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 flex items-center justify-center flex-shrink-0">
            <Flag className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-text-muted font-semibold">Báo lời sai chữ</p>
            <p className="text-2xl font-black text-white">{summary.pendingWrongTextCount}</p>
          </div>
        </div>

        <div className="rounded-2xl bg-background-surface/70 border border-white/10 p-4 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-400/15 border border-emerald-400/30 text-emerald-300 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-text-muted font-semibold">Đã tự cân (≥3 người)</p>
            <p className="text-2xl font-black text-white">{summary.autoAppliedCount}</p>
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {actionMessage && (
        <div
          className={`rounded-2xl p-4 border text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 ${
            actionMessage.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-200'
              : 'bg-rose-500/15 border-rose-400/30 text-rose-200'
          }`}
        >
          <span>{actionMessage.text}</span>
          <button
            onClick={() => setActionMessage(null)}
            className="text-xs underline opacity-75 hover:opacity-100"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Main List */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-text-muted">
          <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
          <p className="text-sm">Đang tải danh sách bài cần sửa lời…</p>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl bg-background-surface/50 border border-white/10 p-12 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-emerald-400/10 border border-emerald-400/20 text-emerald-300 mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-white">Tất cả lời bài hát đều đang khớp chuẩn!</h3>
          <p className="text-xs sm:text-sm text-text-muted max-w-md mx-auto">
            Hiện chưa có bài hát nào bị người nghe báo lệch nhịp hoặc sai chữ. Khi người nghe chỉnh độ lệch hoặc bấm "Lời sai chữ", bài hát sẽ xuất hiện tại đây.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item, idx) => {
            const { song, pendingCount, offsetVotes, suggestedOffsetSec, wrongLines, autoAppliedOffsetsCount } = item;
            const isRunningAi = activeAiSongId === song.id;

            return (
              <div
                key={song.id}
                className="rounded-2xl bg-background-surface/80 border border-white/10 p-4 sm:p-5 space-y-4 hover:border-white/20 transition-all shadow-lg"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left: Rank + Song Info */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-amber-400/15 border border-amber-400/30 text-amber-300 font-black text-xs flex items-center justify-center flex-shrink-0">
                      #{idx + 1}
                    </div>
                    <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-white/5 flex-shrink-0 border border-white/10">
                      {song.coverUrl ? (
                        <img
                          src={getMediaUrl(song.coverUrl)}
                          alt={song.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-text-muted">
                          <Music2 className="w-6 h-6" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base sm:text-lg font-bold text-white truncate">{song.title}</h3>
                        {pendingCount > 0 && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-rose-500/20 text-rose-300 border border-rose-400/30">
                            {pendingCount} lượt báo
                          </span>
                        )}
                        {autoAppliedOffsetsCount > 0 && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-400/15 text-emerald-300 border border-emerald-400/30">
                            Đã tự cân ({autoAppliedOffsetsCount} người)
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-text-secondary truncate">
                        {song.artist?.name || 'Nghệ sĩ chưa rõ'} • {formatDuration(song.duration || 0)}
                      </p>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => reanalyzeMutation.mutate(song.id)}
                      disabled={isRunningAi}
                      className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-xs flex items-center gap-1.5 shadow-[0_0_15px_rgba(251,191,36,0.3)] disabled:opacity-60 active:scale-95 transition-all"
                    >
                      {isRunningAi ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Đang chạy AI phân tích…</span>
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-4 h-4" />
                          <span>Chạy lại AI phân tích lời</span>
                        </>
                      )}
                    </button>

                    {suggestedOffsetSec !== null && offsetVotes.length > 0 && (
                      <button
                        onClick={() =>
                          applyOffsetMutation.mutate({
                            songId: song.id,
                            offsetSec: suggestedOffsetSec,
                          })
                        }
                        disabled={applyOffsetMutation.isPending}
                        title="Áp dụng ngay độ lệch trung bình mà không cần chờ đủ 3 người"
                        className="px-3 py-2 rounded-xl bg-cyan-400/15 hover:bg-cyan-400/25 border border-cyan-400/40 text-cyan-200 font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>
                          Áp độ lệch ({suggestedOffsetSec > 0 ? '+' : ''}
                          {suggestedOffsetSec}s)
                        </span>
                      </button>
                    )}

                    <button
                      onClick={() => handlePreviewSong(song)}
                      className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-xs flex items-center gap-1.5 transition-all active:scale-95"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Nghe kiểm tra</span>
                    </button>

                    {pendingCount > 0 && (
                      <button
                        onClick={() => resolveMutation.mutate(song.id)}
                        disabled={resolveMutation.isPending}
                        className="px-3 py-2 rounded-xl bg-emerald-400/10 hover:bg-emerald-400/20 border border-emerald-400/30 text-emerald-300 font-semibold text-xs flex items-center gap-1.5 transition-all active:scale-95"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Đã xong</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Details of Offset Votes & Wrong Text Lines */}
                {(offsetVotes.length > 0 || wrongLines.length > 0) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-white/10">
                    {/* Offset Reports */}
                    {offsetVotes.length > 0 && (
                      <div className="rounded-xl bg-black/30 border border-white/5 p-3 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            Độ lệch người nghe chọn ({offsetVotes.length}/3 để tự cân):
                          </span>
                          {suggestedOffsetSec !== null && (
                            <span className="font-mono font-bold text-white">
                              TB: {suggestedOffsetSec > 0 ? '+' : ''}
                              {suggestedOffsetSec}s
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {offsetVotes.map((v) => (
                            <span
                              key={v.id}
                              className="px-2 py-0.5 rounded-lg bg-cyan-400/10 border border-cyan-400/25 text-cyan-200 font-mono text-[11px]"
                            >
                              {v.offsetSec > 0 ? '+' : ''}
                              {v.offsetSec.toFixed(2)}s{v.username ? ` (${v.username})` : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Wrong Lyric Text Reports */}
                    {wrongLines.length > 0 && (
                      <div className="rounded-xl bg-black/30 border border-white/5 p-3 space-y-2">
                        <span className="font-bold text-rose-300 text-xs flex items-center gap-1.5">
                          <Flag className="w-3.5 h-3.5" />
                          Các câu bị báo "Lời sai chữ" ({wrongLines.length} câu):
                        </span>
                        <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                          {wrongLines.map((w) => (
                            <div
                              key={w.id}
                              className="flex items-center justify-between gap-2 text-xs bg-rose-500/10 border border-rose-500/20 rounded-lg px-2.5 py-1.5"
                            >
                              <span className="text-white/90 truncate">
                                {typeof w.lineIndex === 'number' ? (
                                  <strong className="text-rose-300 mr-1.5">Câu #{w.lineIndex + 1}:</strong>
                                ) : null}
                                "{w.lineText}"
                              </span>
                              {w.count > 1 && (
                                <span className="px-1.5 py-0.5 rounded bg-rose-500/30 text-rose-200 font-bold text-[10px] flex-shrink-0">
                                  x{w.count}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
