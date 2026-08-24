import { Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../services/prisma.js';
import {
  comparePassword,
  generateToken,
  hashPassword,
  generateResetToken,
  verifyResetToken,
} from '../utils/auth.js';
import { sendError, sendSuccess } from '../utils/response.js';
import { AuthenticatedRequest } from '../types/index.js';
import { SecurityLogger } from '../utils/securityLogger.js';
import { config } from '../config/index.js';
import { emailService } from '../services/email.service.js';
import { jobQueue } from '../services/jobQueue.js';
import { invalidateUserAuthCache } from '../middleware/auth.js';

// NIST SP 800-63B compliant password schema
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d|.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,72}$/;

const registerSchema = z.object({
  username: z
    .string()
    .min(3, 'Tên người dùng phải có ít nhất 3 ký tự')
    .max(30, 'Tên người dùng tối đa 30 ký tự')
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Tên người dùng chỉ chứa chữ cái, số, dấu gạch dưới hoặc gạch nối'),
  email: z.string().email('Địa chỉ email không hợp lệ').max(100),
  password: z
    .string()
    .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
    .max(72, 'Mật khẩu tối đa 72 ký tự')
    .regex(passwordRegex, 'Mật khẩu phải bao gồm cả chữ hoa, chữ thường và chữ số hoặc ký tự đặc biệt'),
});

const loginSchema = z.object({
  identifier: z.string().min(1, 'Vui lòng nhập email hoặc tên đăng nhập').max(100),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu').max(72),
});

const updateProfileSchema = z.object({
  username: z
    .string()
    .min(3, 'Tên người dùng phải có ít nhất 3 ký tự')
    .max(30, 'Tên người dùng tối đa 30 ký tự')
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Tên người dùng chỉ chứa chữ cái, số, dấu gạch dưới hoặc gạch nối')
    .optional(),
  bio: z.string().max(300, 'Tiểu sử tối đa 300 ký tự').optional(),
  avatarUrl: z.string().url('URL ảnh đại diện không hợp lệ').optional().or(z.string().length(0)),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
  newPassword: z
    .string()
    .min(8, 'Mật khẩu mới phải có ít nhất 8 ký tự')
    .max(72, 'Mật khẩu mới tối đa 72 ký tự')
    .regex(passwordRegex, 'Mật khẩu mới phải bao gồm cả chữ hoa, chữ thường và chữ số hoặc ký tự đặc biệt'),
});

