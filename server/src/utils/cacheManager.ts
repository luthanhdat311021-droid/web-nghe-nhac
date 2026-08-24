/**
 * MusicWave High-Performance Cache Manager
 * 
 * Features:
 * - Single-Flight Request Coalescing (Zero Cache Stampede)
 * - Automatic TTL Expiration & Bounded Memory LRU Eviction
 * - Wildcard & Prefix Invalidation (e.g., "songs:*", "genres:*")
 * - Observability Metrics (Hits, Misses, Hit Ratio, Stampede Saves)
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  lastAccessed: number;
}

export interface CacheStats {
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
  hitRatio: string;
  stampedeSavedRequests: number;
  inFlightPromises: number;
}

export class CacheManager {
  private cache = new Map<string, CacheEntry<any>>();
  private inFlight = new Map<string, Promise<any>>();
  private maxSize: number;
  private defaultTtlMs: number;

  // Observability metrics
  private hits = 0;
  private misses = 0;
  private stampedeSavedRequests = 0;

  constructor(maxSize = 5000, defaultTtlSeconds = 60) {
    this.maxSize = maxSize;
    this.defaultTtlMs = defaultTtlSeconds * 1000;

    // Periodic cleanup every 60s
    setInterval(() => this.cleanupExpired(), 60000);
  }

  /**
   * Direct cache get
   */
  public get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }

    const now = Date.now();
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }

    entry.lastAccessed = now;
    this.hits++;
    return entry.value as T;
  }

  /**
   * Direct cache set with explicit TTL in seconds
   */
  public set<T>(key: string, value: T, ttlSeconds?: number): void {
    const now = Date.now();
    const ttlMs = ttlSeconds ? ttlSeconds * 1000 : this.defaultTtlMs;

    // Evict oldest if exceeding capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictOldest();
    }

    this.cache.set(key, {
      value,
      expiresAt: now + ttlMs,
      lastAccessed: now,
    });
  }

  /**
   * Cache-Aside with Single-Flight / Request Coalescing (Anti-Stampede)
   * If 5,000 requests hit an expired key simultaneously, ONLY ONE executes the fetcher!
   */
  public async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T> {
    // 1. Check existing cached item
    const cached = this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    // 2. Check if a single-flight fetch is already in flight for this key
    const inFlightPromise = this.inFlight.get(key);
    if (inFlightPromise) {
      this.stampedeSavedRequests++;
      return inFlightPromise as Promise<T>;
    }

    // 3. Launch single-flight promise
    const promise = (async () => {
      try {
        const freshData = await fetcher();
        this.set(key, freshData, ttlSeconds);
        return freshData;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, promise);
    return promise;
  }

  /**
   * Invalidate a single key
   */
  public delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Invalidate all keys matching a prefix (e.g. "songs:", "user:auth:")
   */
  public invalidatePrefix(prefix: string): number {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Clear entire cache
   */
  public clear(): void {
    this.cache.clear();
    this.inFlight.clear();
  }

  /**
   * Evict least recently accessed item
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Periodic expiration sweep
   */
  private cleanupExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Real-time metrics
   */
  public getStats(): CacheStats {
    const totalReqs = this.hits + this.misses;
    const hitRatio = totalReqs > 0 ? `${((this.hits / totalReqs) * 100).toFixed(1)}%` : '0%';

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRatio,
      stampedeSavedRequests: this.stampedeSavedRequests,
      inFlightPromises: this.inFlight.size,
    };
  }
}

// Global shared cache instance
export const appCache = new CacheManager(10000, 60);
