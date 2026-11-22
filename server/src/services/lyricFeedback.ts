import path from 'path';
import fs from 'fs/promises';
import { prisma } from './prisma.js';
import { appCache } from '../utils/cacheManager.js';
import { transcribeLyrics, TranscribeSource } from './lyricsTranscribe.js';
import { findLyrics } from './lyricsLookup.js';
import { validateSafeUrl } from '../utils/ssrfGuard.js';

export interface ParsedSyncLine {
  time: number;
  text: string;
  translation?: string;
}

/**
 * Parse LRC or JSON syncedLyrics into sorted array of { time, text }
 */
export function parseSyncedLrcOrJson(raw?: string | null): ParsedSyncLine[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0].time === 'number') {
      return parsed.sort((a, b) => a.time - b.time);
    }
  } catch {
    // Standard LRC format: [mm:ss.xx] text
  }

  const lines = raw.split('\n');
  const result: ParsedSyncLine[] = [];
  const lrcRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\](.*)/;

  for (const line of lines) {
    const match = line.trim().match(lrcRegex);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const ms = match[3] ? parseFloat(`0.${match[3]}`) : 0;
      const totalTime = minutes * 60 + seconds + ms;
      const text = match[4].trim();
      if (text) {
        result.push({ time: totalTime, text });
      }
    }
  }

  return result.sort((a, b) => a.time - b.time);
}

/**
 * Shift every line in syncedLyrics by shiftSec (negative = earlier, positive = later) and serialize to LRC
 */
export function shiftSyncedLyricsText(raw: string, shiftSec: number): string {
  const lines = parseSyncedLrcOrJson(raw);
  if (lines.length === 0) return raw;

  return lines
    .map(({ time, text }) => {
      const t = Math.max(0, time + shiftSec);
      const m = Math.floor(t / 60);
      const s = t - m * 60;
      return `[${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}] ${text}`;
    })
    .join('\n');
}

/**
 * Shift JSON translatedLyrics timestamps if present
 */
export function shiftTranslatedLyricsJson(raw: string | null | undefined, shiftSec: number): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return raw;
    const shifted = parsed.map((item) => ({
      ...item,
      time: typeof item.time === 'number' ? Math.max(0, Number((item.time + shiftSec).toFixed(2))) : item.time,
    }));
    return JSON.stringify(shifted);
  } catch {
    return raw;
  }
}

/**
 * Find if at least `minCount` (default 3) offset votes are close to each other (within `toleranceSec`).
 * Returns the best cluster of report IDs and their rounded average offset.
 */
export function findConsensusOffsetCluster<T extends { id: string; offsetSec: number | null }>(
  reports: T[],
  toleranceSec = 1.25,
  minCount = 3
): { cluster: T[]; averageOffset: number } | null {
  const valid = reports.filter((r): r is T & { offsetSec: number } => typeof r.offsetSec === 'number' && Math.abs(r.offsetSec) >= 0.2);
  if (valid.length < minCount) return null;

  let bestCluster: (T & { offsetSec: number })[] = [];

  for (const anchor of valid) {
    const neighbors = valid.filter((r) => Math.abs(r.offsetSec - anchor.offsetSec) <= toleranceSec);
    if (neighbors.length > bestCluster.length) {
      bestCluster = neighbors;
    }
  }

  if (bestCluster.length < minCount) return null;

  const sum = bestCluster.reduce((acc, r) => acc + r.offsetSec, 0);
  // Làm tròn tới 0.25s gần nhất
  const averageOffset = Math.round((sum / bestCluster.length) * 4) / 4;
  if (averageOffset === 0) return null;

  return { cluster: bestCluster, averageOffset };
}

/**
 * Apply an offset (in user-facing convention: `time = currentTime + offset`, so timestamp shift is `-offset`)
 * to the stored Lyrics of a song.
 */
export async function applyOffsetToSongLyrics(songId: string, userOffsetSec: number) {
  const lyrics = await prisma.lyrics.findUnique({ where: { songId } });
  if (!lyrics || !lyrics.syncedLyrics) {
    return null;
  }

  // Trong LyricsModal: time = currentTime + offset => Dịch mốc thời gian lưu trữ đi -offset
  const shiftSec = -userOffsetSec;
  const newSynced = shiftSyncedLyricsText(lyrics.syncedLyrics, shiftSec);
  const newTranslated = shiftTranslatedLyricsJson(lyrics.translatedLyrics, shiftSec);

  const updated = await prisma.lyrics.update({
    where: { songId },
    data: {
      syncedLyrics: newSynced,
      translatedLyrics: newTranslated,
      isSynced: true,
    },
  });

  appCache.invalidatePrefix('songs:');
  return updated;
}

