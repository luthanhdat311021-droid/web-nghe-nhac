/**
 * MusicWave Circuit Breaker Pattern
 * 
 * Protects backend from cascading failures when third-party services
 * (Gemini AI, YouTube scraper, SMTP) become slow or unreachable.
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  name: string;
  failureThreshold?: number; // Failures before opening
  recoveryTimeoutMs?: number; // Time in OPEN state before trying HALF_OPEN
  timeoutMs?: number; // Max execution timeout
}

export class CircuitBreaker {
  public state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private nextAttempt = Date.now();
  private name: string;
  private failureThreshold: number;
  private recoveryTimeoutMs: number;
  private timeoutMs: number;

  constructor(options: CircuitBreakerOptions) {
    this.name = options.name;
    this.failureThreshold = options.failureThreshold || 3;
    this.recoveryTimeoutMs = options.recoveryTimeoutMs || 15000;
    this.timeoutMs = options.timeoutMs || 2500;
  }

  public async execute<T>(action: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
    const now = Date.now();

    // 1. If OPEN, check if cooldown elapsed to try HALF_OPEN
    if (this.state === 'OPEN') {
      if (now > this.nextAttempt) {
        this.state = 'HALF_OPEN';
      } else {
        // Fast-fail to fallback instantly (0ms latency penalty)
        return fallback();
      }
    }

    // 2. Execute with timeout
    try {
      const result = await Promise.race([
        action(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`[CircuitBreaker:${this.name}] Execution timed out after ${this.timeoutMs}ms`)), this.timeoutMs)
        ),
      ]);

      // Success -> Reset circuit
      this.onSuccess();
      return result;
    } catch (error: any) {
      this.onFailure(error);
      return fallback();
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  private onFailure(error: any): void {
    this.failureCount++;
    console.warn(`[CircuitBreaker:${this.name}] Failure ${this.failureCount}/${this.failureThreshold}: ${error?.message || error}`);

    if (this.failureCount >= this.failureThreshold || this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.recoveryTimeoutMs;
      console.warn(`🚨 [CircuitBreaker:${this.name}] Circuit is now OPEN! Next recovery probe at ${new Date(this.nextAttempt).toISOString()}`);
    }
  }

  public getStatus() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      nextAttempt: this.state === 'OPEN' ? new Date(this.nextAttempt).toISOString() : null,
    };
  }
}
