import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Radio, Lock, Mail, User, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../../store/authStore.js';
import { Button } from '../../components/common/Button.js';
import { Input } from '../../components/common/Input.js';

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const { register, isLoading } = useAuthStore();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    if (password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }

    try {
      await register({
        username: username.trim(),
        email: email.trim(),
        password,
      });
      navigate('/');
    } catch (err: any) {
      setError(
        err.response?.data?.message || 'Không thể tạo tài khoản. Vui lòng thử lại.'
      );
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-10 px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Brand Card */}
        <div className="text-center space-y-2">
          <Link to="/" className="inline-flex items-center gap-2 group">
            <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-lg ring-2 ring-primary-500/20 group-hover:scale-105 transition-transform flex-shrink-0">
              <img src="/logo.png" alt="MusicWave" className="w-full h-full object-cover" />
            </div>
          </Link>
          <h1 className="text-2xl font-bold text-white tracking-tight pt-1">
            Tạo tài khoản MusicWave
          </h1>
          <p className="text-xs text-text-muted">
            Đăng ký để thưởng thức âm nhạc và tạo danh sách phát của riêng bạn.
          </p>
        </div>

        {/* Form Container */}
        <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.07] space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <Input
              label="Tên người dùng"
              placeholder="e.g. SonicVoyager"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              leftIcon={<User className="w-4 h-4 text-text-muted" />}
              required
            />

            <Input
              type="email"
              label="Địa chỉ email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail className="w-4 h-4 text-text-muted" />}
              required
            />

            <Input
              type="password"
              label="Mật khẩu"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock className="w-4 h-4 text-text-muted" />}
              required
            />

            <Input
              type="password"
              label="Xác nhận mật khẩu"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              leftIcon={<Lock className="w-4 h-4 text-text-muted" />}
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full justify-center mt-2"
              isLoading={isLoading}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Đăng ký
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-text-muted">
          Đã có tài khoản?{' '}
          <Link
            to="/login"
            className="text-white font-semibold hover:underline transition-colors"
          >
            Đăng nhập
          </Link>
        </p>
      </div>
    </div>
  );
};
