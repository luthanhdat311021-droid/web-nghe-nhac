/**
 * Sliding Window In-Memory Rate Limiter for Search Endpoints
 * MusicWave AI Smart Search Engine
 */

interface RateRecord {
  count: number;
  resetTime: number;
}

export class SearchRateLimiter {
  private records = new Map<string, RateRecord>();
  private windowMs: number;
  private maxRequests: number;

  constructor(maxRequests = 120, windowSeconds = 60) {
    this.maxRequests = maxRequests;
    this.windowMs = windowSeconds * 1000;
  }

  public check(identifier: string): { allowed: boolean; remaining: number; retryAfter?: number } {
    const now = Date.now();
    let record = this.records.get(identifier);

    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + this.windowMs,
      };
      this.records.set(identifier, record);
      return { allowed: true, remaining: this.maxRequests - 1 };
    }

    if (record.count >= this.maxRequests) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      return { allowed: false, remaining: 0, retryAfter };
    }

    record.count++;
    return { allowed: true, remaining: this.maxRequests - record.count };
  }

  /**
   * Periodically clean up expired records
   */
  public cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.records.entries()) {
      if (now > record.resetTime) {
        this.records.delete(key);
      }
    }
  }
}

export const searchRateLimiter = new SearchRateLimiter(120, 60);

// Run cleanup every 2 minutes
setInterval(() => searchRateLimiter.cleanup(), 120000);
