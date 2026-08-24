import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response.js';
import multer from 'multer';
import { SecurityLogger } from '../utils/securityLogger.js';

export const errorHandler = (err: any, req: Request, res: Response, _next: NextFunction) => {
  const isDev = process.env.NODE_ENV === 'development';
  const requestId = (req as any).id || res.getHeader('X-Request-Id');

  // Log unhandled server error with requestId
  console.error(`[ERROR] [ReqId: ${requestId || 'none'}] ${err.name || 'Error'}: ${err.message}`);
  if (isDev && err.stack) {
    console.error(err.stack);
  }

  // 1. Zod Validation Error
  if (err.name === 'ZodError') {
    return res.status(400).json({
      success: false,
      message: err.errors?.[0]?.message || 'Dữ liệu không hợp lệ.',
      errors: err.errors,
      requestId,
    });
  }

  // 2. Multer File Upload Errors
  if (err instanceof multer.MulterError) {
    let message = 'Lỗi tải tệp lên.';
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'Kích thước tệp vượt quá giới hạn tối đa cho phép (40MB).';
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      message = 'Vượt quá số lượng tệp cho phép tải lên.';
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      message = 'Trường tệp tải lên không hợp lệ.';
    }
    return sendError(res, message, 400);
  }

  // 3. Custom File Filter Errors from upload.ts
  if (err.message && (err.message.includes('Định dạng tệp') || err.message.includes('phần mở rộng'))) {
    return sendError(res, err.message, 400);
  }

  // 4. JWT Error
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return sendError(res, 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.', 401);
  }

  // 5. Prisma Database Errors Sanitization (prevent exposing column names / schema)
  if (err.code && typeof err.code === 'string' && err.code.startsWith('P')) {
    SecurityLogger.log({
      type: 'SUSPICIOUS_REQUEST',
      ip: req.ip || req.socket.remoteAddress || 'unknown',
      action: req.method,
      resource: req.originalUrl,
      details: { prismaCode: err.code, message: err.message },
      requestId,
    });
    return sendError(res, 'Thao tác cơ sở dữ liệu không thành công. Vui lòng thử lại.', 400);
  }

  // 6. Generic Internal Server Error (Never leak stack trace to user in production)
  const statusCode = err.statusCode || (err.status && typeof err.status === 'number' ? err.status : 500);
  const safeMessage = isDev
    ? err.message || 'Lỗi máy chủ nội bộ'
    : statusCode >= 500
    ? 'Đã xảy ra lỗi máy chủ. Vui lòng thử lại sau.'
    : err.message || 'Yêu cầu không thể hoàn thành.';

  return sendError(res, safeMessage, statusCode, isDev ? err.stack : undefined);
};

export const notFoundHandler = (req: Request, res: Response) => {
  return sendError(res, `Đường dẫn API hoặc tài nguyên không tồn tại: ${req.method} ${req.originalUrl}`, 404);
};
