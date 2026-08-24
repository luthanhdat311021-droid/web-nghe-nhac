/**
 * MusicWave High-Throughput Playback & Play-Count Write Buffer
 * 
 * Solves:
 * - Database row-lock contention on hot/trending songs
 * - Postgres connection pool exhaustion under 100,000 concurrent play events
 * - Spiky write throughput to `songs` and `recently_played` tables
 */

import { prisma } from './prisma.js';

interface HistoryRecord {
  userId: string;
  songId: string;
  durationPlayed: number;
  playedAt: Date;
}

export interface PlaybackBufferStats {
  bufferedPlayCounts: number;
  bufferedHistoryItems: number;
  totalFlushes: number;
  totalPlaysProcessed: number;
}

class PlaybackBuffer {
  private playCountMap = new Map<string, number>();
  private historyList: HistoryRecord[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private isFlushing = false;

  // Stats for observability
  private totalFlushes = 0;
  private totalPlaysProcessed = 0;

  constructor(private flushIntervalMs = 4000, private maxBatchSize = 100) {
    this.startPeriodicFlush();
  }

  private startPeriodicFlush() {
    this.flushTimer = setInterval(() => {
      this.flush().catch((err) => {
        console.error('[PlaybackBuffer] Periodic flush error:', err);
      });
    }, this.flushIntervalMs);
  }

  /**
   * Enqueue a play event in memory (takes < 0.1ms, zero DB locks)
   */
  public recordPlay(songId: string, userId?: string, durationPlayed = 0): number {
    const current = this.playCountMap.get(songId) || 0;
    this.playCountMap.set(songId, current + 1);
    this.totalPlaysProcessed++;

    if (userId) {
      this.historyList.push({
        userId,
        songId,
        durationPlayed,
        playedAt: new Date(),
      });
    }

    // Trigger instant flush if batch threshold reached
    if (this.playCountMap.size >= this.maxBatchSize || this.historyList.length >= this.maxBatchSize) {
      setImmediate(() => this.flush().catch(() => {}));
    }

    return current + 1;
  }

  /**
   * Flush all aggregated play counts and history records to PostgreSQL in a single batch
   */
  public async flush(): Promise<void> {
    if (this.isFlushing) return;
    if (this.playCountMap.size === 0 && this.historyList.length === 0) return;

    this.isFlushing = true;

    // Snapshot and clear in-memory buffers
    const playsToFlush = new Map(this.playCountMap);
    const historyToFlush = [...this.historyList];
    this.playCountMap.clear();
    this.historyList = [];

    try {
      // 1. Batch increment play counts
      const songUpdates = Array.from(playsToFlush.entries()).map(([songId, count]) =>
        prisma.song.update({
          where: { id: songId },
          data: { playsCount: { increment: count } },
          select: { id: true },
        })
      );

      // 2. Batch insert listening history
      const historyInserts = historyToFlush.length > 0
        ? [
            prisma.recentlyPlayed.createMany({
              data: historyToFlush.map((h) => ({
                userId: h.userId,
                songId: h.songId,
                durationPlayed: h.durationPlayed,
                playedAt: h.playedAt,
              })),
            }),
          ]
        : [];

      if (songUpdates.length > 0 || historyInserts.length > 0) {
        await prisma.$transaction([...songUpdates, ...historyInserts]);
        this.totalFlushes++;
      }
    } catch (error) {
      console.error('[PlaybackBuffer] Error during batch flush to DB:', error);

      // Re-queue remaining plays to prevent data loss
      for (const [songId, count] of playsToFlush.entries()) {
        const existing = this.playCountMap.get(songId) || 0;
        this.playCountMap.set(songId, existing + count);
      }
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Graceful cleanup when server shuts down
   */
  public async stop(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }

  public getStats(): PlaybackBufferStats {
    return {
      bufferedPlayCounts: this.playCountMap.size,
      bufferedHistoryItems: this.historyList.length,
      totalFlushes: this.totalFlushes,
      totalPlaysProcessed: this.totalPlaysProcessed,
    };
  }
}

export const playbackBuffer = new PlaybackBuffer(4000, 100);
