import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { SecurityLogger } from '../utils/securityLogger.js';

const uploadDir = process.env.VERCEL
  ? path.join(os.tmpdir(), 'uploads')
  : path.resolve(process.cwd(), 'uploads');

try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
} catch {
  // Safe ignore in read-only serverless environment
}

// Strict Allowed Extensions and MIME types mapping
const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  // Audio formats
  '.mp3': ['audio/mpeg', 'audio/mp3', 'audio/x-mpeg'],
  '.wav': ['audio/wav', 'audio/x-wav', 'audio/wave'],
  '.ogg': ['audio/ogg', 'application/ogg'],
  '.m4a': ['audio/mp4', 'audio/x-m4a', 'audio/m4a'],
  // Image formats
  '.jpg': ['image/jpeg', 'image/pjpeg'],
  '.jpeg': ['image/jpeg', 'image/pjpeg'],
  '.png': ['image/png'],
  '.webp': ['image/webp'],
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    // 1. Sanitize file extension
    const ext = path.extname(file.originalname).toLowerCase();
    // 2. Generate non-guessable, crypto-random filename (prevent path traversal & file overwrites)
    const randomHex = crypto.randomBytes(16).toString('hex');
    const safeFieldname = file.fieldname.replace(/[^a-zA-Z0-9]/g, '');
    cb(null, `${safeFieldname}-${Date.now()}-${randomHex}${ext}`);
  },
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Path traversal & null byte sanitization on original filename
  const cleanOriginalName = file.originalname.replace(/[\0\x00-\x1f\x7f/\\]/g, '');
  const ext = path.extname(cleanOriginalName).toLowerCase();
  const mime = file.mimetype.toLowerCase();

  const allowedMimesForExt = ALLOWED_MIME_TYPES[ext];

  if (!allowedMimesForExt) {
    SecurityLogger.log({
      type: 'UPLOAD_REJECTED',
      ip: req.ip || req.socket.remoteAddress || 'unknown',
      userId: req.user?.userId,
      resource: file.fieldname,
      details: { reason: 'Disallowed extension', ext, mime },
    });
    return cb(new Error(`Định dạng tệp không được hỗ trợ: ${ext}. Chỉ chấp nhận MP3, WAV, OGG, M4A, JPG, PNG, WEBP.`));
  }

  // Check if MIME type is legitimate for this extension (prevents polyglot/executable masquerading)
  const isMimeValid = allowedMimesForExt.some((allowedMime) => mime.includes(allowedMime) || allowedMime.includes(mime));

  if (!isMimeValid && mime !== 'application/octet-stream') {
    SecurityLogger.log({
      type: 'UPLOAD_REJECTED',
      ip: req.ip || req.socket.remoteAddress || 'unknown',
      userId: req.user?.userId,
      resource: file.fieldname,
      details: { reason: 'MIME mismatch', ext, mime, expected: allowedMimesForExt },
    });
    return cb(new Error(`Nội dung tệp không khớp với phần mở rộng (${ext} vs ${mime}).`));
  }

  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB max
    files: 4,                  // Max 4 files per multipart request
    fields: 50,                // Limit number of form fields to prevent DoS
  },
});
