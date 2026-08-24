/**
 * MusicWave Resilient In-Memory Background Job Queue
 * 
 * Features:
 * - Decouples slow external I/O (SMTP, Notifications) from HTTP request threads
 * - Bulkhead Concurrency Control (Max concurrent workers)
 * - Exponential Backoff Retries with Jitter
 * - Dead-Letter Failure Logging & Observability
 */

import { emailService } from './email.service.js';
import { SecurityLogger } from '../utils/securityLogger.js';

export type JobType = 'SEND_PASSWORD_RESET_OTP' | 'GENERIC_NOTIFICATION';

export interface BackgroundJob {
  id: string;
  type: JobType;
  payload: any;
  attempts: number;
  maxAttempts: number;
  createdAt: number;
  nextRunAt: number;
}

export interface JobQueueStats {
  queued: number;
  inProgress: number;
  completed: number;
  failed: number;
}

class JobQueue {
  private queue: BackgroundJob[] = [];
  private inProgress = 0;
  private maxConcurrency = 5;
  private timer: NodeJS.Timeout | null = null;

  // Stats
  private totalCompleted = 0;
  private totalFailed = 0;

  constructor() {
    this.startWorker();
  }

  private startWorker() {
    this.timer = setInterval(() => this.processNext(), 200);
  }

  /**
   * Enqueue a job (takes < 1ms, non-blocking)
   */
  public enqueue(type: JobType, payload: any, maxAttempts = 3): string {
    const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const job: BackgroundJob = {
      id,
      type,
      payload,
      attempts: 0,
      maxAttempts,
      createdAt: Date.now(),
      nextRunAt: Date.now(),
    };

    this.queue.push(job);
    setImmediate(() => this.processNext());
    return id;
  }

  private async processNext(): Promise<void> {
    if (this.inProgress >= this.maxConcurrency) return;

    const now = Date.now();
    const jobIndex = this.queue.findIndex((j) => j.nextRunAt <= now);
    if (jobIndex === -1) return;

    const [job] = this.queue.splice(jobIndex, 1);
    if (!job) return;

    this.inProgress++;
    job.attempts++;

    try {
      await this.executeJob(job);
      this.totalCompleted++;
    } catch (error: any) {
      console.error(`[JobQueue] Job ${job.id} (${job.type}) failed attempt ${job.attempts}/${job.maxAttempts}:`, error.message);

      if (job.attempts < job.maxAttempts) {
        // Exponential backoff: 2s, 4s, 8s + jitter
        const backoffMs = Math.pow(2, job.attempts) * 1000 + Math.floor(Math.random() * 500);
        job.nextRunAt = Date.now() + backoffMs;
        this.queue.push(job);
      } else {
        // Dead letter
        this.totalFailed++;
        SecurityLogger.log({
          type: 'SUSPICIOUS_REQUEST',
          ip: 'system',
          action: 'BACKGROUND_JOB_DEAD_LETTER',
          resource: job.type,
          details: { jobId: job.id, attempts: job.attempts, error: error.message },
        });
      }
    } finally {
      this.inProgress--;
    }
  }

  private async executeJob(job: BackgroundJob): Promise<void> {
    switch (job.type) {
      case 'SEND_PASSWORD_RESET_OTP': {
        const { email, otp, username } = job.payload;
        const success = await emailService.sendPasswordResetOtp(email, otp, username);
        if (!success) {
          throw new Error(`Email dispatch failed for ${email}`);
        }
        break;
      }
      default:
        console.warn(`[JobQueue] Unhandled job type: ${job.type}`);
    }
  }

  public getStats(): JobQueueStats {
    return {
      queued: this.queue.length,
      inProgress: this.inProgress,
      completed: this.totalCompleted,
      failed: this.totalFailed,
    };
  }

  public stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export const jobQueue = new JobQueue();