export const register = async (req: Request, res: Response) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  const requestId = (req as any).id;

  try {
    const validatedData = registerSchema.parse(req.body);
    const { username, email, password } = validatedData;
    const cleanEmail = email.toLowerCase().trim();
    const cleanUsername = username.trim();

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: cleanEmail }, { username: cleanUsername }],
      },
    });

    if (existingUser) {
      SecurityLogger.log({
        type: 'AUTH_REGISTER_FAILURE',
        ip: clientIp,
        details: { reason: 'Duplicate username or email' },
        requestId,
      });

      if (existingUser.email === cleanEmail) {
        return sendError(res, 'Địa chỉ email này đã được đăng ký trên hệ thống.', 400);
      }
      return sendError(res, 'Tên người dùng đã được sử dụng. Vui lòng chọn tên khác.', 400);
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        username: cleanUsername,
        email: cleanEmail,
        passwordHash,
        avatarUrl: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(cleanUsername)}`,
      },
      select: {
        id: true,
        username: true,
        email: true,
        avatarUrl: true,
        bio: true,
        role: true,
        createdAt: true,
      },
    });

    // Create default Favorites playlist
    await prisma.playlist.create({
      data: {
        title: 'Favorites',
        description: 'Danh sách bài hát yêu thích của bạn',
        userId: user.id,
        isPublic: false,
      },
    });

    const token = generateToken({
      userId: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    });

    SecurityLogger.log({
      type: 'AUTH_REGISTER_SUCCESS',
      ip: clientIp,
      userId: user.id,
      username: user.username,
      requestId,
    });

    return sendSuccess(res, { user, token }, 'Đăng ký tài khoản thành công', 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return sendError(res, error.errors[0]?.message || 'Dữ liệu đăng ký không hợp lệ', 400, error.errors);
    }
    return sendError(res, 'Không thể tạo tài khoản vào lúc này. Vui lòng thử lại.', 500);
  }
};

export const login = async (req: Request, res: Response) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  const requestId = (req as any).id;

  try {
    const validatedData = loginSchema.parse(req.body);
    const { identifier, password } = validatedData;
    const cleanIdentifier = identifier.trim();

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: cleanIdentifier.toLowerCase() },
          { username: cleanIdentifier },
        ],
      },
    });

    // Anti-account enumeration: Generic response on failure
    if (!user) {
      SecurityLogger.log({
        type: 'AUTH_LOGIN_FAILURE',
        ip: clientIp,
        details: { identifier: cleanIdentifier, reason: 'User not found' },
        requestId,
      });
      return sendError(res, 'Email, tên đăng nhập hoặc mật khẩu không chính xác.', 401);
    }

    if (user.isBlocked) {
      SecurityLogger.log({
        type: 'AUTH_BLOCKED_ATTEMPT',
        ip: clientIp,
        userId: user.id,
        username: user.username,
        requestId,
      });
      return sendError(res, 'Tài khoản của bạn đã bị tạm khóa. Vui lòng liên hệ quản trị viên.', 403);
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      SecurityLogger.log({
        type: 'AUTH_LOGIN_FAILURE',
        ip: clientIp,
        userId: user.id,
        username: user.username,
        details: { reason: 'Incorrect password' },
        requestId,
      });
      return sendError(res, 'Email, tên đăng nhập hoặc mật khẩu không chính xác.', 401);
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    });

    const safeUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      role: user.role,
      createdAt: user.createdAt,
    };

    SecurityLogger.log({
      type: 'AUTH_LOGIN_SUCCESS',
      ip: clientIp,
      userId: user.id,
      username: user.username,
      requestId,
    });

    return sendSuccess(res, { user: safeUser, token }, 'Đăng nhập thành công');
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return sendError(res, error.errors[0]?.message || 'Thông tin đăng nhập không hợp lệ', 400, error.errors);
    }
    return sendError(res, 'Đã xảy ra lỗi trong quá trình đăng nhập. Vui lòng thử lại.', 500);
  }
};

export const getMe = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        username: true,
        email: true,
        avatarUrl: true,
        bio: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            favorites: true,
            playlists: true,
            following: true,
          },
        },
      },
    });

    if (!user) {
      return sendError(res, 'Không tìm thấy tài khoản người dùng.', 404);
    }

    return sendSuccess(res, user);
  } catch (error: any) {
    return sendError(res, 'Không thể tải thông tin tài khoản.', 500);
  }
};

export const updateProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validatedData = updateProfileSchema.parse(req.body);
    const { username, bio, avatarUrl } = validatedData;
    const userId = req.user!.userId;

    if (username) {
      const cleanUsername = username.trim();
      const existing = await prisma.user.findFirst({
        where: {
          username: cleanUsername,
          NOT: { id: userId },
        },
      });
      if (existing) {
        return sendError(res, 'Tên người dùng đã có người khác sử dụng.', 400);
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(username ? { username: username.trim() } : {}),
        ...(bio !== undefined ? { bio: bio ? String(bio).trim() : null } : {}),
        ...(avatarUrl !== undefined ? { avatarUrl: avatarUrl || null } : {}),
      },
      select: {
        id: true,
        username: true,
        email: true,
        avatarUrl: true,
        bio: true,
        role: true,
        createdAt: true,
      },
    });

    invalidateUserAuthCache(userId);

    return sendSuccess(res, updatedUser, 'Cập nhật thông tin cá nhân thành công.');
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return sendError(res, error.errors[0]?.message || 'Dữ liệu không hợp lệ', 400, error.errors);
    }
    return sendError(res, 'Không thể cập nhật thông tin cá nhân.', 500);
  }
};

export const changePassword = async (req: AuthenticatedRequest, res: Response) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  const userId = req.user!.userId;
  const requestId = (req as any).id;

  try {
    const validatedData = changePasswordSchema.parse(req.body);
    const { currentPassword, newPassword } = validatedData;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return sendError(res, 'Không tìm thấy tài khoản người dùng.', 404);
    }

    const isMatch = await comparePassword(currentPassword, user.passwordHash);
    if (!isMatch) {
      SecurityLogger.log({
        type: 'AUTH_PASSWORD_CHANGE_FAILURE',
        ip: clientIp,
        userId,
        details: { reason: 'Incorrect current password' },
        requestId,
      });
      return sendError(res, 'Mật khẩu hiện tại không chính xác.', 400);
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    invalidateUserAuthCache(userId);

    SecurityLogger.log({
      type: 'AUTH_PASSWORD_CHANGE_SUCCESS',
      ip: clientIp,
      userId,
      requestId,
    });

    return sendSuccess(res, null, 'Đổi mật khẩu thành công.');
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return sendError(res, error.errors[0]?.message || 'Dữ liệu mật khẩu không hợp lệ', 400);
    }
    return sendError(res, 'Không thể đổi mật khẩu vào lúc này.', 500);
  }
};

// =========================================================================
// FORGOT PASSWORD & EMAIL OTP FLOW
// =========================================================================

const forgotPasswordRequestSchema = z.object({
  email: z.string().email('Địa chỉ email không hợp lệ').max(100),
});

const verifyOtpSchema = z.object({
  email: z.string().email('Địa chỉ email không hợp lệ').max(100),
  otp: z
    .string()
    .length(6, 'Mã OTP phải gồm đúng 6 chữ số')
    .regex(/^\d{6}$/, 'Mã OTP chỉ bao gồm chữ số'),
});

const resetPasswordSchema = z.object({
  resetToken: z.string().min(1, 'Token đặt lại mật khẩu không hợp lệ'),
  newPassword: z
    .string()
    .min(8, 'Mật khẩu mới phải có ít nhất 8 ký tự')
    .max(72, 'Mật khẩu mới tối đa 72 ký tự')
    .regex(passwordRegex, 'Mật khẩu mới phải bao gồm cả chữ hoa, chữ thường và chữ số hoặc ký tự đặc biệt'),
  confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu mới'),
});

/**
 * Step 1: Request Password Reset OTP
 * Anti-Email Enumeration: Always returns generic success message even if email doesn't exist
 */
export const requestPasswordReset = async (req: Request, res: Response) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  const requestId = (req as any).id;

  try {
    const validatedData = forgotPasswordRequestSchema.parse(req.body);
    const cleanEmail = validatedData.email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    const genericSuccessMessage =
      'Nếu địa chỉ email này đã được đăng ký, chúng tôi đã gửi mã OTP 6 số đến hộp thư của bạn.';

    // If user does not exist or is blocked, prevent enumeration
    if (!user || user.isBlocked) {
      SecurityLogger.log({
        type: 'AUTH_FORGOT_PASSWORD_ATTEMPT',
        ip: clientIp,
        details: { email: cleanEmail, userExists: !!user, isBlocked: !!user?.isBlocked },
        requestId,
      });

      // Artificial timing delay to prevent side-channel timing analysis
      await new Promise((resolve) => setTimeout(resolve, 300));

      return sendSuccess(
        res,
        { cooldownSeconds: config.otp.resendCooldownSeconds },
        genericSuccessMessage
      );
    }

    // Rate limiting / Cooldown: Check if user already requested OTP within cooldown window
    const cooldownWindow = new Date(Date.now() - config.otp.resendCooldownSeconds * 1000);
    const recentOtp = await prisma.passwordResetOtp.findFirst({
      where: {
        userId: user.id,
        createdAt: { gt: cooldownWindow },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (recentOtp) {
      const elapsedSeconds = Math.floor((Date.now() - recentOtp.createdAt.getTime()) / 1000);
      const remainingSeconds = Math.max(1, config.otp.resendCooldownSeconds - elapsedSeconds);
      return sendError(
        res,
        `Vui lòng đợi ${remainingSeconds} giây trước khi yêu cầu gửi lại mã OTP mới.`,
        429
      );
    }

    // Invalidate previous active OTPs for this user to ensure single active OTP
    await prisma.passwordResetOtp.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });

    // Generate cryptographically secure 6-digit OTP
    const rawOtp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = await hashPassword(rawOtp);
    const expiresAt = new Date(Date.now() + config.otp.expiresMinutes * 60 * 1000);

    // Save hashed OTP to database
    await prisma.passwordResetOtp.create({
      data: {
        userId: user.id,
        otpHash,
        expiresAt,
      },
    });

    // Dispatch OTP email (awaited to ensure reliable delivery on Vercel Serverless Functions)
    try {
      await emailService.sendPasswordResetOtp(user.email, rawOtp, user.username);
    } catch (emailErr: any) {
      console.error('Failed to send OTP email:', emailErr?.message || emailErr);
    }

    SecurityLogger.log({
      type: 'AUTH_FORGOT_PASSWORD_REQUESTED',
      ip: clientIp,
      userId: user.id,
      username: user.username,
      requestId,
    });

    return sendSuccess(
      res,
      {
        cooldownSeconds: config.otp.resendCooldownSeconds,
        ...(!config.isProd && !emailService.isReady() ? { devOtp: rawOtp, isDevMode: true } : {}),
      },
      genericSuccessMessage
    );

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return sendError(res, error.errors[0]?.message || 'Địa chỉ email không hợp lệ', 400);
    }
    console.error('Error in requestPasswordReset:', error);
    return sendError(
      res,
      'Không thể gửi mã xác thực vào lúc này. Vui lòng thử lại sau giây lát.',
      500
    );
  }
};

/**
 * Step 2: Verify 6-digit OTP
 * Validates OTP attempts, expiry, and single-use; returns short-lived reset token
 */
export const verifyPasswordResetOtp = async (req: Request, res: Response) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  const requestId = (req as any).id;

  try {
    const validatedData = verifyOtpSchema.parse(req.body);
    const cleanEmail = validatedData.email.toLowerCase().trim();
    const cleanOtp = validatedData.otp.trim();

    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (!user || user.isBlocked) {
      return sendError(
        res,
        'Mã xác thực không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu mã mới.',
        400
      );
    }

    // Find latest active OTP record for user
    const otpRecord = await prisma.passwordResetOtp.findFirst({
      where: {
        userId: user.id,
        usedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      return sendError(
        res,
        'Không tìm thấy yêu cầu đặt lại mật khẩu hợp lệ. Vui lòng yêu cầu mã mới.',
        400
      );
    }

    // Check expiration
    if (new Date() > otpRecord.expiresAt) {
      return sendError(
        res,
        'Mã xác thực đã hết hạn (chỉ có hiệu lực trong 5 phút). Vui lòng yêu cầu mã mới.',
        400
      );
    }

    // Check maximum attempt limit (Anti-Brute Force)
    if (otpRecord.attempts >= config.otp.maxAttempts) {
      // Invalidate OTP
      await prisma.passwordResetOtp.update({
        where: { id: otpRecord.id },
        data: { usedAt: new Date() },
      });

      SecurityLogger.log({
        type: 'AUTH_OTP_MAX_ATTEMPTS_EXCEEDED',
        ip: clientIp,
        userId: user.id,
        requestId,
      });

      return sendError(
        res,
        'Bạn đã nhập sai mã xác thực quá 5 lần. Mã này đã bị vô hiệu hóa, vui lòng yêu cầu mã mới.',
        400
      );
    }

    // Verify OTP hash
    const isMatch = await comparePassword(cleanOtp, otpRecord.otpHash);

    if (!isMatch) {
      const nextAttempt = otpRecord.attempts + 1;
      await prisma.passwordResetOtp.update({
        where: { id: otpRecord.id },
        data: { attempts: nextAttempt },
      });

      const remainingAttempts = config.otp.maxAttempts - nextAttempt;

      SecurityLogger.log({
        type: 'AUTH_OTP_VERIFY_FAILURE',
        ip: clientIp,
        userId: user.id,
        details: { attempts: nextAttempt, remainingAttempts },
        requestId,
      });

      if (remainingAttempts <= 0) {
        return sendError(
          res,
          'Mã xác thực không chính xác. Mã đã bị vô hiệu hóa do thử sai quá số lần cho phép.',
          400
        );
      }

      return sendError(
        res,
        `Mã xác thực không chính xác. Bạn còn ${remainingAttempts} lần thử.`,
        400
      );
    }

    // Mark OTP as used (Single-use enforcement)
    await prisma.passwordResetOtp.update({
      where: { id: otpRecord.id },
      data: { usedAt: new Date() },
    });

    // Generate short-lived Password Reset Token (10 minutes)
    const resetToken = generateResetToken(user.id, user.email);

    SecurityLogger.log({
      type: 'AUTH_OTP_VERIFY_SUCCESS',
      ip: clientIp,
      userId: user.id,
      username: user.username,
      requestId,
    });

    return sendSuccess(
      res,
      { resetToken },
      'Xác thực mã OTP thành công. Vui lòng thiết lập mật khẩu mới.'
    );
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return sendError(res, error.errors[0]?.message || 'Dữ liệu không hợp lệ', 400);
    }
    console.error('Error in verifyPasswordResetOtp:', error);
    return sendError(res, 'Không thể xác minh mã xác thực vào lúc này.', 500);
  }
};

/**
 * Step 3: Set New Password
 * Validates reset token & password confirmation, hashes new password with bcrypt
 */
export const resetPassword = async (req: Request, res: Response) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  const requestId = (req as any).id;

  try {
    const validatedData = resetPasswordSchema.parse(req.body);
    const { resetToken, newPassword, confirmPassword } = validatedData;

    if (newPassword !== confirmPassword) {
      return sendError(res, 'Mật khẩu xác nhận không khớp với mật khẩu mới.', 400);
    }

    // Verify reset token authorization
    let decoded;
    try {
      decoded = verifyResetToken(resetToken);
    } catch {
      return sendError(
        res,
        'Phiên đặt lại mật khẩu đã hết hạn hoặc không hợp lệ. Vui lòng thực hiện lại từ đầu.',
        401
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user || user.isBlocked) {
      return sendError(res, 'Tài khoản người dùng không tồn tại hoặc đã bị khóa.', 404);
    }

    // Hash new password using bcrypt
    const passwordHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    invalidateUserAuthCache(user.id);

    // Invalidate any remaining OTPs for this user
    await prisma.passwordResetOtp.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });

    SecurityLogger.log({
      type: 'AUTH_PASSWORD_RESET_SUCCESS',
      ip: clientIp,
      userId: user.id,
      username: user.username,
      requestId,
    });

    return sendSuccess(
      res,
      null,
      'Đặt lại mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới.'
    );
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return sendError(res, error.errors[0]?.message || 'Dữ liệu mật khẩu không hợp lệ', 400);
    }
    console.error('Error in resetPassword:', error);
    return sendError(res, 'Không thể cập nhật mật khẩu vào lúc này. Vui lòng thử lại.', 500);
  }
};

