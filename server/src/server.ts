import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import compression from 'compression';
import { config } from './config/index.js';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { securityHeaders } from './middleware/securityHeaders.js';
import { globalApiRateLimiter } from './middleware/apiRateLimiter.js';
import { SecurityLogger } from './utils/securityLogger.js';
import { appCache } from './utils/cacheManager.js';
import { playbackBuffer } from './services/playbackBuffer.js';
import { jobQueue } from './services/jobQueue.js';
import { prisma } from './services/prisma.js';

const app = express();

// 1. Trust Reverse Proxy (For secure rate limiting & IP extraction behind Vercel/Nginx/Cloudflare)
app.set('trust proxy', 1);

// 2. High-Efficiency HTTP Compression (Gzip/Deflate)
app.use(
  compression({
    threshold: 1024, // Only compress responses > 1KB
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    },
  })
);

// 3. Request Correlation ID & Telemetry Middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const correlationId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  (req as any).id = correlationId;
  res.setHeader('X-Request-Id', correlationId);

  const startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startTime;

    // Log slow queries/endpoints (> 1000ms) for proactive bottleneck detection
    if (duration > 1000 && !req.originalUrl.includes('/uploads/')) {
      console.warn(
        `⚠️ [SLOW REQUEST DETECTED] ${req.method} ${req.originalUrl} took ${duration}ms [Status: ${res.statusCode}] [ReqID: ${correlationId}]`
      );
    }
  });

  next();
});


// 4. Global Security Headers (HSTS, CSP, nosniff, frame-ancestors, Permissions-Policy)
app.use(securityHeaders);

// 5. Hardened CORS Configuration
const allowedOriginSet = new Set(config.allowedOrigins);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin) {
        return callback(null, true);
      }

      const normalizedOrigin = origin.replace(/\/+$/, '');

      // Check against configured allowed origins
      if (allowedOriginSet.has(normalizedOrigin)) {
        return callback(null, true);
      }

      // Allow Vercel preview deployments, localhost, Capacitor, Android Emulator and Local LAN
      if (
        normalizedOrigin.endsWith('.vercel.app') ||
        normalizedOrigin.includes('localhost') ||
        normalizedOrigin.includes('127.0.0.1') ||
        normalizedOrigin.includes('10.0.2.2') ||
        normalizedOrigin.startsWith('capacitor://') ||
        normalizedOrigin.startsWith('ionic://') ||
        normalizedOrigin.startsWith('http://192.168.') ||
        normalizedOrigin.startsWith('http://10.') ||
        normalizedOrigin.startsWith('http://172.')
      ) {
        return callback(null, true);
      }

      SecurityLogger.log({
        type: 'SUSPICIOUS_REQUEST',
        ip: 'unknown',
        action: 'CORS_BLOCKED',
        resource: normalizedOrigin,
        details: { blockedOrigin: origin },
      });

      return callback(new Error(`CORS Policy: Origin ${origin} is not allowed access.`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'Accept'],
    maxAge: 86400, // 24 hours preflight cache
  })
);

// 6. Request Body Parsers with safe maximum limits (prevents payload exhaustion DoS)
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// 7. Static Uploads Serving with Security Options
const uploadsPath = process.env.VERCEL
  ? path.join(os.tmpdir(), 'uploads')
  : path.resolve(process.cwd(), 'uploads');

app.use(
  '/uploads',
  express.static(uploadsPath, {
    dotfiles: 'ignore',       // Never serve hidden files (.env, .git, etc.)
    maxAge: '1d',             // Cache for 1 day
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  })
);

// 8. Liveness Probe (/health) — Extremely lightweight (< 1ms)
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    memoryUsageMB: {
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
    },
  });
});

// 9. Readiness Probe (/ready) — Deep dependency & subsystem check
app.get('/ready', async (_req: Request, res: Response) => {
  let dbStatus = 'ok';
  let dbLatencyMs = 0;

  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - dbStart;
  } catch (error: any) {
    dbStatus = `error: ${error.message}`;
  }

  const isReady = dbStatus === 'ok';

  res.status(isReady ? 200 : 503).json({
    status: isReady ? 'ready' : 'degraded',
    timestamp: new Date().toISOString(),
    database: {
      status: dbStatus,
      latencyMs: dbLatencyMs,
    },
    cache: appCache.getStats(),
    playbackBuffer: playbackBuffer.getStats(),
    jobQueue: jobQueue.getStats(),
  });
});

// 10. Global API Rate Limiter
app.use('/api', globalApiRateLimiter);
app.use(globalApiRateLimiter);

// 11. High-Performance HTTP Cache Headers for Public Catalog Reads (Web & App local disk cache)
app.use((req: Request, res: Response, next: NextFunction) => {
  if (
    req.method === 'GET' &&
    !req.headers.authorization &&
    !req.originalUrl.includes('/admin') &&
    !req.originalUrl.includes('/auth') &&
    !req.originalUrl.includes('/me')
  ) {
    // 60s max-age in browser / WebView, 5 mins stale-while-revalidate
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  }
  next();
});

// 12. Mount Main API Routes (Supports both /api prefix and direct serverless rewrites)
app.use('/api', routes);
app.use('/', routes);

// 12. 404 & Global Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

let serverInstance: any = null;

if (!process.env.VERCEL) {
  const PORT = config.port || 5000;
  serverInstance = app.listen(PORT, () => {
    console.log(`🎵 MusicWave Backend Server is running on http://localhost:${PORT}`);
    console.log(`📡 API endpoints active at http://localhost:${PORT}/api`);
    console.log(`🩺 Health probe active at http://localhost:${PORT}/health`);
    console.log(`⚡ Readiness probe active at http://localhost:${PORT}/ready`);
  });
}

// 13. Graceful Shutdown Handlers (Zero-downtime draining & connection release)
const gracefulShutdown = async (signal: string) => {
  console.log(`\n🛑 [SHUTDOWN] Received ${signal}. Initiating graceful shutdown...`);

  if (serverInstance) {
    serverInstance.close(() => {
      console.log('🔒 Closed incoming HTTP connections.');
    });
  }

  // 1. Stop background workers
  jobQueue.stop();

  // 2. Flush in-memory playback write buffers to PostgreSQL
  console.log('💾 Flushing in-memory playback buffers to database...');
  await playbackBuffer.stop();

  // 3. Disconnect Prisma connection pool
  console.log('🔌 Closing Prisma database connection pool...');
  await prisma.$disconnect();

  console.log('✅ Graceful shutdown completed cleanly.');
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;

