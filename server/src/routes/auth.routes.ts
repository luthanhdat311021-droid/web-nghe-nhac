import { Router } from 'express';
import {
  changePassword,
  getMe,
  login,
  register,
  updateProfile,
  requestPasswordReset,
  verifyPasswordResetOtp,
  resetPassword,
} from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { startGoogleLogin, finishGoogleLogin, confirmGoogleLink } from '../controllers/googleAuth.controller.js';
import {
  authRateLimiter,
  passwordResetRequestLimiter,
  passwordResetVerifyLimiter,
} from '../middleware/apiRateLimiter.js';

const router = Router();

// Rate-limited sensitive authentication endpoints
router.post('/register', authRateLimiter, register);
router.post('/login', authRateLimiter, login);
router.post('/google/start', authRateLimiter, startGoogleLogin);
router.post('/google/exchange', authRateLimiter, finishGoogleLogin);
router.post('/google/link', authRateLimiter, confirmGoogleLink);
router.post('/change-password', requireAuth, authRateLimiter, changePassword);

// Forgot password & OTP verification endpoints
router.post('/forgot-password/request', passwordResetRequestLimiter, requestPasswordReset);
router.post('/forgot-password/verify-otp', passwordResetVerifyLimiter, verifyPasswordResetOtp);
router.post('/forgot-password/reset', authRateLimiter, resetPassword);

// Profile and session management
router.get('/me', requireAuth, getMe);
router.put('/profile', requireAuth, updateProfile);

export default router;