/**
 * Record a listener's lyric report (OFFSET or WRONG_TEXT).
 * If 3+ listeners report a similar OFFSET, automatically calibrate the song's lyrics!
 */
export async function submitLyricReport(params: {
  songId: string;
  userId?: string | null;
  reporterKey: string;
  type: 'OFFSET' | 'WRONG_TEXT';
  offsetSec?: number;
  lineIndex?: number;
  lineText?: string;
}) {
  const { songId, userId, reporterKey, type, offsetSec, lineIndex, lineText } = params;

  const song = await prisma.song.findUnique({
    where: { id: songId },
    include: { lyrics: true },
  });
  if (!song) {
    throw new Error('Không tìm thấy bài hát.');
  }

  if (type === 'OFFSET') {
    const cleanOffset = Math.max(-60, Math.min(60, Math.round((Number(offsetSec) || 0) * 4) / 4));
    if (Math.abs(cleanOffset) < 0.25) {
      throw new Error('Độ lệch quá nhỏ để ghi nhận.');
    }

    // Nếu người nghe này đã gửi báo lệch đang PENDING cho bài này thì cập nhật lại độ lệch mới nhất của họ
    const existing = await prisma.lyricReport.findFirst({
      where: {
        songId,
        reporterKey,
        type: 'OFFSET',
        status: 'PENDING',
      },
    });

    if (existing) {
      await prisma.lyricReport.update({
        where: { id: existing.id },
        data: { offsetSec: cleanOffset, userId: userId || existing.userId },
      });
    } else {
      await prisma.lyricReport.create({
        data: {
          songId,
          userId: userId || null,
          reporterKey,
          type: 'OFFSET',
          offsetSec: cleanOffset,
          status: 'PENDING',
        },
      });
    }

    // Kiểm tra xem đã có ít nhất 3 người chỉnh độ lệch gần giống nhau chưa
    const pendingOffsets = await prisma.lyricReport.findMany({
      where: {
        songId,
        type: 'OFFSET',
        status: 'PENDING',
      },
      orderBy: { createdAt: 'desc' },
    });

    const consensus = findConsensusOffsetCluster(pendingOffsets, 1.25, 3);
    if (consensus && song.lyrics?.syncedLyrics) {
      const updatedLyrics = await applyOffsetToSongLyrics(songId, consensus.averageOffset);
      await prisma.lyricReport.updateMany({
        where: { id: { in: consensus.cluster.map((r) => r.id) } },
        data: { status: 'APPLIED' },
      });

      return {
        type: 'OFFSET',
        autoApplied: true,
        appliedOffset: consensus.averageOffset,
        supportersCount: consensus.cluster.length,
        lyrics: updatedLyrics,
      };
    }

    return {
      type: 'OFFSET',
      autoApplied: false,
      recordedOffset: cleanOffset,
      pendingVotesCount: pendingOffsets.length,
    };
  }

  // type === 'WRONG_TEXT'
  const cleanLineText = String(lineText || '').trim().slice(0, 500);
  if (!cleanLineText) {
    throw new Error('Cần nội dung câu hát bị sai chữ.');
  }

  // Tránh trùng lặp báo cùng 1 câu từ cùng 1 người nghe
  const existingWrong = await prisma.lyricReport.findFirst({
    where: {
      songId,
      reporterKey,
      type: 'WRONG_TEXT',
      lineText: cleanLineText,
      status: 'PENDING',
    },
  });

  if (!existingWrong) {
    await prisma.lyricReport.create({
      data: {
        songId,
        userId: userId || null,
        reporterKey,
        type: 'WRONG_TEXT',
        lineIndex: typeof lineIndex === 'number' ? lineIndex : null,
        lineText: cleanLineText,
        status: 'PENDING',
      },
    });
  }

  return {
    type: 'WRONG_TEXT',
    reported: true,
    lineIndex,
    lineText: cleanLineText,
  };
}

