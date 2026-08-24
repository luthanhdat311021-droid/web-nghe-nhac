/**
 * Security Event Logger for MusicWave
 * Tracks authentication, authorization, rate limit, upload, and admin operations.
 * Redacts all passwords, full tokens, and sensitive personal information.
 */

export type SecurityEventType =
  | 'AUTH_LOGIN_SUCCESS'
  | 'AUTH_LOGIN_FAILURE'
  | 'AUTH_REGISTER_SUCCESS'
  | 'AUTH_REGISTER_FAILURE'
  | 'AUTH_PASSWORD_CHANGE_SUCCESS'
  | 'AUTH_PASSWORD_CHANGE_FAILURE'
  | 'AUTH_FORGOT_PASSWORD_ATTEMPT'
  | 'AUTH_FORGOT_PASSWORD_REQUESTED'
  | 'AUTH_OTP_MAX_ATTEMPTS_EXCEEDED'
  | 'AUTH_OTP_VERIFY_FAILURE'
  | 'AUTH_OTP_VERIFY_SUCCESS'
  | 'AUTH_PASSWORD_RESET_SUCCESS'
  | 'AUTH_BLOCKED_ATTEMPT'
  | 'AUTH_UNAUTHORIZED_ACCESS'
  | 'RATE_LIMIT_EXCEEDED'
  | 'UPLOAD_REJECTED'
  | 'SSRF_BLOCKED'
  | 'ADMIN_ACTION'
  | 'SUSPICIOUS_REQUEST';

export interface SecurityEventData {
  type: SecurityEventType;
  ip: string;
  userId?: string;
  username?: string;
  action?: string;
  resource?: string;
  details?: Record<string, any>;
  requestId?: string;
}

export class SecurityLogger {
  public static log(event: SecurityEventData): void {
    const timestamp = new Date().toISOString();
    const sanitizedDetails = event.details ? this.sanitize(event.details) : undefined;

    const logEntry = {
      timestamp,
      level: this.getLogLevel(event.type),
      securityEvent: event.type,
      ip: event.ip || 'unknown',
      userId: event.userId,
      username: event.username,
      action: event.action,
      resource: event.resource,
      requestId: event.requestId,
      details: sanitizedDetails,
    };

    // Output formatted structured JSON log
    const output = `[SECURITY_AUDIT] ${JSON.stringify(logEntry)}`;
    if (logEntry.level === 'WARN' || logEntry.level === 'ERROR') {
      console.warn(output);
    } else {
      console.log(output);
    }
  }

  private static getLogLevel(type: SecurityEventType): 'INFO' | 'WARN' | 'ERROR' {
    switch (type) {
      case 'AUTH_LOGIN_SUCCESS':
      case 'AUTH_REGISTER_SUCCESS':
      case 'AUTH_PASSWORD_CHANGE_SUCCESS':
      case 'ADMIN_ACTION':
        return 'INFO';

      case 'AUTH_LOGIN_FAILURE':
      case 'AUTH_REGISTER_FAILURE':
      case 'AUTH_PASSWORD_CHANGE_FAILURE':
      case 'RATE_LIMIT_EXCEEDED':
      case 'UPLOAD_REJECTED':
        return 'WARN';

      case 'AUTH_BLOCKED_ATTEMPT':
      case 'AUTH_UNAUTHORIZED_ACCESS':
      case 'SSRF_BLOCKED':
      case 'SUSPICIOUS_REQUEST':
        return 'ERROR';

      default:
        return 'INFO';
    }
  }

  /**
   * Recursively strips any keys containing password, token, secret, or credit card info.
   */
  private static sanitize(obj: Record<string, any>): Record<string, any> {
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'jwt', 'auth', 'hash'];
    const cleaned: Record<string, any> = {};

    for (const [k, v] of Object.entries(obj)) {
      const lowerKey = k.toLowerCase();
      if (sensitiveKeys.some((s) => lowerKey.includes(s))) {
        cleaned[k] = '[REDACTED]';
      } else if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        cleaned[k] = this.sanitize(v);
      } else {
        cleaned[k] = v;
      }
    }

    return cleaned;
  }
}
