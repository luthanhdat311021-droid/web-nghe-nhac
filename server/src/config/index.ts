import dotenv from 'dotenv';
dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';

// Fallback JWT secret
const INSECURE_DEFAULT_JWT = 'musicwave_super_secret_jwt_key_2026_modern_streaming_app_secure';
const jwtSecret = process.env.JWT_SECRET || INSECURE_DEFAULT_JWT;

if (isProd && (!process.env.JWT_SECRET || process.env.JWT_SECRET === INSECURE_DEFAULT_JWT)) {
  console.warn(
    '⚠️ [SECURITY NOTICE] JWT_SECRET is not configured in Vercel Environment Variables. Using fallback key. Please add JWT_SECRET in Vercel Dashboard for production security.'
  );
}

// Allowed CORS origins
const rawAllowedOrigins = process.env.ALLOWED_ORIGINS || process.env.CLIENT_URL || 'http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173';
const allowedOrigins = rawAllowedOrigins
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean);

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv,
  isProd,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  allowedOrigins,
  jwt: {
    secret: jwtSecret,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  otp: {
    expiresMinutes: parseInt(process.env.OTP_EXPIRES_MINUTES || '5', 10),
    resendCooldownSeconds: parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS || '60', 10),
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10),
  },
  resetToken: {
    expiresMinutes: parseInt(process.env.RESET_TOKEN_EXPIRES_MINUTES || '10', 10),
  },
  smtp: {
    service: process.env.SMTP_SERVICE || (process.env.SMTP_HOST?.includes('gmail') || process.env.EMAIL_HOST?.includes('gmail') ? 'gmail' : undefined),
    host: process.env.SMTP_HOST || process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || process.env.EMAIL_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
    user: (process.env.SMTP_USER || process.env.EMAIL_USER || '').trim(),
    pass: (process.env.SMTP_PASS || process.env.SMTP_PASSWORD || process.env.EMAIL_PASSWORD || '').trim(),
    from: process.env.SMTP_FROM || process.env.EMAIL_FROM || 'MusicWave Security <no-reply@musicwave.com>',
  },
  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@musicwave.com',
    password: process.env.ADMIN_PASSWORD || 'Admin@123456',
    username: process.env.ADMIN_USERNAME || 'MusicWaveAdmin',
  },
  ai: {
    geminiApiKey: process.env.GEMINI_API_KEY,
  },
};