/**
 * Admin: lấy danh sách các bài hát có lượt báo lời lệch / lời sai chữ, xếp theo số lượt báo giảm dần.
 */
export async function getAdminReportedSongs() {
  const reports = await prisma.lyricReport.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { id: true, username: true } },
    },
  });

  if (reports.length === 0) {
    return {
      summary: {
        songsNeedFixCount: 0,
        pendingOffsetCount: 0,
        pendingWrongTextCount: 0,
        autoAppliedCount: 0,
      },
      items: [],
    };
  }

  const songIds = Array.from(new Set(reports.map((r) => r.songId)));
  const songs = await prisma.song.findMany({
    where: { id: { in: songIds } },
    include: {
      artist: { select: { id: true, name: true, avatarUrl: true } },
      lyrics: { select: { id: true, isSynced: true, plainLyrics: true, syncedLyrics: true } },
    },
  });
  const songMap = new Map(songs.map((s) => [s.id, s]));

  let pendingOffsetCount = 0;
  let pendingWrongTextCount = 0;
  let autoAppliedCount = 0;

  const grouped = new Map<
    string,
    {
      song: any;
      pendingCount: number;
      totalReports: number;
      offsetVotes: { id: string; offsetSec: number; status: string; createdAt: Date; username?: string }[];
      suggestedOffsetSec: number | null;
      wrongLines: { id: string; lineIndex: number | null; lineText: string; count: number; createdAt: Date }[];
      autoAppliedOffsetsCount: number;
      lastReportedAt: Date;
    }
  >();

  for (const r of reports) {
    if (r.status === 'APPLIED') autoAppliedCount++;
    if (r.status === 'PENDING' && r.type === 'OFFSET') pendingOffsetCount++;
    if (r.status === 'PENDING' && r.type === 'WRONG_TEXT') pendingWrongTextCount++;

    const song = songMap.get(r.songId);
    if (!song) continue;

    let entry = grouped.get(r.songId);
    if (!entry) {
      entry = {
        song,
        pendingCount: 0,
        totalReports: 0,
        offsetVotes: [],
        suggestedOffsetSec: null,
        wrongLines: [],
        autoAppliedOffsetsCount: 0,
        lastReportedAt: r.createdAt,
      };
      grouped.set(r.songId, entry);
    }

    entry.totalReports++;
    if (r.createdAt > entry.lastReportedAt) {
      entry.lastReportedAt = r.createdAt;
    }

    if (r.status === 'APPLIED' && r.type === 'OFFSET') {
      entry.autoAppliedOffsetsCount++;
    }

    if (r.status === 'PENDING') {
      entry.pendingCount++;
      if (r.type === 'OFFSET' && typeof r.offsetSec === 'number') {
        entry.offsetVotes.push({
          id: r.id,
          offsetSec: r.offsetSec,
          status: r.status,
          createdAt: r.createdAt,
          username: r.user?.username,
        });
      } else if (r.type === 'WRONG_TEXT' && r.lineText) {
        const existingLine = entry.wrongLines.find(
          (w) => w.lineText === r.lineText && w.lineIndex === r.lineIndex
        );
        if (existingLine) {
          existingLine.count++;
        } else {
          entry.wrongLines.push({
            id: r.id,
            lineIndex: r.lineIndex,
            lineText: r.lineText,
            count: 1,
            createdAt: r.createdAt,
          });
        }
      }
    }
  }

  const items = Array.from(grouped.values())
    .map((item) => {
      if (item.offsetVotes.length > 0) {
        const sum = item.offsetVotes.reduce((acc, v) => acc + v.offsetSec, 0);
        item.suggestedOffsetSec = Math.round((sum / item.offsetVotes.length) * 4) / 4;
      }
      return item;
    })
    // Chỉ hiển thị các bài đang có báo cáo PENDING hoặc vừa được tự động cân chỉnh, xếp theo pendingCount giảm dần
    .filter((item) => item.pendingCount > 0 || item.autoAppliedOffsetsCount > 0)
    .sort((a, b) => {
      if (b.pendingCount !== a.pendingCount) return b.pendingCount - a.pendingCount;
      if (b.totalReports !== a.totalReports) return b.totalReports - a.totalReports;
      return b.lastReportedAt.getTime() - a.lastReportedAt.getTime();
    });

  return {
    summary: {
      songsNeedFixCount: items.filter((i) => i.pendingCount > 0).length,
      pendingOffsetCount,
      pendingWrongTextCount,
      autoAppliedCount,
    },
    items,
  };
}

