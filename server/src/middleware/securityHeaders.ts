import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * Modern Security Headers Middleware for MusicWave
 * Compliant with OWASP ASVS 5.0 and Top 10 recommendations.
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // 1. Assign or propagate unique Request ID for distributed tracing & auditability
  const incomingReqId = req.headers['x-request-id'];
  const requestId = typeof incomingReqId === 'string' && incomingReqId.length <= 64
    ? incomingReqId
    : crypto.randomUUID();
  res.setHeader('X-Request-Id', requestId);
  (req as any).id = requestId;

  // 2. HTTP Strict Transport Security (HSTS) - 1 Year with subdomains
  res.setHeader(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  );

  // 3. MIME Sniffing Protection
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // 4. Clickjacking Protection (Frame Ancestors is also in CSP)
  res.setHeader('X-Frame-Options', 'DENY');

  // 5. Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // 6. Cross-Origin Opener Policy & Cross-Origin Resource Policy
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  // 7. Permissions Policy: Disable sensitive hardware APIs not used by MusicWave
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(self), geolocation=(), payment=(), usb=(), accelerometer=(), gyroscope=()'
  );

  // 8. Content Security Policy (Tailored for Music Streaming & external CDNs)
  // Allows YouTube embeds, Unsplash images, DiceBear avatars, audio streaming sources
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com https://s.ytimg.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https://images.unsplash.com https://img.youtube.com https://i.ytimg.com https://api.dicebear.com https://*.supabase.co",
    "media-src 'self' blob: data: https://*.youtube.com https://*.googlevideo.com https://*.supabase.co https://*.cloudinary.com https://*.scdn.co",
    "connect-src 'self' https://generativelanguage.googleapis.com https://*.supabase.co https://www.youtube.com",
    "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');

  res.setHeader('Content-Security-Policy', cspDirectives);

  // 9. Remove sensitive technology fingerprinting headers
  res.removeHeader('X-Powered-By');

  next();
};
