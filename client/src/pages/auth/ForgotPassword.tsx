import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Radio,
  Mail,
  Lock,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  CheckCircle2,
  Eye,
  EyeOff,
  RefreshCw,
} from 'lucide-react';
import { authService } from '../../services/auth.service.js';
import { Button } from '../../components/common/Button.js';
import { Input } from '../../components/common/Input.js';

type ForgotStep = 'EMAIL' | 'OTP' | 'PASSWORD' | 'SUCCESS';

export const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();

  const [step, setStep] = useState<ForgotStep>('EMAIL');
  const [email, setEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [devOtpHint, setDevOtpHint] = useState('');

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Timer countdown for OTP resend cooldown
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Mask email for privacy display (e.g. alex@musicwave.com -> al***@musicwave.com)
  const getMaskedEmail = (rawEmail: string) => {
    if (!rawEmail || !rawEmail.includes('@')) return rawEmail;
    const [name, domain] = rawEmail.split('@');
    if (name.length <= 2) return `${name[0]}***@${domain}`;
    return `${name.slice(0, 2)}***${name.slice(-1)}@${domain}`;
  };

  // STEP 1: Request OTP
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Vui lòng nhập địa chỉ email.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await authService.requestPasswordReset(cleanEmail);
      setCooldown(res.data?.cooldownSeconds || 60);
      if (res.data?.devOtp) {
        setDevOtpHint(res.data.devOtp);
      } else {
        setDevOtpHint('');
      }
      setInfoMessage(
        res.message || 'Nếu email này đã được đăng ký, chúng tôi đã gửi mã xác thực OTP 6 số đến hộp thư của bạn.'
      );
      setStep('OTP');
      // Auto focus first OTP input after step switch
      setTimeout(() => otpInputRefs.current[0]?.focus(), 150);
    } catch (err: any) {
      setError(
        err.response?.data?.message || 'Không thể gửi mã xác thực vào lúc này. Vui lòng thử lại.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP in Step 2
  const handleResendOtp = async () => {
    if (cooldown > 0 || loading) return;
    try {
      setLoading(true);
      setError('');
      const res = await authService.requestPasswordReset(email.trim().toLowerCase());
      setCooldown(res.data?.cooldownSeconds || 60);
      if (res.data?.devOtp) {
        setDevOtpHint(res.data.devOtp);
      } else {
        setDevOtpHint('');
      }
      setInfoMessage(
        res.message || 'Mã xác thực mới đã được gửi lại vào email của bạn.'
      );
      setOtpDigits(['', '', '', '', '', '']);
      otpInputRefs.current[0]?.focus();
    } catch (err: any) {
      setError(
        err.response?.data?.message || 'Không thể gửi lại mã xác thực lúc này. Vui lòng thử lại sau.'
      );
    } finally {
      setLoading(false);
    }
  };

  // OTP Input handlers: typing, backspacing, paste
  const handleOtpChange = (index: number, value: string) => {
    const numericValue = value.replace(/\D/g, '');
    if (!numericValue) {
      const nextDigits = [...otpDigits];
      nextDigits[index] = '';
      setOtpDigits(nextDigits);
      return;
    }

    // Handle single digit input
    const char = numericValue[numericValue.length - 1];
    const nextDigits = [...otpDigits];
    nextDigits[index] = char;
    setOtpDigits(nextDigits);

    // Auto focus next box
    if (index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim().replace(/\D/g, '');
    if (!pastedData) return;

    const digits = pastedData.slice(0, 6).split('');
    const nextDigits = [...otpDigits];
    digits.forEach((d, i) => {
      if (i < 6) nextDigits[i] = d;
    });
    setOtpDigits(nextDigits);

    const focusIndex = Math.min(digits.length, 5);
    otpInputRefs.current[focusIndex]?.focus();
  };

  // STEP 2: Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullOtp = otpDigits.join('');
    if (fullOtp.length !== 6) {
      setError('Vui lòng nhập đầy đủ 6 chữ số mã OTP.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await authService.verifyPasswordResetOtp(email.trim().toLowerCase(), fullOtp);
      if (res.data?.resetToken) {
        setResetToken(res.data.resetToken);
        setStep('PASSWORD');
      } else {
        setError('Xác thực không thành công. Vui lòng thử lại.');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Mã xác thực không hợp lệ hoặc đã hết hạn.');
    } finally {
      setLoading(false);
    }
  };

  // STEP 3: Set New Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp với mật khẩu mới.');
      return;
    }

    if (newPassword.length < 8) {
      setError('Mật khẩu mới phải có ít nhất 8 ký tự.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await authService.resetPassword({
        resetToken,
        newPassword,
        confirmPassword,
      });
      setStep('SUCCESS');
    } catch (err: any) {
      setError(
        err.response?.data?.message || 'Không thể đổi mật khẩu. Phiên xác thực có thể đã hết hạn.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-10 px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <Link to="/" className="inline-flex items-center gap-2 group">
            <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-lg ring-2 ring-primary-500/20 group-hover:scale-105 transition-transform flex-shrink-0">
              <img src="/logo.png" alt="MusicWave" className="w-full h-full object-cover" />
            </div>
          </Link>
          <h1 className="text-2xl font-bold text-white tracking-tight pt-1">
            {step === 'EMAIL' && 'Quên mật khẩu?'}
            {step === 'OTP' && 'Xác thực mã OTP'}
            {step === 'PASSWORD' && 'Đặt mật khẩu mới'}
            {step === 'SUCCESS' && 'Thành công!'}
          </h1>
          <p className="text-xs text-text-muted leading-relaxed">
            {step === 'EMAIL' &&
              'Nhập địa chỉ email đã đăng ký của bạn để nhận mã xác thực đặt lại mật khẩu.'}
            {step === 'OTP' && (
              <>
                Mã xác thực 6 số đã được gửi đến email{' '}
                <strong className="text-white">{getMaskedEmail(email)}</strong>. Mã có hiệu lực trong 5 phút.
              </>
            )}
            {step === 'PASSWORD' &&
              'Thiết lập mật khẩu mới cho tài khoản MusicWave của bạn.'}
            {step === 'SUCCESS' &&
              'Mật khẩu của bạn đã được cập nhật thành công.'}
          </p>
        </div>

        {/* Card Container */}
        <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.07] space-y-4">
          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 font-medium">
              {error}
            </div>
          )}

          {/* Info Message */}
          {infoMessage && step === 'OTP' && !error && (
            <div className="p-3 rounded-xl bg-primary-500/10 border border-primary-500/20 text-xs text-primary-300 font-medium leading-relaxed">
              {infoMessage}
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 1: ENTER EMAIL                                                       */}
          {/* ========================================================================= */}
          {step === 'EMAIL' && (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <Input
                label="Địa chỉ email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail className="w-4 h-4 text-text-muted" />}
                required
                autoFocus
              />

              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full justify-center mt-2"
                isLoading={loading}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Gửi mã OTP
              </Button>
            </form>
          )}

          {/* ========================================================================= */}
          {/* STEP 2: ENTER 6-DIGIT OTP                                                 */}
          {/* ========================================================================= */}
          {step === 'OTP' && (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              {/* Dev Mode OTP Banner (Shown only when SMTP is not configured in dev) */}
              {devOtpHint && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-300 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold flex items-center gap-1.5 text-amber-300">
                      💡 <span>Mã xác thực thử nghiệm (Dev Mode):</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const digits = devOtpHint.split('').slice(0, 6);
                        setOtpDigits(digits);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-bold text-[11px] transition-colors"
                    >
                      Tự động điền
                    </button>
                  </div>
                  <p className="text-[11px] text-amber-200/80 leading-relaxed">
                    Hệ thống chưa cấu hình SMTP để gửi email thật. Mã OTP của bạn là:{' '}
                    <strong className="text-white font-mono text-sm tracking-widest bg-black/40 px-2 py-0.5 rounded border border-amber-500/30">
                      {devOtpHint}
                    </strong>
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary text-center">
                  Nhập mã 6 chữ số
                </label>

                {/* 6-box OTP Input */}
                <div className="flex items-center justify-between gap-1.5 sm:gap-2">
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => (otpInputRefs.current[idx] = el)}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      onPaste={idx === 0 ? handleOtpPaste : undefined}
                      aria-label={`OTP digit ${idx + 1}`}
                      className="w-11 h-12 sm:w-12 sm:h-13 rounded-xl bg-white/[0.05] border border-white/10 text-center text-lg font-bold text-white outline-none focus:border-white focus:ring-1 focus:ring-white transition-all select-none"
                    />
                  ))}
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full justify-center"
                isLoading={loading}
                disabled={otpDigits.join('').length !== 6}
                leftIcon={<KeyRound className="w-4 h-4" />}
              >
                Xác minh mã OTP
              </Button>

              {/* Resend Cooldown Section */}
              <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs text-text-muted">
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setStep('EMAIL');
                  }}
                  className="hover:text-white transition-colors"
                >
                  ← Đổi email khác
                </button>

                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={cooldown > 0 || loading}
                  className={`inline-flex items-center gap-1 font-semibold transition-colors ${
                    cooldown > 0
                      ? 'text-text-muted cursor-not-allowed opacity-60'
                      : 'text-white hover:underline'
                  }`}
                >
                  <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                  {cooldown > 0 ? `Gửi lại sau (${cooldown}s)` : 'Gửi lại mã'}
                </button>
              </div>
            </form>
          )}

          {/* ========================================================================= */}
          {/* STEP 3: ENTER NEW PASSWORD                                                */}
          {/* ========================================================================= */}
          {step === 'PASSWORD' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Mật khẩu mới *
                </label>
                <div className="relative">
                  <Input
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="Tối thiểu 8 ký tự"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    leftIcon={<Lock className="w-4 h-4 text-text-muted" />}
                    required
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    aria-label={showNewPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-white transition-colors"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Xác nhận mật khẩu mới *
                </label>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Nhập lại mật khẩu mới"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    leftIcon={<Lock className="w-4 h-4 text-text-muted" />}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-white transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-text-muted leading-relaxed">
                Mật khẩu bao gồm chữ hoa, chữ thường và chữ số hoặc ký tự đặc biệt.
              </p>

              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full justify-center mt-2"
                isLoading={loading}
              >
                Cập nhật mật khẩu
              </Button>
            </form>
          )}

          {/* ========================================================================= */}
          {/* STEP 4: SUCCESS SCREEN                                                    */}
          {/* ========================================================================= */}
          {step === 'SUCCESS' && (
            <div className="space-y-5 text-center py-2">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">Đổi mật khẩu thành công!</h3>
                <p className="text-xs text-text-muted leading-relaxed">
                  Mật khẩu mới đã được cập nhật. Bạn có thể sử dụng mật khẩu mới để đăng nhập ngay bây giờ.
                </p>
              </div>

              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={() => navigate('/login')}
                className="w-full justify-center"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Đăng nhập ngay
              </Button>
            </div>
          )}
        </div>

        {/* Back to Login Footer */}
        {step !== 'SUCCESS' && (
          <p className="text-center text-xs text-text-muted">
            <Link
              to="/login"
              className="inline-flex items-center gap-1 text-text-muted hover:text-white transition-colors font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Quay lại đăng nhập
            </Link>
          </p>
        )}
      </div>
    </div>
  );
};