/**
 * Admin: Chạy lại AI phân tích lời cho bài hát bị báo lỗi
 */
export async function reanalyzeSongLyricsWithAI(songId: string) {
  const song = await prisma.song.findUnique({
    where: { id: songId },
    include: {
      artist: { select: { name: true } },
      lyrics: true,
    },
  });
  if (!song) {
    throw new Error('Không tìm thấy bài hát.');
  }

  // Kiểm tra xem bài hát có bị báo "Lời sai chữ" không
  const wrongTextReports = await prisma.lyricReport.count({
    where: { songId, type: 'WRONG_TEXT', status: 'PENDING' },
  });

  let source: TranscribeSource | null = null;
  const ytUrl = song.youtubeUrl || (song.youtubeId ? `https://www.youtube.com/watch?v=${song.youtubeId}` : '');

  if (ytUrl && /^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(ytUrl)) {
    source = { kind: 'youtube', url: ytUrl };
  } else if (song.audioUrl) {
    if (song.audioUrl.startsWith('/uploads/')) {
      const localPath = path.join(process.cwd(), song.audioUrl.replace(/^\//, ''));
      try {
        const data = await fs.readFile(localPath);
        source = { kind: 'audio', data, mimeType: 'audio/mpeg' };
      } catch {}
    } else if (/^https?:\/\//i.test(song.audioUrl) && validateSafeUrl(song.audioUrl).isValid) {
      try {
        const resp = await fetch(song.audioUrl, { signal: AbortSignal.timeout(30000) });
        if (resp.ok) {
          const data = Buffer.from(await resp.arrayBuffer());
          source = { kind: 'audio', data, mimeType: resp.headers.get('content-type') || 'audio/mpeg' };
        }
      } catch {}
    }
  }

  let plainLyrics = '';
  let syncedLyrics = '';
  let engine = 'ai';

  if (source) {
    try {
      // Nếu chỉ bị lệch nhịp (không bị báo sai chữ), giữ lại plainLyrics chuẩn để AI căn lại đúng mốc giây
      const referenceLyrics = wrongTextReports === 0 ? song.lyrics?.plainLyrics || '' : '';
      const result = await transcribeLyrics(source, {
        title: song.title,
        artist: song.artist?.name || '',
        lyrics: referenceLyrics,
        forceAi: true,
      });
      plainLyrics = result.plainLyrics;
      syncedLyrics = result.syncedLyrics;
      engine = result.engine;
    } catch (aiErr) {
      console.warn('[LyricFeedback] AI transcribe fallback to LRCLIB:', aiErr);
    }
  }

  // Fallback sang LRCLIB nếu nguồn audio không tải được hoặc AI không phản hồi
  if (!syncedLyrics && !plainLyrics) {
    const match = await findLyrics({
      title: song.title,
      artistName: song.artist?.name || '',
      duration: song.duration,
    });
    if (!match) {
      throw new Error('Không thể phân tích lại lời cho bài hát này (thiếu nguồn nhạc hoặc AI không phản hồi).');
    }
    plainLyrics = match.plainLyrics;
    syncedLyrics = match.syncedLyrics || '';
    engine = 'lrclib';
  }

  const savedLyrics = await prisma.lyrics.upsert({
    where: { songId },
    create: {
      songId,
      plainLyrics,
      syncedLyrics: syncedLyrics || null,
      isSynced: Boolean(syncedLyrics),
    },
    update: {
      plainLyrics,
      syncedLyrics: syncedLyrics || null,
      translatedLyrics: null, // Xóa bản dịch cũ để dịch lại theo mốc thời gian mới
      isSynced: Boolean(syncedLyrics),
    },
  });

  // Đánh dấu tất cả các lượt báo lỗi đang chờ của bài hát này là RESOLVED
  await prisma.lyricReport.updateMany({
    where: { songId, status: 'PENDING' },
    data: { status: 'RESOLVED' },
  });

  appCache.invalidatePrefix('songs:');

  return {
    lyrics: savedLyrics,
    engine,
  };
}

