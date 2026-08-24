import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response.js';
import { SecurityLogger } from '../utils/securityLogger.js';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

export class SlidingWindowRateLimiter {
  private records = new Map<string, RateLimitRecord>();
  private windowMs: number;
  private maxRequests: number;
  private name: string;

  constructor(name: string, maxRequests: number, windowSeconds: number) {
    this.name = name;
    this.maxRequests = maxRequests;
    this.windowMs = windowSeconds * 1000;

    // Periodic garbage collection every 2 minutes
    setInterval(() => this.cleanup(), 120000);
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

  private cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.records.entries()) {
      if (now > record.resetTime) {
        this.records.delete(key);
      }
    }
  }

  public getMiddleware(customErrorMessage?: string) {
    return (req: Request, res: Response, next: NextFunction) => {
      // Determine client IP safely
      const forwardedFor = req.headers['x-forwarded-for'];
      const rawIp = typeof forwardedFor === 'string'
        ? forwardedFor.split(',')[0].trim()
        : req.ip || req.socket.remoteAddress || 'unknown';

      // Combine IP with User ID if authenticated for dual-layer enforcement
      const userKey = (req as any).user?.userId
        ? `${rawIp}:user:${(req as any).user.userId}`
        : `${rawIp}`;

      const key = `${this.name}:${userKey}`;
      const status = this.check(key);

      res.setHeader('X-RateLimit-Limit', this.maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, status.remaining));

      if (!status.allowed) {
        res.setHeader('Retry-After', status.retryAfter || 60);

        SecurityLogger.log({
          type: 'RATE_LIMIT_EXCEEDED',
          ip: rawIp,
          userId: (req as any).user?.userId,
          action: req.method,
          resource: req.originalUrl,
          details: { limiter: this.name, retryAfter: status.retryAfter },
          requestId: (req as any).id,
        });

        return sendError(
          res,
          customErrorMessage || 'Bạn đang thực hiện thao tác quá nhanh. Vui lòng thử lại sau giây lát.',
          429
        );
      }

      next();
    };
  }
}

// 1. Strict Auth Rate Limiter (Login, Register, Password Changes): 15 attempts / 15 minutes
export const authRateLimiter = new SlidingWindowRateLimiter('auth', 15, 15 * 60).getMiddleware(
  'Quá nhiều lần thử đăng nhập/đăng ký. Vui lòng thử lại sau 15 phút để bảo vệ tài khoản.'
);

// 2. Forgot Password Request Limiter: 5 requests / 15 minutes
export const passwordResetRequestLimiter = new SlidingWindowRateLimiter('forgot-password-request', 5, 15 * 60).getMiddleware(
  'Bạn đã yêu cầu gửi mã xác thực quá nhiều lần. Vui lòng đợi 15 phút trước khi thử lại.'
);

// 3. OTP Verification Limiter: 10 attempts / 15 minutes
export const passwordResetVerifyLimiter = new SlidingWindowRateLimiter('forgot-password-verify', 10, 15 * 60).getMiddleware(
  'Quá nhiều lần thử xác minh OTP. Vui lòng thử lại sau ít phút.'
);

// 4. Upload Rate Limiter: 15 uploads / 10 minutes
export const uploadRateLimiter = new SlidingWindowRateLimiter('upload', 15, 10 * 60).getMiddleware(
  'Bạn đã tải lên quá nhiều file trong thời gian ngắn. Vui lòng đợi vài phút.'
);

// 5. Search & AI Query Rate Limiter: 90 requests / 1 minute
export const searchRateLimiter = new SlidingWindowRateLimiter('search', 90, 60).getMiddleware(
  'Tần suất tìm kiếm quá cao. Vui lòng giảm tốc độ tìm kiếm.'
);

// 6. Global API Rate Limiter: 300 requests / 1 minute
export const globalApiRateLimiter = new SlidingWindowRateLimiter('global', 300, 60).getMiddleware(
  'Hệ thống đang nhận quá nhiều yêu cầu từ bạn. Vui lòng thử lại sau ít phút.'
);

